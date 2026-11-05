import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { changePassword, deleteAccount, getAccountOverview, updatePatientPhone } from "@/features/portal/account";
import { verifyCredentials } from "@/features/identity/verify-credentials";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function linkRecord(accountId: string, professionalId: string, firstName = "Ana") {
  const document = await createConsentDocument();
  const patient = await createPatientRecord(professionalId, { userId: accountId, firstName });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: accountId, documentId: document.id } });
  return patient;
}

async function accountWithPassword(password: string) {
  const user = await createPatientUser();
  return prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 4) } });
}

describe("getAccountOverview", () => {
  it("devuelve ficha vinculada, profesional y paquetes con estado calculado", async () => {
    const pro = await createProfessional({ name: "Dra. Ruiz" });
    const account = await createPatientUser();
    const patient = await linkRecord(account.id, pro.id);
    await prisma.patient.update({
      where: { id: patient.id },
      data: { phone: "+57 300 1234567", documentId: "123", notes: "nota privada" },
    });
    await prisma.servicePackage.create({
      data: {
        name: "Vencido",
        includedSessions: 4,
        startsAt: new Date("2026-08-01T00:00:00Z"),
        endsAt: new Date("2026-09-01T00:00:00Z"),
        patientId: patient.id,
        professionalId: pro.id,
      },
    });
    await prisma.servicePackage.create({
      data: {
        name: "Vigente",
        startsAt: new Date("2026-10-01T00:00:00Z"),
        patientId: patient.id,
        professionalId: pro.id,
      },
    });

    const overview = await getAccountOverview(account.id, now);
    expect(overview.email).toBe(account.email);
    expect(overview.records).toHaveLength(1);
    const record = overview.records[0];
    expect(record).toMatchObject({
      patientId: patient.id,
      professionalName: "Dra. Ruiz",
      firstName: "Ana",
      lastName: "Paciente",
      documentId: "123",
      sex: "FEMALE",
      phone: "+57 300 1234567",
    });
    expect(record.grantedAt).toBeInstanceOf(Date);
    expect(record.dateOfBirth).toEqual(new Date("1990-01-01"));
    expect(record.packages.map((p) => [p.name, p.status])).toEqual([
      ["Vigente", "ACTIVE"],
      ["Vencido", "EXPIRED"],
    ]);
    expect(JSON.stringify(overview)).not.toContain("nota privada");
  });

  it("excluye fichas sin consentimiento vigente y fichas de otras cuentas", async () => {
    const pro = await createProfessional();
    const account = await createPatientUser();
    const other = await createPatientUser();
    const mine = await linkRecord(account.id, pro.id, "Mia");
    const revoked = await linkRecord(account.id, (await createProfessional()).id, "Revocada");
    await prisma.patientConsent.updateMany({ where: { patientId: revoked.id }, data: { revokedAt: now } });
    const noConsent = await createPatientRecord((await createProfessional()).id, { userId: account.id, firstName: "SinConsentimiento" });
    await linkRecord(other.id, pro.id, "Ajena");

    const overview = await getAccountOverview(account.id, now);
    expect(overview.records.map((r) => r.patientId)).toEqual([mine.id]);
    expect(overview.records.map((r) => r.patientId)).not.toContain(noConsent.id);
  });
});

describe("updatePatientPhone", () => {
  it("actualiza todas las fichas vinculadas y audita una vez por ficha sin el número", async () => {
    const account = await createPatientUser();
    const other = await createPatientUser();
    const a = await linkRecord(account.id, (await createProfessional()).id, "Una");
    const b = await linkRecord(account.id, (await createProfessional()).id, "Dos");
    const foreign = await linkRecord(other.id, (await createProfessional()).id, "Ajena");

    expect(await updatePatientPhone(patientActor(account.id), "  +57 (300) 123-4567 ", "1.2.3.4")).toEqual({ ok: true });

    for (const id of [a.id, b.id]) {
      expect((await prisma.patient.findUniqueOrThrow({ where: { id } })).phone).toBe("+57 (300) 123-4567");
      const logs = await prisma.auditLog.findMany({ where: { action: "PATIENT_PHONE_UPDATED", patientId: id } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ actorId: account.id, actorRole: "PATIENT", entityType: "Patient", ip: "1.2.3.4" });
      expect(JSON.stringify(logs[0].metadata ?? {})).not.toContain("300");
    }
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: foreign.id } })).phone).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "PATIENT_PHONE_UPDATED", patientId: foreign.id } })).toBe(0);
  });

  it("rechaza un teléfono inválido sin cambiar nada", async () => {
    const account = await createPatientUser();
    const record = await linkRecord(account.id, (await createProfessional()).id);
    expect(await updatePatientPhone(patientActor(account.id), "abc", null)).toEqual({ ok: false, error: "Teléfono inválido" });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: record.id } })).phone).toBeNull();
  });

  it("un teléfono vacío lo deja en null", async () => {
    const account = await createPatientUser();
    const record = await linkRecord(account.id, (await createProfessional()).id);
    await prisma.patient.update({ where: { id: record.id }, data: { phone: "3001234567" } });
    expect(await updatePatientPhone(patientActor(account.id), "   ", null)).toEqual({ ok: true });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: record.id } })).phone).toBeNull();
  });

  it("una cuenta sin fichas vinculadas recibe error", async () => {
    const account = await createPatientUser();
    expect(await updatePatientPhone(patientActor(account.id), "3001234567", null)).toEqual({
      ok: false,
      error: "No tienes fichas vinculadas",
    });
  });

  it("requiere el área de paciente", async () => {
    const account = await createPatientUser();
    await linkRecord(account.id, (await createProfessional()).id);
    const actor: Actor = { ...patientActor(account.id), activeArea: "PROFESSIONAL" };
    expect((await updatePatientPhone(actor, "3001234567", null)).ok).toBe(false);
  });
});

describe("changePassword", () => {
  it("rechaza contraseña actual incorrecta, corta o igual", async () => {
    const account = await accountWithPassword("actual-123");
    const actor = patientActor(account.id);
    expect(await changePassword(actor, "mala", "nueva-123", null)).toEqual({
      ok: false,
      error: "La contraseña actual no es correcta",
    });
    expect(await changePassword(actor, "actual-123", "123", null)).toEqual({
      ok: false,
      error: "La contraseña debe tener al menos 6 caracteres",
    });
    expect(await changePassword(actor, "actual-123", "actual-123", null)).toEqual({
      ok: false,
      error: "La nueva contraseña debe ser diferente",
    });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.password).toBe(account.password);
    expect(await prisma.auditLog.count({ where: { action: "PASSWORD_CHANGED", entityId: account.id } })).toBe(0);
  });

  it("con la contraseña correcta cambia el hash y audita", async () => {
    const account = await accountWithPassword("actual-123");
    expect(await changePassword(patientActor(account.id), "actual-123", "nueva-456", "9.9.9.9")).toEqual({ ok: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(after.password).not.toBe(account.password);
    expect(await bcrypt.compare("nueva-456", after.password!)).toBe(true);
    const logs = await prisma.auditLog.findMany({ where: { action: "PASSWORD_CHANGED", entityId: account.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorId: account.id, actorRole: "PATIENT", entityType: "User", ip: "9.9.9.9" });
  });
});

describe("deleteAccount", () => {
  it("sin ELIMINAR no cambia nada", async () => {
    const account = await accountWithPassword("actual-123");
    const patient = await linkRecord(account.id, (await createProfessional()).id);
    expect(await deleteAccount(patientActor(account.id), "eliminar ya", null, now)).toEqual({
      ok: false,
      error: "Escribe ELIMINAR para confirmar",
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(user.deletedAt).toBeNull();
    expect(user.email).toBe(account.email);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBe(account.id);
    expect(await prisma.patientConsent.count({ where: { userId: account.id, revokedAt: null } })).toBe(1);
  });

  it("con ELIMINAR anonimiza la cuenta, desvincula fichas y conserva los datos clínicos", async () => {
    const account = await accountWithPassword("actual-123");
    const pro = await createProfessional();
    const patient = await linkRecord(account.id, pro.id);
    await prisma.assessment.create({
      data: { reason: "Control", patientId: patient.id, professionalId: pro.id },
    });
    await prisma.account.create({
      data: { userId: account.id, type: "oauth", provider: "google", providerAccountId: `g-${account.id}` },
    });
    await prisma.session.create({
      data: { userId: account.id, sessionToken: `s-${account.id}`, expires: new Date("2027-01-01T00:00:00Z") },
    });

    expect(await deleteAccount(patientActor(account.id), " ELIMINAR ", "5.5.5.5", now)).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(user).toMatchObject({
      email: `deleted-${account.id}@deleted.invalid`,
      name: null,
      password: null,
      image: null,
      emailVerified: null,
      roles: [],
      lastArea: null,
      deletedAt: now,
    });
    expect((await prisma.patientConsent.findFirstOrThrow({ where: { patientId: patient.id } })).revokedAt).toEqual(now);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBeNull();
    expect(await prisma.assessment.count({ where: { patientId: patient.id } })).toBe(1);
    expect(await prisma.account.count({ where: { userId: account.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: account.id } })).toBe(0);

    const logs = await prisma.auditLog.findMany({ where: { action: "ACCOUNT_DELETED", entityId: account.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorId: account.id, actorRole: "PATIENT", entityType: "User", ip: "5.5.5.5" });
    expect(logs[0].metadata).toEqual({ revokedConsents: 1, unlinkedRecords: 1 });
    const consentLogs = await prisma.auditLog.findMany({ where: { action: "CONSENT_REVOKED", patientId: patient.id } });
    expect(consentLogs).toHaveLength(1);
    expect(consentLogs[0]).toMatchObject({ actorId: account.id, actorRole: "PATIENT", entityType: "PatientConsent", ip: "5.5.5.5" });
    expect(consentLogs[0].metadata).toEqual({ reason: "account_deleted" });

    expect(await prisma.user.findUnique({ where: { email: account.email } })).toBeNull();
    expect(await verifyCredentials(account.email, "actual-123", null)).toBeNull();
  });

  it("una cuenta con acceso profesional no se puede eliminar y nada cambia", async () => {
    const pro = await createProfessional({ extraRoles: ["PATIENT"] });
    const patient = await linkRecord(pro.id, (await createProfessional()).id);
    const message = "Esta cuenta también tiene acceso profesional. Escríbenos para eliminarla.";
    expect(await deleteAccount(patientActor(pro.id), "ELIMINAR", null, now)).toEqual({ ok: false, error: message });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: pro.id } });
    expect(user.deletedAt).toBeNull();
    expect(user.email).toBe(pro.email);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBe(pro.id);
    expect(await prisma.patientConsent.count({ where: { userId: pro.id, revokedAt: null } })).toBe(1);
  });
});
