import { describe, expect, it } from "vitest";
import { hashInvitationToken } from "@/core/invitations/invitation-token";
import type { Actor } from "@/core/access/types";
import { createInvitation } from "@/features/invitations/create-invitation";
import { getInvitationStatus } from "@/features/invitations/invitation-status";
import { prisma } from "../support/db";
import { createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

describe("createInvitation", () => {
  it("crea invitación con hash, vence en 7 días y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    const result = await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
    if (!result.ok) throw new Error(result.error);

    const stored = await prisma.patientInvitation.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(stored.tokenHash).toBe(hashInvitationToken(result.token));
    expect(stored.expiresAt.toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_CREATED", patientId: patient.id } })).toBe(1);
    expect(await getInvitationStatus(patient.id, now)).toEqual({ state: "PENDING", expiresAt: stored.expiresAt });
  });

  it("generar una nueva revoca la anterior", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
    await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
    const invitations = await prisma.patientInvitation.findMany({ where: { patientId: patient.id } });
    expect(invitations).toHaveLength(2);
    expect(invitations.filter((i) => i.revokedAt !== null)).toHaveLength(1);
    expect(invitations.filter((i) => i.revokedAt === null)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_REVOKED" } })).toBe(1);
  });

  it("no invita fichas ajenas ni ya vinculadas", async () => {
    const pro = await createProfessional();
    const other = await createProfessional();
    const foreign = await createPatientRecord(other.id);
    expect(await createInvitation({ actor: proActor(pro.id), patientId: foreign.id, now, ip: null })).toEqual({ ok: false, error: "No autorizado" });

    const account = await createPatientUser();
    const linked = await createPatientRecord(pro.id, { userId: account.id });
    expect(await createInvitation({ actor: proActor(pro.id), patientId: linked.id, now, ip: null })).toEqual({
      ok: false,
      error: "Esta ficha ya está vinculada a una cuenta",
    });
    expect(await getInvitationStatus(linked.id, now)).toEqual({ state: "LINKED" });
  });
});
