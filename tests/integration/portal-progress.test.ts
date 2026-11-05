import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { buildPortalAssessment, buildPortalProgress } from "@/features/portal/portal-view";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function assessment(patientId: string, professionalId: string, date: string, waistCm: number, weightKg: number) {
  return prisma.assessment.create({
    data: {
      type: "FOLLOW_UP",
      assessmentDate: new Date(date),
      reason: "Control",
      notes: "NOTA PRIVADA",
      patientId,
      professionalId,
      anthropometry: { create: { weightKg, heightCm: 165, waistCm, anthropometryNotes: "NOTA ANTRO" } },
      nutritionalGoal: {
        create: {
          bmi: Math.round((weightKg / 1.65 ** 2) * 10) / 10,
          bmiCategory: "OVERWEIGHT",
          tmbKcal: 1400,
          targetKcal: 1700,
          proteinG: 106,
          carbsG: 212,
          fatG: 47,
          waterMlPerDay: 2100,
          nutritionalDiagnosis: "Sobrepeso",
          cie10Code: "E66.3",
        },
      },
    },
  });
}

async function linkedWithProgress(progressMessagesEnabled = true) {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id, firstName: "María" });
  await prisma.patient.update({ where: { id: patient.id }, data: { progressMessagesEnabled } });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  const first = await assessment(patient.id, pro.id, "2026-07-01T00:00:00Z", 85, 75.5);
  const last = await assessment(patient.id, pro.id, "2026-08-20T00:00:00Z", 82, 73.2);
  await prisma.mealPlan.create({
    data: { name: "Borrador", status: "DRAFT", patientInstructions: "BORRADOR", notes: "NOTA PLAN", patientId: patient.id, professionalId: pro.id, assessmentId: last.id },
  });
  await prisma.mealPlan.create({
    data: {
      name: "Plan", status: "ACTIVE", activatedAt: new Date("2026-08-21T15:00:00Z"), patientInstructions: "Camina 20 minutos",
      notes: "NOTA PLAN", patientId: patient.id, professionalId: pro.id, assessmentId: last.id,
    },
  });
  return { pro, account, patient, first, last };
}

describe("progreso del portal", () => {
  it("lista valoraciones recientes primero, gráfica cronológica y metas del plan activo", async () => {
    const { account, first, last } = await linkedWithProgress();
    const view = await buildPortalProgress(patientActor(account.id), null);
    expect(view?.showMeasures).toBe(true);
    expect(view?.assessments.map((a) => a.id)).toEqual([last.id, first.id]);
    expect(view?.timeline.map((p) => p.waistCm)).toEqual([85, 82]);
    expect(view?.goals).toEqual({ targetKcal: 1700, proteinG: 106, carbsG: 212, fatG: 47, proteinPct: 25, carbsPct: 50, fatPct: 25, waterMlPerDay: 2100 });
  });

  it("nunca expone notas internas", async () => {
    const { account, last } = await linkedWithProgress();
    const progress = JSON.stringify(await buildPortalProgress(patientActor(account.id), null));
    const detail = JSON.stringify(await buildPortalAssessment(patientActor(account.id), last.id));
    for (const text of [progress, detail]) {
      expect(text).not.toContain("NOTA PRIVADA");
      expect(text).not.toContain("NOTA ANTRO");
      expect(text).not.toContain("NOTA PLAN");
    }
  });

  it("con el interruptor apagado oculta medidas pero deja metas y lista", async () => {
    const { account, last } = await linkedWithProgress(false);
    const view = await buildPortalProgress(patientActor(account.id), null);
    expect(view?.showMeasures).toBe(false);
    expect(view?.timeline).toEqual([]);
    expect(view?.goals?.targetKcal).toBe(1700);
    expect(view?.assessments).toHaveLength(2);
    const detail = await buildPortalAssessment(patientActor(account.id), last.id);
    expect(detail?.measures).toBeNull();
    expect(detail?.diagnosis).toBeNull();
    expect(detail?.instructions).toBe("Camina 20 minutos");
  });

  it("el detalle muestra medidas, diagnóstico e indicaciones del plan no borrador", async () => {
    const { account, last } = await linkedWithProgress();
    const detail = await buildPortalAssessment(patientActor(account.id), last.id);
    expect(detail).toMatchObject({
      id: last.id,
      type: "FOLLOW_UP",
      professionalName: "Dra. Ruiz",
      instructions: "Camina 20 minutos",
      diagnosis: { text: "Sobrepeso", cie10Code: "E66.3" },
    });
    expect(detail?.measures).toMatchObject({ weightKg: 73.2, heightCm: 165, waistCm: 82, bmi: 26.9 });
  });

  it("no permite abrir la valoración de otro paciente", async () => {
    const mine = await linkedWithProgress();
    const other = await linkedWithProgress();
    expect(await buildPortalAssessment(patientActor(mine.account.id), other.last.id)).toBeNull();
  });

  it("sin consentimiento vigente no hay progreso ni detalle", async () => {
    const { account, patient, last } = await linkedWithProgress();
    await prisma.patientConsent.updateMany({ where: { patientId: patient.id }, data: { revokedAt: new Date() } });
    expect(await buildPortalProgress(patientActor(account.id), null)).toBeNull();
    expect(await buildPortalAssessment(patientActor(account.id), last.id)).toBeNull();
  });

  it("un actor fuera del área paciente no obtiene nada", async () => {
    const { account, last } = await linkedWithProgress();
    const asPro: Actor = { userId: account.id, roles: ["PATIENT"], activeArea: "PROFESSIONAL", professionalStatus: null };
    expect(await buildPortalProgress(asPro, null)).toBeNull();
    expect(await buildPortalAssessment(asPro, last.id)).toBeNull();
  });
});
