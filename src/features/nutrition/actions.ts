"use server";

import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateAutomaticMealPlan,
  type FoodForGenerator,
} from "@/core/nutrition/meal-plan-generator";

export async function getFoods(search?: string) {
  return prisma.food.findMany({
    where: search
      ? { name: { contains: search } }
      : undefined,
    include: {
      category: true,
      nutrients: { include: { nutrient: true } },
      portions: { where: { isDefault: true }, take: 1 },
    },
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function getMealPlan(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  return prisma.mealPlan.findFirst({
    where: { id, professionalId: session.user.id },
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
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: session.user.id },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const plan = await prisma.mealPlan.create({
    data: {
      name: `Plan nutricional — ${patient.firstName}`,
      patientId,
      assessmentId,
      professionalId: session.user.id,
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

async function loadFoodsForGenerator(): Promise<FoodForGenerator[]> {
  const foods = await prisma.food.findMany({
    include: {
      category: true,
      nutrients: { include: { nutrient: true } },
      portions: { where: { isDefault: true }, take: 1 },
    },
  });

  return foods.map((food) => ({
    id: food.id,
    name: food.name,
    categorySlug: food.category.slug,
    defaultPortionGrams: food.portions[0]?.grams ?? 100,
    nutrients: food.nutrients.map((fn) => ({
      nutrientName: fn.nutrient.name,
      unit: fn.nutrient.unit,
      amountPer100g: fn.amountPer100g,
    })),
  }));
}

export async function generateAutomaticMealPlanAction(
  patientId: string,
  assessmentId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      patientId,
      professionalId: session.user.id,
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
      professionalId: session.user.id,
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

  revalidatePath(`/dashboard/patients/${patientId}`);
  redirect(`/dashboard/meal-plans/${plan.id}`);
}

export async function regenerateMealPlanFromForm(formData: FormData): Promise<void> {
  const mealPlanId = formData.get("mealPlanId") as string;
  const result = await regenerateAutomaticMealPlan(mealPlanId);
  if (result?.error) throw new Error(result.error);
}

export async function regenerateAutomaticMealPlan(mealPlanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: session.user.id },
    include: {
      assessment: { include: { nutritionalGoal: true } },
      days: { include: { meals: { include: { items: true } } } },
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

  const day = plan.days[0];
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

  await prisma.mealPlan.update({
    where: { id: mealPlanId },
    data: {
      notes:
        "Regenerado automáticamente según metas nutricionales. Revisar y ajustar antes de aprobar.",
    },
  });

  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

export async function activateMealPlanForm(formData: FormData): Promise<void> {
  const mealPlanId = formData.get("mealPlanId") as string;
  const result = await activateMealPlan(mealPlanId);
  if (result?.error) throw new Error(result.error);
}

export async function addMealItem(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const mealId = formData.get("mealId") as string;
  const foodId = formData.get("foodId") as string;
  const portionGrams = Number(formData.get("portionGrams"));
  const quantity = Number(formData.get("quantity") || 1);
  const mealPlanId = formData.get("mealPlanId") as string;

  if (!mealId || !foodId || !portionGrams) {
    return { error: "Datos incompletos" };
  }

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: session.user.id },
  });
  if (!plan) return { error: "Plan no encontrado" };

  await prisma.mealItem.create({
    data: { mealId, foodId, portionGrams, quantity },
  });

  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

export async function removeMealItem(itemId: string, mealPlanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: session.user.id },
  });
  if (!plan) return { error: "Plan no encontrado" };

  await prisma.mealItem.delete({ where: { id: itemId } });
  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}

export async function activateMealPlan(mealPlanId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  await prisma.mealPlan.updateMany({
    where: { id: mealPlanId, professionalId: session.user.id },
    data: { status: "ACTIVE" },
  });

  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
}
