import type { ProfessionalStatus } from "@prisma/client";
import { canReviewProfessionals } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import type { AuditAction } from "@/core/audit/audit";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export interface ProfessionalForReview {
  profileId: string;
  name: string | null;
  email: string;
  licenseNumber: string;
  /** Otro perfil (de cualquier estado) registró la misma tarjeta; `licenseNumber` no es único a propósito. */
  licenseShared: boolean;
  /** Es el perfil del propio admin: no puede revisarlo. */
  isOwn: boolean;
  status: ProfessionalStatus;
  createdAt: Date;
}

/** Ignora mayúsculas, espacios y signos para detectar la misma tarjeta escrita distinto. */
function normalizeLicense(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function listProfessionalsForReview(viewerId?: string): Promise<ProfessionalForReview[]> {
  const [profiles, allLicenses] = await Promise.all([
    prisma.professionalProfile.findMany({
      where: { status: { in: ["PENDING", "APPROVED", "SUSPENDED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.professionalProfile.findMany({ select: { licenseNumber: true } }),
  ]);

  const counts = new Map<string, number>();
  for (const { licenseNumber } of allLicenses) {
    const key = normalizeLicense(licenseNumber);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return profiles.map((p) => ({
    profileId: p.id,
    name: p.user.name,
    email: p.user.email,
    licenseNumber: p.licenseNumber,
    licenseShared: (counts.get(normalizeLicense(p.licenseNumber)) ?? 0) > 1,
    isOwn: p.userId === viewerId,
    status: p.status,
    createdAt: p.createdAt,
  }));
}

type Decision = "APPROVE" | "REJECT" | "SUSPEND";

const DECISIONS: Record<Decision, { status: ProfessionalStatus; action: AuditAction; from: ProfessionalStatus[] }> = {
  APPROVE: { status: "APPROVED", action: "PROFESSIONAL_APPROVED", from: ["PENDING", "SUSPENDED", "REJECTED"] },
  REJECT: { status: "REJECTED", action: "PROFESSIONAL_REJECTED", from: ["PENDING"] },
  SUSPEND: { status: "SUSPENDED", action: "PROFESSIONAL_SUSPENDED", from: ["APPROVED"] },
};

export async function reviewProfessional(input: {
  actor: Actor;
  profileId: string;
  decision: Decision;
  reason?: string;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canReviewProfessionals(input.actor)) return { ok: false, error: "No autorizado" };

  const reason = input.reason?.trim() ?? "";
  if (input.decision === "REJECT" && reason.length === 0) {
    return { ok: false, error: "Indica el motivo del rechazo" };
  }

  if (reason.length > 500) return { ok: false, error: "El motivo es demasiado largo (máximo 500 caracteres)" };

  const rule = DECISIONS[input.decision];
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: input.profileId },
    select: { id: true, userId: true, status: true },
  });
  if (!profile) return { ok: false, error: "Profesional no encontrado" };
  if (profile.userId === input.actor.userId) return { ok: false, error: "No puedes revisar tu propio perfil" };
  if (!rule.from.includes(profile.status)) return { ok: false, error: "Esta acción no aplica al estado actual" };

  return prisma.$transaction(async (tx) => {
    // El filtro por estado hace atómica la transición: si otro admin ya decidió, no se pisa su decisión.
    const updated = await tx.professionalProfile.updateMany({
      where: { id: profile.id, status: { in: rule.from } },
      data: {
        status: rule.status,
        reviewedById: input.actor.userId,
        reviewedAt: new Date(),
        rejectionReason: input.decision === "REJECT" ? reason : null,
      },
    });
    if (updated.count === 0) return { ok: false as const, error: "Esta acción no aplica al estado actual" };

    if (input.decision === "APPROVE") {
      const user = await tx.user.findUniqueOrThrow({ where: { id: profile.userId }, select: { roles: true } });
      if (!user.roles.includes("PROFESSIONAL")) {
        await tx.user.update({ where: { id: profile.userId }, data: { roles: { push: "PROFESSIONAL" } } });
      }
    }
    await recordAudit(
      {
        actorId: input.actor.userId,
        actorRole: "ADMIN",
        action: rule.action,
        entityType: "ProfessionalProfile",
        entityId: profile.id,
        metadata: reason ? { reason } : undefined,
        ip: input.ip,
      },
      tx
    );
    return { ok: true as const };
  });
}
