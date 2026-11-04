import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { acceptInvitation } from "@/features/invitations/accept-invitation";
import { createInvitation } from "@/features/invitations/create-invitation";
import { createInviteAccount } from "@/features/invitations/invite-account";
import { INVALID_INVITATION_MESSAGE, getInvitationPreview } from "@/features/invitations/invitation-preview";
import { prisma } from "../support/db";
import { createAccount, createConsentDocument, createPatientRecord, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

async function invited() {
  await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const patient = await createPatientRecord(pro.id, { firstName: "Carlos" });
  const result = await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
  if (!result.ok) throw new Error(result.error);
  return { pro, patient, token: result.token };
}

const accept = (token: string, userId: string, consentChecked = true, at = now, documentVersion = "test-v1") =>
  acceptInvitation({ token, userId, consentChecked, documentVersion, now: at, ip: "203.0.113.7", userAgent: "vitest" });

describe("aceptar invitación", () => {
  it("previsualiza una invitación válida", async () => {
    const { token } = await invited();
    expect(await getInvitationPreview(token, now)).toEqual({ state: "VALID", patientFirstName: "Carlos", professionalName: "Dra. Ruiz" });
    expect(await getInvitationPreview("token-falso", now)).toEqual({ state: "NOT_FOUND" });
  });

  it("vincula, agrega PATIENT, guarda consentimiento y audita atómicamente", async () => {
    const { patient, token } = await invited();
    const account = await createAccount();
    expect(await accept(token, account.id)).toEqual({ ok: true, patientId: patient.id });

    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBe(account.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).roles).toEqual(["PATIENT"]);
    const consent = await prisma.patientConsent.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(consent).toMatchObject({ userId: account.id, ip: "203.0.113.7", userAgent: "vitest", revokedAt: null });
    expect(await prisma.auditLog.count({ where: { action: { in: ["INVITATION_ACCEPTED", "CONSENT_GRANTED"] } } })).toBe(2);
  });

  it("rechaza si la versión mostrada ya no es la vigente", async () => {
    const { patient, token } = await invited();
    const account = await createAccount();
    expect(await accept(token, account.id, true, now, "version-vieja")).toEqual({
      ok: false,
      error: "El texto de la autorización se actualizó. Recarga la página y revisa la nueva versión.",
    });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBeNull();
    expect(await prisma.patientConsent.count({ where: { patientId: patient.id } })).toBe(0);
  });

  it("un enlace ya usado no crea más cuentas", async () => {
    const { token } = await invited();
    const account = await createAccount();
    expect((await accept(token, account.id)).ok).toBe(true);
    const input = { name: "Otro", email: "otro@test.co", password: "Secreta1" };
    expect(await createInviteAccount(input, token, now)).toEqual({ ok: false, error: INVALID_INVITATION_MESSAGE });
    expect(await prisma.user.count({ where: { email: "otro@test.co" } })).toBe(0);
  });

  it("sin consentimiento no vincula", async () => {
    const { patient, token } = await invited();
    const account = await createAccount();
    expect(await accept(token, account.id, false)).toEqual({ ok: false, error: "Debes aceptar la autorización para continuar" });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBeNull();
  });

  it("el enlace es de un solo uso y vence", async () => {
    const { token } = await invited();
    await accept(token, (await createAccount()).id);
    expect(await accept(token, (await createAccount()).id)).toEqual({ ok: false, error: INVALID_INVITATION_MESSAGE });

    const second = await invited();
    expect(await accept(second.token, (await createAccount()).id, true, new Date("2026-12-01T00:00:00Z"))).toEqual({
      ok: false,
      error: INVALID_INVITATION_MESSAGE,
    });
  });

  it("el profesional no puede aceptar su propia invitación", async () => {
    const { pro, token } = await invited();
    expect(await accept(token, pro.id)).toEqual({ ok: false, error: "No puedes vincular tu propia cuenta a una ficha de tu consulta" });
  });

  it("una cuenta no se vincula a dos fichas del mismo profesional", async () => {
    await createConsentDocument("v-extra");
    const pro = await createProfessional();
    const account = await createAccount();
    const first = await createPatientRecord(pro.id);
    const second = await createPatientRecord(pro.id);
    const t1 = await createInvitation({ actor: proActor(pro.id), patientId: first.id, now, ip: null });
    const t2 = await createInvitation({ actor: proActor(pro.id), patientId: second.id, now, ip: null });
    if (!t1.ok || !t2.ok) throw new Error("setup");
    expect((await accept(t1.token, account.id, true, now, "v-extra")).ok).toBe(true);
    expect(await accept(t2.token, account.id, true, now, "v-extra")).toEqual({ ok: false, error: "Tu cuenta ya está vinculada a otra ficha de este profesional" });
  });

  it("crea cuenta de invitado sin roles y rechaza email existente", async () => {
    const { token } = await invited();
    const input = { name: "Carlos Ruiz", email: "Carlos@Test.co", password: "Secreta1" };
    expect(await createInviteAccount(input, token, now)).toEqual({ ok: true, email: "carlos@test.co" });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "carlos@test.co" } })).roles).toEqual([]);
    expect(await createInviteAccount(input, token, now)).toEqual({
      ok: false,
      error: "Ya existe una cuenta con este email. Inicia sesión para continuar.",
    });
    expect(await createInviteAccount(input, "token-falso", now)).toEqual({ ok: false, error: INVALID_INVITATION_MESSAGE });
  });

  it("dos aceptaciones simultáneas del mismo enlace: exactamente una tiene éxito", async () => {
    const { patient, token } = await invited();
    const accounts = await Promise.all([createAccount(), createAccount(), createAccount(), createAccount()]);
    const results = await Promise.all(accounts.map((a) => accept(token, a.id)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(3);
    expect(await prisma.patientConsent.count({ where: { patientId: patient.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { patientId: patient.id, action: "INVITATION_ACCEPTED" } })).toBe(1);
    const winner = results.findIndex((r) => r.ok);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBe(accounts[winner]!.id);
    for (const [i, account] of accounts.entries()) {
      const roles = (await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).roles;
      expect(roles).toEqual(i === winner ? ["PATIENT"] : []);
    }
  });

  it("la misma cuenta aceptando dos fichas del mismo profesional a la vez: sólo una se vincula", async () => {
    await createConsentDocument();
    const pro = await createProfessional();
    const account = await createAccount();
    const tokens: string[] = [];
    for (let i = 0; i < 2; i++) {
      const p = await createPatientRecord(pro.id);
      const r = await createInvitation({ actor: proActor(pro.id), patientId: p.id, now, ip: null });
      if (!r.ok) throw new Error("setup");
      tokens.push(r.token);
    }
    const results = await Promise.all(tokens.map((t) => accept(t, account.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.patient.count({ where: { professionalId: pro.id, userId: account.id } })).toBe(1);
    expect(await prisma.patientConsent.count({ where: { userId: account.id } })).toBe(1);
  });

  it("registros simultáneos con el mismo email: uno crea la cuenta, el resto recibe el error de email existente", async () => {
    const { token } = await invited();
    const input = { name: "Carlos Ruiz", email: "carrera@test.co", password: "Secreta1" };
    const results = await Promise.all([1, 2, 3].map(() => createInviteAccount(input, token, now)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error.startsWith("Ya existe una cuenta"))).toBe(true);
  });

  it("no guarda el token en bruto en la auditoría ni en el consentimiento", async () => {
    const { patient, token } = await invited();
    await accept(token, (await createAccount()).id);
    const logs = await prisma.auditLog.findMany({ where: { patientId: patient.id } });
    const consents = await prisma.patientConsent.findMany({ where: { patientId: patient.id } });
    expect(JSON.stringify([logs, consents])).not.toContain(token);
  });
});
