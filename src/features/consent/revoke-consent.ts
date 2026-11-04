import { canRevokeConsent } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export async function revokeConsent(input: {
  actor: Actor;
  patientId: string;
  now: Date;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, professionalId: true, userId: true },
  });
  if (!patient || !canRevokeConsent(input.actor, { ...patient, consentActive: true })) {
    return { ok: false, error: "No autorizado" };
  }

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.patientConsent.updateMany({
      where: { patientId: patient.id, userId: input.actor.userId, revokedAt: null },
      data: { revokedAt: input.now },
    });
    await tx.patient.update({ where: { id: patient.id }, data: { userId: null } });
    await recordAudit(
      {
        actorId: input.actor.userId,
        actorRole: "PATIENT",
        action: "CONSENT_REVOKED",
        entityType: "PatientConsent",
        patientId: patient.id,
        metadata: { revokedCount: revoked.count },
        ip: input.ip,
      },
      tx
    );
  });

  return { ok: true };
}
