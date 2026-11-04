import { hashInvitationToken, invitationState } from "@/core/invitations/invitation-token";
import { prisma } from "@/infrastructure/database/prisma";

export const INVALID_INVITATION_MESSAGE = "Este enlace ya no es válido. Pide un enlace nuevo a tu nutricionista.";

export type InvitationPreview =
  | { state: "NOT_FOUND" | "EXPIRED" | "USED" | "REVOKED" }
  | { state: "VALID"; patientFirstName: string; professionalName: string };

export async function findInvitationByToken(token: string) {
  return prisma.patientInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      patient: {
        select: { id: true, firstName: true, professionalId: true, userId: true, professional: { select: { name: true } } },
      },
    },
  });
}

export async function getInvitationPreview(token: string, now: Date): Promise<InvitationPreview> {
  const invitation = await findInvitationByToken(token);
  if (!invitation) return { state: "NOT_FOUND" };
  const state = invitationState(invitation, now);
  if (state !== "VALID") return { state };
  return {
    state: "VALID",
    patientFirstName: invitation.patient.firstName,
    professionalName: invitation.patient.professional.name ?? "Tu nutricionista",
  };
}
