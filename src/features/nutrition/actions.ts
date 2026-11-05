"use server";

import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { prisma } from "@/infrastructure/database/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addPlanDay, deletePlanDay, duplicatePlanDay, renamePlanDay, updatePlanInstructions } from "./plan-days";
import { loadFoodsForGenerator } from "./generator-foods";
import { searchFoods, type FoodSearchResult } from "@/features/catalog/search";
import { GabaGroup } from "@prisma/client";
import { generateAutomaticMealPlan } from "@/core/nutrition/meal-plan-generator";

async function auditMealPlan(actorId: string, mealPlanId: string, patientId: string, change: string) {
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId,
    actorRole: "PROFESSIONAL",
    action: "MEAL_PLAN_CHANGED",
    entityType: "MealPlan",
    entityId: mealPlanId,
    patientId,
    metadata: { change },
    ip,
  });
}

const GABA_GROUPS = new Set<string>(Object.values(GabaGroup));

export async function searchFoodsAction(query: string, gabaGroup: string | null): Promise<FoodSearchResult[]> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return [];
  if (typeof query !== "string" || query.length > 100) return [];
  if (gabaGroup !== null && !GABA_GROUPS.has(gabaGroup)) return [];
  return searchFoods({ query, gabaGroup: (gabaGroup as GabaGroup | null) ?? undefined });
}

export async function getMealPlan(id: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.mealPlan.findFirst({
    where: { id, professionalId: actor.userId },
    include: {
      patient: true,
      assessment: { include: { nutritionalGoal: true } },
      days: {
        orderBy: { orderNum: "asc" },
        include: {
          meals: {
            orderBy: { orderNum: "asc" },
            include: {
              items: {
                include: {
                  food: {
                    include: {
                      nutrients: { include: { nutrient: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createMealPlan(patientId: string, assessmentId: string) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: actor.userId },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, patientId, professionalId: actor.userId },
    select: { id: true },
  });
  if (!assessment) return { error: "Evaluación no encontrada" };

  const plan = await prisma.mealPlan.create({
    data: {
      name: `Plan nutricional — ${patient.firstName}`,
      patientId,
      assessmentId,
      professionalId: actor.userId,
      status: "DRAFT",
      days: {
        create: {
          name: "Día 1",
          orderNum: 1,
          meals: {
            create: [
              { type: "BREAKFAST", orderNum: 1 },
              { type: "LUNCH", orderNum: 2 },
              { type: "DINNER", orderNum: 3 },
            ],
          },
        },
      },
    },
  });

  await auditMealPlan(actor.userId, plan.id, patientId, "created");
  redirect(`/dashboard/meal-plans/${plan.id}`);
}

export async function createMealPlanFromForm(formData: FormData): Promise<void> {
  const patientId = formData.get("patientId") as string;
  const assessmentId = formData.get("assessmentId") as string;
  const result = await createMealPlan(patientId, assessmentId);
  if (result?.error) throw new Error(result.error);
}

export async function generateAutomaticMealPlanFromForm(
  formData: FormData
): Promise<void> {
  const patientId = formData.get("patientId") as string;
  const assessmentId = formData.get("assessmentId") as string;
  const result = await generateAutomaticMealPlanAction(patientId, assessmentId);
  if (result?.error) throw new Error(result.error);
}

export async function generateAutomaticMealPlanAction(
  patientId: string,
  assessmentId: string
) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      patientId,
      professionalId: actor.userId,
    },
    include: {
      patient: true,
      nutritionalGoal: true,
    },
  });

  if (!assessment) return { error: "Valoración no encontrada" };
  if (!assessment.nutritionalGoal) {
    return { error: "La valoración no tiene metas nutricionales calculadas" };
  }

  const goal = assessment.nutritionalGoal;
  const foods = await loadFoodsForGenerator();

  if (foods.length === 0) {
    return { error: "No hay alimentos en el catálogo. Ejecuta pnpm db:seed" };
  }

  const generatedMeals = generateAutomaticMealPlan(
    {
      targetKcal: goal.targetKcal,
      proteinG: goal.proteinG,
      carbsG: goal.carbsG,
      fatG: goal.fatG,
    },
    foods
  );

  const plan = await prisma.mealPlan.create({
    data: {
      name: `Plan inteligente — ${assessment.patient.firstName}`,
      notes:
        "Generado automáticamente según TMB, actividad y macros. Revisar y ajustar antes de aprobar.",
      patientId,
      assessmentId,
      professionalId: actor.userId,
      status: "DRAFT",
      days: {
        create: {
          name: "Día 1",
          orderNum: 1,
          meals: {
            create: generatedMeals.map((meal, index) => ({
              type: meal.type,
              orderNum: index + 1,
              items: {
                create: meal.items.map((item) => ({
                  foodId: item.foodId,
                  portionGrams: item.portionGrams,
                  quantity: item.quantity,
                })),
              },
            })),
          },
        },
      },
    },
  });

  await auditMealPlan(actor.userId, plan.id, patientId, "generated");
  revalidatePath(`/dashboard/patients/${patientId}`);
  redirect(`/dashboard/meal-plans/${plan.id}`);
}

export async function regenerateMealPlanFromForm(formData: FormData): Promise<void> {
  const mealPlanId = formData.get("mealPlanId") as string;
  const dayId = (formData.get("dayId") as string | null) || undefined;
  const result = await regenerateAutomaticMealPlan(mealPlanId, dayId);
  if (result?.error) throw new Error(result.error);
}

export async function regenerateAutomaticMealPlan(mealPlanId: string, dayId?: string) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
    include: {
      assessment: { include: { nutritionalGoal: true } },
      days: { orderBy: { orderNum: "asc" }, include: { meals: { include: { items: true } } } },
    },
  });

  if (!plan?.assessment?.nutritionalGoal) {
    return { error: "Plan sin valoración o metas nutricionales" };
  }

  const goal = plan.assessment.nutritionalGoal;
  const foods = await loadFoodsForGenerator();
  const generatedMeals = generateAutomaticMealPlan(
    {
      targetKcal: goal.targetKcal,
      proteinG: goal.proteinG,
      carbsG: goal.carbsG,
      fatG: goal.fatG,
    },
    foods
  );

  const day = dayId ? plan.days.find((d) => d.id === dayId) : plan.days[0];
  if (!day) return { error: "Plan sin días configurados" };

  await prisma.mealItem.deleteMany({
    where: { meal: { dayId: day.id } },
  });

  for (const meal of day.meals) {
    const generated = generatedMeals.find((g) => g.type === meal.type);
    if (!generated) continue;

    await prisma.mealItem.createMany({
      data: generated.items.map((item) => ({
        mealId: meal.id,
        foodId: item.foodId,
        portionGrams: item.portionGrams,
        quantity: item.quantity,
      })),
    });
  }

  await prisma.mealPlan.updateMany({
    where: { id: mealPlanId, professionalId: actor.userId },
    data: {
      notes:
        "Regenerado automáticamente según metas nutricionales. Revisar y ajustar antes de aprobar.",
    },
  });

  await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "regenerated");
  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

export async function activateMealPlanForm(formData: FormData): Promise<void> {
  const mealPlanId = formData.get("mealPlanId") as string;
  const result = await activateMealPlan(mealPlanId);
  if (result?.error) throw new Error(result.error);
}

export async function addMealItem(formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const mealId = formData.get("mealId") as string;
  const foodId = formData.get("foodId") as string;
  const portionGrams = Number(formData.get("portionGrams"));
  const quantity = Number(formData.get("quantity") || 1);
  const mealPlanId = formData.get("mealPlanId") as string;

  if (!mealId || !foodId || !portionGrams) {
    return { error: "Datos incompletos" };
  }

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
  });
  if (!plan) return { error: "Plan no encontrado" };

  const meal = await prisma.meal.findFirst({ where: { id: mealId, day: { mealPlanId } }, select: { id: true } });
  if (!meal) return { error: "Comida no encontrada en este plan" };

  await prisma.mealItem.create({
    data: { mealId, foodId, portionGrams, quantity },
  });

  await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "item_added");
  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

export async function removeMealItem(itemId: string, mealPlanId: string) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
  });
  if (!plan) return { error: "Plan no encontrado" };

  const removed = await prisma.mealItem.deleteMany({
    where: { id: itemId, meal: { day: { mealPlanId } } },
  });
  if (removed.count === 0) return { error: "Elemento no encontrado" };

  await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "item_removed");
  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

export async function activateMealPlan(mealPlanId: string) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
    select: { id: true, patientId: true },
  });
  if (!plan) return { error: "Plan no encontrado" };

  await prisma.mealPlan.updateMany({
    where: { id: mealPlanId, professionalId: actor.userId },
    data: { status: "ACTIVE", activatedAt: new Date() },
  });
  await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "activated");

  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

async function runPlanChange(
  formData: FormData,
  change: string,
  run: (actor: NonNullable<Awaited<ReturnType<typeof getActorFor>>>, mealPlanId: string) => Promise<{ ok: boolean; error?: string; dayId?: string }>
): Promise<void> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) throw new Error("No autorizado");
  const mealPlanId = String(formData.get("mealPlanId") ?? "");
  const result = await run(actor, mealPlanId);
  if (!result.ok) throw new Error(result.error ?? "No se pudo guardar");
  const plan = await prisma.mealPlan.findFirst({ where: { id: mealPlanId, professionalId: actor.userId }, select: { patientId: true } });
  if (plan) await auditMealPlan(actor.userId, mealPlanId, plan.patientId, change);
  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  if (result.dayId) redirect(`/dashboard/meal-plans/${mealPlanId}?day=${result.dayId}`);
}

export async function addPlanDayForm(formData: FormData): Promise<void> {
  await runPlanChange(formData, "day_added", (a, id) => addPlanDay(a, id));
}

export async function duplicatePlanDayForm(formData: FormData): Promise<void> {
  const dayId = String(formData.get("dayId") ?? "");
  await runPlanChange(formData, "day_duplicated", (a, id) => duplicatePlanDay(a, id, dayId));
}

export async function renamePlanDayForm(formData: FormData): Promise<void> {
  const dayId = String(formData.get("dayId") ?? "");
  const name = String(formData.get("name") ?? "");
  await runPlanChange(formData, "day_renamed", (a, id) => renamePlanDay(a, id, dayId, name));
}

export async function deletePlanDayForm(formData: FormData): Promise<void> {
  const dayId = String(formData.get("dayId") ?? "");
  await runPlanChange(formData, "day_deleted", (a, id) => deletePlanDay(a, id, dayId));
}

export async function updatePlanInstructionsForm(formData: FormData): Promise<void> {
  const text = String(formData.get("patientInstructions") ?? "");
  await runPlanChange(formData, "instructions_updated", (a, id) => updatePlanInstructions(a, id, text));
}
