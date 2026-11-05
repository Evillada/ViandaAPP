import bcrypt from "bcryptjs";
import type { Sex } from "@prisma/client";
import type { Actor } from "@/core/access/types";
import { packageDisplayStatus, type PackageDisplayStatus } from "@/core/portal/package-status";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

type Result = { ok: true } | { ok: false; error: string };

export interface AccountRecord {
  patientId: string;
  professionalName: string;
  grantedAt: Date | null;
  firstName: string;
  lastName: string;
  documentId: string | null;
  sex: Sex | null;
  dateOfBirth: Date | null;
  phone: string | null;
  packages: {
    id: string;
    name: string;
    includedSessions: number | null;
    startsAt: Date;
    endsAt: Date | null;
    status: PackageDisplayStatus;
  }[];
}

export async function getAccountOverview(
  userId: string,
  now: Date
): Promise<{ email: string; records: AccountRecord[] }> {
  const [user, records] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.patient.findMany({
      where: { userId, consents: { some: { userId, revokedAt: null } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        documentId: true,
        sex: true,
        dateOfBirth: true,
        phone: true,
        professional: { select: { name: true } },
        consents: { where: { userId, revokedAt: null }, orderBy: { grantedAt: "desc" }, take: 1, select: { grantedAt: true } },
        servicePackages: {
          orderBy: { startsAt: "desc" },
          select: { id: true, name: true, includedSessions: true, startsAt: true, endsAt: true, status: true },
        },
      },
    }),
  ]);

  return {
    email: user?.email ?? "",
    records: records.map((r) => ({
      patientId: r.id,
      professionalName: r.professional.name ?? "Tu nutricionista",
      grantedAt: r.consents[0]?.grantedAt ?? null,
      firstName: r.firstName,
      lastName: r.lastName,
      documentId: r.documentId,
      sex: r.sex,
      dateOfBirth: r.dateOfBirth,
      phone: r.phone,
      packages: r.servicePackages.map((p) => ({
        id: p.id,
        name: p.name,
        includedSessions: p.includedSessions,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        status: packageDisplayStatus(p.status, p.endsAt, now),
      })),
    })),
  };
}

const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

export async function updatePatientPhone(actor: Actor, rawPhone: string, ip: string | null): Promise<Result> {
  if (actor.activeArea !== "PATIENT") return { ok: false, error: "No autorizado" };

  const trimmed = rawPhone.trim();
  const phone = trimmed === "" ? null : trimmed;
  if (phone !== null && !PHONE_PATTERN.test(phone)) return { ok: false, error: "Teléfono inválido" };

  return prisma.$transaction(async (tx): Promise<Result> => {
    const records = await tx.patient.findMany({
      where: { userId: actor.userId, consents: { some: { userId: actor.userId, revokedAt: null } } },
      select: { id: true },
    });
    if (records.length === 0) return { ok: false, error: "No tienes fichas vinculadas" };

    await tx.patient.updateMany({ where: { id: { in: records.map((r) => r.id) } }, data: { phone } });
    for (const record of records) {
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: "PATIENT",
          action: "PATIENT_PHONE_UPDATED",
          entityType: "Patient",
          entityId: record.id,
          patientId: record.id,
          ip,
        },
        tx
      );
    }
    return { ok: true };
  });
}

export async function changePassword(actor: Actor, current: string, next: string, ip: string | null): Promise<Result> {
  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { password: true, deletedAt: true } });
  if (!user || user.deletedAt || !user.password || !(await bcrypt.compare(current, user.password))) {
    return { ok: false, error: "La contraseña actual no es correcta" };
  }
  if (next.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
  if (next === current) return { ok: false, error: "La nueva contraseña debe ser diferente" };

  const hashed = await bcrypt.hash(next, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.userId }, data: { password: hashed } });
    await recordAudit(
      {
        actorId: actor.userId,
        actorRole: "PATIENT",
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: actor.userId,
        ip,
      },
      tx
    );
  });
  return { ok: true };
}

export async function deleteAccount(actor: Actor, confirmation: string, ip: string | null, now: Date): Promise<Result> {
  if (confirmation.trim() !== "ELIMINAR") return { ok: false, error: "Escribe ELIMINAR para confirmar" };

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, roles: true, deletedAt: true, professionalProfile: { select: { id: true } } },
  });
  if (!user || user.deletedAt) return { ok: false, error: "No autorizado" };
  if (user.roles.includes("PROFESSIONAL") || user.roles.includes("ADMIN") || user.professionalProfile) {
    return { ok: false, error: "Esta cuenta también tiene acceso profesional. Escríbenos para eliminarla." };
  }

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.patientConsent.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    const unlinked = await tx.patient.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@deleted.invalid`,
        name: null,
        password: null,
        image: null,
        emailVerified: null,
        roles: [],
        lastArea: null,
        deletedAt: now,
      },
    });
    await recordAudit(
      {
        actorId: user.id,
        actorRole: "PATIENT",
        action: "ACCOUNT_DELETED",
        entityType: "User",
        entityId: user.id,
        metadata: { revokedConsents: revoked.count, unlinkedRecords: unlinked.count },
        ip,
      },
      tx
    );
  });
  return { ok: true };
}
