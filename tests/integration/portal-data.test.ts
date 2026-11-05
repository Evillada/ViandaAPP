import { describe, expect, it } from "vitest";
import { getActivePlan, getAppointments, getPortalRecords, getProgressSnapshot, pickRecord } from "@/features/portal/portal-data";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T15:00:00Z");

async function linked(name = "Dra. Ruiz") {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id, firstName: "María" });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  return { pro, account, patient };
}

async function foodId() {
  const category = await prisma.foodCategory.upsert({ where: { slug: "t-cat" }, update: {}, create: { name: "T cat", slug: "t-cat" } });
  const energy = await prisma.nutrient.upsert({ where: { name: "Energía" }, update: {}, create: { name: "Energía", unit: "kcal", category: "ENERGY" } });
  const food = await prisma.food.create({ data: { name: "Arroz T", categoryId: category.id, nutrients: { create: { nutrientId: energy.id, amountPer100g: 130 } } } });
  return food.id;
}

describe("lecturas del portal", () => {
  it("sólo lista fichas propias con autorización vigente", async () => {
    const { account, patient } = await linked();
    const other = await linked("Otro");
    await prisma.patientConsent.updateMany({ where: { patientId: other.patient.id }, data: { revokedAt: now } });
    const records = await getPortalRecords(account.id);
    expect(records.map((r) => r.patientId)).toEqual([patient.id]);
    expect(records[0]).toMatchObject({ firstName: "María", professionalName: "Dra. Ruiz", progressMessagesEnabled: true });
    expect(await getPortalRecords(other.account.id)).toEqual([]);
  });

  it("pickRecord respeta el pedido sólo si está en la lista", async () => {
    const { account, patient } = await linked();
    const records = await getPortalRecords(account.id);
    expect(pickRecord(records, patient.id)?.patientId).toBe(patient.id);
    expect(pickRecord(records, "ajeno")?.patientId).toBe(patient.id);
    expect(pickRecord([], null)).toBeNull();
  });

  it("devuelve sólo el plan activo, con totales por día y sin notas", async () => {
    const { pro, patient } = await linked();
    const food = await foodId();
    await prisma.mealPlan.create({ data: { name: "Borrador", patientId: patient.id, professionalId: pro.id, status: "DRAFT", notes: "privado" } });
    await prisma.mealPlan.create({
      data: {
        name: "Plan activo", patientId: patient.id, professionalId: pro.id, status: "ACTIVE", notes: "nota interna",
        activatedAt: new Date("2026-11-02T15:00:00Z"), patientInstructions: "Toma agua",
        days: {
          create: [
            { name: "Día 1", orderNum: 1, meals: { create: { type: "LUNCH", orderNum: 1, items: { create: { foodId: food, portionGrams: 200, quantity: 1 } } } } },
            { name: "Día 2", orderNum: 2, meals: { create: { type: "DINNER", orderNum: 1 } } },
          ],
        },
      },
    });
    const plan = await getActivePlan(patient.id);
    expect(plan?.name).toBe("Plan activo");
    expect(plan?.patientInstructions).toBe("Toma agua");
    expect(plan?.days.map((d) => d.name)).toEqual(["Día 1", "Día 2"]);
    expect(plan?.days[0]?.totals.energyKcal).toBe(260);
    expect(plan?.days[0]?.meals[0]?.items[0]).toMatchObject({ foodName: "Arroz T", grams: 200, kcal: 260 });
    expect(JSON.stringify(plan)).not.toContain("nota interna");
  });

  it("sin plan activo devuelve null", async () => {
    const { patient } = await linked();
    expect(await getActivePlan(patient.id)).toBeNull();
  });

  it("separa citas próximas e historial", async () => {
    const { pro, patient } = await linked();
    await prisma.appointment.createMany({
      data: [
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-11-06T15:00:00Z"), status: "SCHEDULED" },
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-11-10T15:00:00Z"), status: "SCHEDULED" },
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-10-01T15:00:00Z"), status: "COMPLETED" },
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-11-08T15:00:00Z"), status: "CANCELLED" },
      ],
    });
    const { upcoming, past } = await getAppointments(patient.id, now);
    expect(upcoming.map((a) => a.date.toISOString())).toEqual(["2026-11-06T15:00:00.000Z", "2026-11-10T15:00:00.000Z"]);
    expect(past.map((a) => a.status)).toEqual(["CANCELLED", "COMPLETED"]);
  });

  it("el resumen de progreso compara las dos últimas valoraciones", async () => {
    const { pro, patient } = await linked();
    for (const [date, weightKg, waistCm] of [["2026-09-01", 80, 95], ["2026-10-01", 78, 92]] as const) {
      await prisma.assessment.create({
        data: {
          patientId: patient.id, professionalId: pro.id, reason: "control", assessmentDate: new Date(date),
          anthropometry: { create: { weightKg, heightCm: 165, waistCm } },
          nutritionalGoal: { create: { bmi: 29, bmiCategory: "OVERWEIGHT", tmbKcal: 1500, targetKcal: 1800, proteinG: 100, carbsG: 200, fatG: 60 } },
        },
      });
    }
    expect(await getProgressSnapshot(patient.id)).toEqual({
      bmiCategory: "OVERWEIGHT",
      latest: { weightKg: 78, waistCm: 92 },
      previous: { weightKg: 80, waistCm: 95 },
    });
  });
});
