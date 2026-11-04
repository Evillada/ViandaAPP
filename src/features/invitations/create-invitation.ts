import { canManageInvitations } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { generateInvitationToken, hashInvitationToken, invitationExpiry } from "@/core/invitations/invitation-token";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export async function createInvitation(input: {
  actor: Actor;
  patientId: string;
  now: Date;
  ip: string | null;
}): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: string }> {
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, professionalId: true, userId: true },
  });
  if (!patient || !canManageInvitations(input.actor, { professionalId: patient.professionalId, userId: patient.userId, consentActive: false })) {
    return { ok: false, error: "No autorizado" };
  }
  if (patient.userId) return { ok: false, error: "Esta ficha ya está vinculada a una cuenta" };

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry(input.now);

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.patientInvitation.updateMany({
      where: { patientId: patient.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: input.now },
    });
    if (revoked.count > 0) {
      await recordAudit(
        {
          actorId: input.actor.userId,
          actorRole: "PROFESSIONAL",
          action: "INVITATION_REVOKED",
          entityType: "PatientInvitation",
          patientId: patient.id,
          metadata: { count: revoked.count, reason: "replaced" },
          ip: input.ip,
        },
        tx
      );
    }
    const invitation = await tx.patientInvitation.create({
      data: {
        patientId: patient.id,
        tokenHash: hashInvitationToken(token),
        expiresAt,
        createdById: input.actor.userId,
      },
      select: { id: true },
    });
    await recordAudit(
      {
        actorId: input.actor.userId,
        actorRole: "PROFESSIONAL",
        action: "INVITATION_CREATED",
        entityType: "PatientInvitation",
        entityId: invitation.id,
        patientId: patient.id,
        ip: input.ip,
      },
      tx
    );
  });

  return { ok: true, token, expiresAt };
}
