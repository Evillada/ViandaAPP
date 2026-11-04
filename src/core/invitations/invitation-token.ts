import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_DAYS = 7;

export type InvitationState = "VALID" | "EXPIRED" | "USED" | "REVOKED";

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function invitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now: Date
): InvitationState {
  if (invitation.acceptedAt) return "USED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "VALID";
}
