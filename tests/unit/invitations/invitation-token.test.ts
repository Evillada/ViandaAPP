import { describe, expect, it } from "vitest";
import {
  INVITATION_TTL_DAYS,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
} from "@/core/invitations/invitation-token";

const now = new Date("2026-11-04T12:00:00Z");

describe("tokens de invitación", () => {
  it("genera tokens base64url de 43 caracteres y distintos", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("el hash es SHA-256 hex, determinista y no contiene el token", () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInvitationToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("vence a los 7 días", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(invitationExpiry(now).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("invitationState", () => {
  const base = { expiresAt: invitationExpiry(now), acceptedAt: null, revokedAt: null };

  it("válida antes de vencer", () => {
    expect(invitationState(base, now)).toBe("VALID");
  });
  it("vencida en el instante de vencimiento", () => {
    expect(invitationState(base, base.expiresAt)).toBe("EXPIRED");
  });
  it("usada tiene prioridad sobre vencida", () => {
    expect(invitationState({ ...base, acceptedAt: now }, new Date("2027-01-01"))).toBe("USED");
  });
  it("revocada", () => {
    expect(invitationState({ ...base, revokedAt: now }, now)).toBe("REVOKED");
  });
});
