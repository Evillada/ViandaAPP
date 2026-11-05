import type { Actor } from "@/core/access/types";
import { prisma } from "@/infrastructure/database/prisma";

export const MAX_PLAN_DAYS = 7;
const MAX_INSTRUCTIONS = 2000;

export type PlanDayResult = { ok: true; dayId?: string } | { ok: false; error: string };

const NOT_FOUND: PlanDayResult = { ok: false, error: "Plan no encontrado" };
const BASE_MEALS = [
  { type: "BREAKFAST" as const, orderNum: 1 },
  { type: "LUNCH" as const, orderNum: 2 },
  { type: "DINNER" as const, orderNum: 3 },
];

async function ownedPlan(actor: Actor, mealPlanId: string) {
  if (actor.activeArea !== "PROFESSIONAL") return null;
  return prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
    select: { id: true, days: { orderBy: { orderNum: "asc" }, select: { id: true, orderNum: true } } },
  });
}

export async function addPlanDay(actor: Actor, mealPlanId: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  if (plan.days.length >= MAX_PLAN_DAYS) return { ok: false, error: `Un plan puede tener máximo ${MAX_PLAN_DAYS} días` };
  const orderNum = (plan.days.at(-1)?.orderNum ?? 0) + 1;
  const day = await prisma.mealPlanDay.create({
    data: { mealPlanId, name: `Día ${plan.days.length + 1}`, orderNum, meals: { create: BASE_MEALS } },
    select: { id: true },
  });
  return { ok: true, dayId: day.id };
}

export async function duplicatePlanDay(actor: Actor, mealPlanId: string, dayId: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  if (plan.days.length >= MAX_PLAN_DAYS) return { ok: false, error: `Un plan puede tener máximo ${MAX_PLAN_DAYS} días` };
  const source = await prisma.mealPlanDay.findFirst({
    where: { id: dayId, mealPlanId },
    select: { name: true, meals: { select: { type: true, name: true, orderNum: true, items: { select: { foodId: true, portionGrams: true, quantity: true, notes: true } } } } },
  });
  if (!source) return { ok: false, error: "Día no encontrado" };
  const orderNum = (plan.days.at(-1)?.orderNum ?? 0) + 1;
  const day = await prisma.mealPlanDay.create({
    data: {
      mealPlanId,
      name: `${source.name} (copia)`.slice(0, 60),
      orderNum,
      meals: {
        create: source.meals.map((meal) => ({
          type: meal.type,
          name: meal.name,
          orderNum: meal.orderNum,
          items: { create: meal.items.map((item) => ({ foodId: item.foodId, portionGrams: item.portionGrams, quantity: item.quantity, notes: item.notes })) },
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, dayId: day.id };
}

export async function renamePlanDay(actor: Actor, mealPlanId: string, dayId: string, name: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return { ok: false, error: "El nombre no puede estar vacío" };
  const updated = await prisma.mealPlanDay.updateMany({ where: { id: dayId, mealPlanId }, data: { name: trimmed } });
  return updated.count === 1 ? { ok: true, dayId } : { ok: false, error: "Día no encontrado" };
}

export async function deletePlanDay(actor: Actor, mealPlanId: string, dayId: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  if (plan.days.length <= 1) return { ok: false, error: "El plan debe tener al menos un día" };
  const removed = await prisma.mealPlanDay.deleteMany({ where: { id: dayId, mealPlanId } });
  return removed.count === 1 ? { ok: true } : { ok: false, error: "Día no encontrado" };
}

export async function updatePlanInstructions(actor: Actor, mealPlanId: string, text: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  const trimmed = text.trim();
  if (trimmed.length > MAX_INSTRUCTIONS) return { ok: false, error: `Máximo ${MAX_INSTRUCTIONS} caracteres` };
  await prisma.mealPlan.updateMany({
    where: { id: mealPlanId, professionalId: actor.userId },
    data: { patientInstructions: trimmed || null },
  });
  return { ok: true };
}
