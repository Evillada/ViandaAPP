import { prisma } from "@/infrastructure/database/prisma";

export type InvitationStatus =
  | { state: "NONE" }
  | { state: "PENDING"; expiresAt: Date }
  | { state: "LINKED" }
  | { state: "REVOKED_BY_PATIENT" };

export async function getInvitationStatus(patientId: string, now: Date): Promise<InvitationStatus> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      userId: true,
      invitations: {
        where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
      consents: { where: { revokedAt: { not: null } }, take: 1, select: { id: true } },
    },
  });
  if (!patient) return { state: "NONE" };
  if (patient.userId) return { state: "LINKED" };
  const pending = patient.invitations[0];
  if (pending) return { state: "PENDING", expiresAt: pending.expiresAt };
  if (patient.consents.length > 0) return { state: "REVOKED_BY_PATIENT" };
  return { state: "NONE" };
}
