import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { MAX_PLAN_DAYS, addPlanDay, deletePlanDay, duplicatePlanDay, renamePlanDay, updatePlanInstructions } from "@/features/nutrition/plan-days";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

async function planWithItem() {
  const pro = await createProfessional();
  const patient = await createPatientRecord(pro.id);
  const category = await prisma.foodCategory.upsert({ where: { slug: "pd-cat" }, update: {}, create: { name: "PD cat", slug: "pd-cat" } });
  const food = await prisma.food.create({ data: { name: "Avena PD", categoryId: category.id } });
  const plan = await prisma.mealPlan.create({
    data: {
      name: "Plan", patientId: patient.id, professionalId: pro.id,
      days: { create: { name: "Día 1", orderNum: 1, meals: { create: { type: "BREAKFAST", orderNum: 1, items: { create: { foodId: food.id, portionGrams: 40, quantity: 1 } } } } } },
    },
    include: { days: true },
  });
  return { pro, plan, dayId: plan.days[0]!.id };
}

describe("días del plan", () => {
  it("agrega un día vacío con las tres comidas base y nombre consecutivo", async () => {
    const { pro, plan } = await planWithItem();
    const result = await addPlanDay(proActor(pro.id), plan.id);
    expect(result.ok).toBe(true);
    const days = await prisma.mealPlanDay.findMany({ where: { mealPlanId: plan.id }, orderBy: { orderNum: "asc" }, include: { meals: true } });
    expect(days.map((d) => d.name)).toEqual(["Día 1", "Día 2"]);
    expect(days[1]!.meals.map((m) => m.type).sort()).toEqual(["BREAKFAST", "DINNER", "LUNCH"]);
  });

  it("duplica un día copiando comidas e ítems", async () => {
    const { pro, plan, dayId } = await planWithItem();
    const result = await duplicatePlanDay(proActor(pro.id), plan.id, dayId);
    expect(result.ok).toBe(true);
    const copy = await prisma.mealPlanDay.findFirstOrThrow({ where: { mealPlanId: plan.id, orderNum: 2 }, include: { meals: { include: { items: true } } } });
    expect(copy.name).toBe("Día 1 (copia)");
    expect(copy.meals[0]!.items[0]!.portionGrams).toBe(40);
  });

  it(`no permite más de ${MAX_PLAN_DAYS} días`, async () => {
    const { pro, plan } = await planWithItem();
    for (let i = 1; i < MAX_PLAN_DAYS; i++) expect((await addPlanDay(proActor(pro.id), plan.id)).ok).toBe(true);
    expect(await addPlanDay(proActor(pro.id), plan.id)).toEqual({ ok: false, error: `Un plan puede tener máximo ${MAX_PLAN_DAYS} días` });
  });

  it("renombra y no deja eliminar el último día", async () => {
    const { pro, plan, dayId } = await planWithItem();
    expect((await renamePlanDay(proActor(pro.id), plan.id, dayId, "  Lunes  ")).ok).toBe(true);
    expect((await prisma.mealPlanDay.findUniqueOrThrow({ where: { id: dayId } })).name).toBe("Lunes");
    expect(await renamePlanDay(proActor(pro.id), plan.id, dayId, "   ")).toEqual({ ok: false, error: "El nombre no puede estar vacío" });
    expect(await deletePlanDay(proActor(pro.id), plan.id, dayId)).toEqual({ ok: false, error: "El plan debe tener al menos un día" });
  });

  it("elimina un día cuando hay más de uno", async () => {
    const { pro, plan, dayId } = await planWithItem();
    await addPlanDay(proActor(pro.id), plan.id);
    expect((await deletePlanDay(proActor(pro.id), plan.id, dayId)).ok).toBe(true);
    expect(await prisma.mealPlanDay.count({ where: { mealPlanId: plan.id } })).toBe(1);
  });

  it("guarda indicaciones para el paciente (recortadas, vacío = null, máx 2000)", async () => {
    const { pro, plan } = await planWithItem();
    expect((await updatePlanInstructions(proActor(pro.id), plan.id, "  Toma agua  ")).ok).toBe(true);
    expect((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).patientInstructions).toBe("Toma agua");
    await updatePlanInstructions(proActor(pro.id), plan.id, "   ");
    expect((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).patientInstructions).toBeNull();
    expect(await updatePlanInstructions(proActor(pro.id), plan.id, "x".repeat(2001))).toEqual({ ok: false, error: "Máximo 2000 caracteres" });
  });

  it("otro profesional no puede tocar el plan", async () => {
    const { plan, dayId } = await planWithItem();
    const intruder = await createProfessional();
    const denied = { ok: false, error: "Plan no encontrado" };
    expect(await addPlanDay(proActor(intruder.id), plan.id)).toEqual(denied);
    expect(await duplicatePlanDay(proActor(intruder.id), plan.id, dayId)).toEqual(denied);
    expect(await renamePlanDay(proActor(intruder.id), plan.id, dayId, "X")).toEqual(denied);
    expect(await updatePlanInstructions(proActor(intruder.id), plan.id, "X")).toEqual(denied);
  });
});
