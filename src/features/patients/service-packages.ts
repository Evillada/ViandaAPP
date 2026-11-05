import type { ServicePackageStatus } from "@prisma/client";
import { canEditPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { endOfDayBogota, startOfDayBogota } from "@/core/portal/bogota-dates";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export interface ServicePackageInput {
  name: string;
  includedSessions: string;
  startsAt: string;
  endsAt: string;
  status?: string;
}

type Result = { ok: true } | { ok: false; error: string };

const STATUSES: readonly ServicePackageStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];
const MIN_NAME = 2;
const MAX_NAME = 80;
const MAX_SESSIONS = 200;

interface ParsedPackage {
  name: string;
  includedSessions: number | null;
  startsAt: Date;
  endsAt: Date | null;
  status: ServicePackageStatus | undefined;
}

function parseInput(input: ServicePackageInput): { ok: true; data: ParsedPackage } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) return { ok: false, error: `El nombre debe tener entre ${MIN_NAME} y ${MAX_NAME} caracteres` };

  const sessionsRaw = input.includedSessions.trim();
  let includedSessions: number | null = null;
  if (sessionsRaw) {
    includedSessions = /^\d+$/.test(sessionsRaw) ? Number(sessionsRaw) : NaN;
    if (!Number.isInteger(includedSessions) || includedSessions < 1 || includedSessions > MAX_SESSIONS) {
      return { ok: false, error: `Las consultas incluidas deben ser un entero entre 1 y ${MAX_SESSIONS}` };
    }
  }

  const startsAt = startOfDayBogota(input.startsAt.trim());
  if (!startsAt) return { ok: false, error: "Fecha de inicio inválida" };

  let endsAt: Date | null = null;
  if (input.endsAt.trim()) {
    endsAt = endOfDayBogota(input.endsAt.trim());
    if (!endsAt) return { ok: false, error: "Fecha de fin inválida" };
    if (endsAt.getTime() < startsAt.getTime()) return { ok: false, error: "La fecha de fin no puede ser anterior al inicio" };
  }

  let status: ServicePackageStatus | undefined;
  if (input.status !== undefined && input.status !== "") {
    if (!STATUSES.includes(input.status as ServicePackageStatus)) return { ok: false, error: "Estado inválido" };
    status = input.status as ServicePackageStatus;
  }

  return { ok: true, data: { name, includedSessions, startsAt, endsAt, status } };
}

export async function createServicePackage(actor: Actor, patientId: string, input: ServicePackageInput, ip: string | null): Promise<Result> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { professionalId: true, userId: true } });
  if (!patient || !canEditPatientRecord(actor, { ...patient, consentActive: false })) return { ok: false, error: "Paciente no encontrado" };

  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;
  const { status, ...data } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const created = await tx.servicePackage.create({
      data: { ...data, status: status ?? "ACTIVE", patientId, professionalId: patient.professionalId },
    });
    await recordAudit(
      { actorId: actor.userId, actorRole: "PROFESSIONAL", action: "SERVICE_PACKAGE_CHANGED", entityType: "ServicePackage", entityId: created.id, patientId, metadata: { change: "created" }, ip },
      tx
    );
  });
  return { ok: true };
}

/** Carga el paquete y verifica que el actor pueda editar la ficha de su paciente. */
async function findEditablePackage(actor: Actor, packageId: string) {
  const pkg = await prisma.servicePackage.findUnique({
    where: { id: packageId },
    select: { id: true, patientId: true, patient: { select: { professionalId: true, userId: true } } },
  });
  if (!pkg || !canEditPatientRecord(actor, { ...pkg.patient, consentActive: false })) return null;
  return pkg;
}

export async function updateServicePackage(actor: Actor, packageId: string, input: ServicePackageInput, ip: string | null): Promise<Result> {
  const pkg = await findEditablePackage(actor, packageId);
  if (!pkg) return { ok: false, error: "Paquete no encontrado" };

  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;
  const { status, ...data } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.servicePackage.update({ where: { id: pkg.id }, data: { ...data, ...(status && { status }) } });
    await recordAudit(
      { actorId: actor.userId, actorRole: "PROFESSIONAL", action: "SERVICE_PACKAGE_CHANGED", entityType: "ServicePackage", entityId: pkg.id, patientId: pkg.patientId, metadata: { change: "updated" }, ip },
      tx
    );
  });
  return { ok: true };
}

export async function deleteServicePackage(actor: Actor, packageId: string, ip: string | null): Promise<Result> {
  const pkg = await findEditablePackage(actor, packageId);
  if (!pkg) return { ok: false, error: "Paquete no encontrado" };

  await prisma.$transaction(async (tx) => {
    await tx.servicePackage.delete({ where: { id: pkg.id } });
    await recordAudit(
      { actorId: actor.userId, actorRole: "PROFESSIONAL", action: "SERVICE_PACKAGE_CHANGED", entityType: "ServicePackage", entityId: pkg.id, patientId: pkg.patientId, metadata: { change: "deleted" }, ip },
      tx
    );
  });
  return { ok: true };
}
