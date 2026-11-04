import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { revokeConsent } from "@/features/consent/revoke-consent";
import { getInvitationStatus } from "@/features/invitations/invitation-status";
import { getMyProfessionals } from "@/features/portal/my-professionals";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function linked() {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  return { pro, account, patient };
}

describe("revocar consentimiento", () => {
  it("el portal lista los profesionales vinculados", async () => {
    const { account, patient } = await linked();
    const list = await getMyProfessionals(account.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ patientId: patient.id, professionalName: "Dra. Ruiz" });
  });

  it("revocar desvincula, marca el consentimiento y audita; la ficha se conserva", async () => {
    const { account, patient } = await linked();
    expect(await revokeConsent({ actor: patientActor(account.id), patientId: patient.id, now, ip: null })).toEqual({ ok: true });

    const after = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.userId).toBeNull();
    expect((await prisma.patientConsent.findFirstOrThrow({ where: { patientId: patient.id } })).revokedAt).toEqual(now);
    expect(await prisma.auditLog.count({ where: { action: "CONSENT_REVOKED", patientId: patient.id } })).toBe(1);
    expect(await getMyProfessionals(account.id)).toEqual([]);
    expect(await getInvitationStatus(patient.id, now)).toEqual({ state: "REVOKED_BY_PATIENT" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).roles).toEqual(["PATIENT"]);
  });

  it("no se revoca el consentimiento de otra cuenta", async () => {
    const { patient } = await linked();
    const intruder = await createPatientUser();
    expect(await revokeConsent({ actor: patientActor(intruder.id), patientId: patient.id, now, ip: null })).toEqual({
      ok: false,
      error: "No autorizado",
    });
  });
});
