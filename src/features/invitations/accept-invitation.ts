import { Prisma } from "@prisma/client";
import { invitationState } from "@/core/invitations/invitation-token";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";
import { getCurrentConsentDocument } from "@/features/consent/consent-documents";
import { INVALID_INVITATION_MESSAGE, findInvitationByToken } from "./invitation-preview";

class InvitationClaimError extends Error {}

export async function acceptInvitation(input: {
  token: string;
  userId: string;
  consentChecked: boolean;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ ok: true; patientId: string } | { ok: false; error: string }> {
  if (!input.consentChecked) return { ok: false, error: "Debes aceptar la autorización para continuar" };

  const invitation = await findInvitationByToken(input.token);
  if (!invitation || invitationState(invitation, input.now) !== "VALID") return { ok: false, error: INVALID_INVITATION_MESSAGE };

  const { patient } = invitation;
  if (patient.professionalId === input.userId) {
    return { ok: false, error: "No puedes vincular tu propia cuenta a una ficha de tu consulta" };
  }
  if (patient.userId) return { ok: false, error: "Esta ficha ya está vinculada a una cuenta" };

  const alreadyLinked = await prisma.patient.findFirst({
    where: { professionalId: patient.professionalId, userId: input.userId },
    select: { id: true },
  });
  if (alreadyLinked) return { ok: false, error: "Tu cuenta ya está vinculada a otra ficha de este profesional" };

  const document = await getCurrentConsentDocument(input.now);
  if (!document) return { ok: false, error: "No hay un documento de consentimiento vigente. Contacta a soporte." };

  try {
    await prisma.$transaction(async (tx) => {
      // Single-use claim: only one concurrent accept can flip acceptedAt from null.
      const claimed = await tx.patientInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: input.now } },
        data: { acceptedAt: input.now, acceptedById: input.userId },
      });
      if (claimed.count !== 1) throw new InvitationClaimError();

      const linked = await tx.patient.updateMany({ where: { id: patient.id, userId: null }, data: { userId: input.userId } });
      if (linked.count !== 1) throw new InvitationClaimError();

      const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { roles: true } });
      await tx.user.update({
        where: { id: input.userId },
        data: { lastArea: "PATIENT", ...(user.roles.includes("PATIENT") ? {} : { roles: { push: "PATIENT" } }) },
      });

      const consent = await tx.patientConsent.create({
        data: { patientId: patient.id, userId: input.userId, documentId: document.id, ip: input.ip, userAgent: input.userAgent },
        select: { id: true },
      });

      await recordAudit(
        { actorId: input.userId, actorRole: "PATIENT", action: "INVITATION_ACCEPTED", entityType: "PatientInvitation", entityId: invitation.id, patientId: patient.id, ip: input.ip },
        tx
      );
      await recordAudit(
        {
          actorId: input.userId,
          actorRole: "PATIENT",
          action: "CONSENT_GRANTED",
          entityType: "PatientConsent",
          entityId: consent.id,
          patientId: patient.id,
          metadata: { documentVersion: document.version },
          ip: input.ip,
        },
        tx
      );
    });
  } catch (error) {
    if (error instanceof InvitationClaimError) return { ok: false, error: INVALID_INVITATION_MESSAGE };
    // (professionalId, userId) is unique: the same account accepting two of this professional's invitations at once.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Tu cuenta ya está vinculada a otra ficha de este profesional" };
    }
    throw error;
  }

  return { ok: true, patientId: patient.id };
}
