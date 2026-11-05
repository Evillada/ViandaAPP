import { calculateItemNutrients, type NutritionTotals } from "@/core/nutrition/nutrition-calculator";
import type { MeasurementPoint } from "@/core/portal/greeting";
import { prisma } from "@/infrastructure/database/prisma";
import { computePlanTotals } from "@/features/nutrition/plan-totals";

export interface PortalRecord {
  patientId: string;
  firstName: string;
  professionalName: string;
  portalMessage: string | null;
  portalMessageUntil: Date | null;
  progressMessagesEnabled: boolean;
}

export interface PortalItem { id: string; foodName: string; grams: number; kcal: number }
export interface PortalMeal { id: string; type: string; items: PortalItem[] }
export interface PortalDay { id: string; name: string; meals: PortalMeal[]; totals: NutritionTotals }
export interface PortalPlan {
  id: string;
  name: string;
  patientInstructions: string | null;
  activatedAt: Date;
  goal: { targetKcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  days: PortalDay[];
}
export interface PortalAppointment {
  id: string;
  date: Date;
  duration: number;
  reason: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export async function getPortalRecords(userId: string): Promise<PortalRecord[]> {
  const records = await prisma.patient.findMany({
    where: { userId, consents: { some: { userId, revokedAt: null } } },
    select: {
      id: true,
      firstName: true,
      portalMessage: true,
      portalMessageUntil: true,
      progressMessagesEnabled: true,
      professional: { select: { name: true } },
      consents: { where: { userId, revokedAt: null }, orderBy: { grantedAt: "desc" }, take: 1, select: { grantedAt: true } },
    },
  });
  return records
    .sort((a, b) => (b.consents[0]?.grantedAt.getTime() ?? 0) - (a.consents[0]?.grantedAt.getTime() ?? 0))
    .map((r) => ({
      patientId: r.id,
      firstName: r.firstName,
      professionalName: r.professional.name ?? "Tu nutricionista",
      portalMessage: r.portalMessage,
      portalMessageUntil: r.portalMessageUntil,
      progressMessagesEnabled: r.progressMessagesEnabled,
    }));
}

export function pickRecord(records: PortalRecord[], requested?: string | null): PortalRecord | null {
  return records.find((r) => r.patientId === requested) ?? records[0] ?? null;
}

const itemSelect = {
  id: true,
  portionGrams: true,
  quantity: true,
  food: { select: { name: true, nutrients: { select: { amountPer100g: true, nutrient: { select: { name: true, unit: true } } } } } },
} as const;

export async function getActivePlan(patientId: string): Promise<PortalPlan | null> {
  const plan = await prisma.mealPlan.findFirst({
    where: { patientId, status: "ACTIVE" },
    orderBy: [{ activatedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      patientInstructions: true,
      activatedAt: true,
      updatedAt: true,
      assessment: { select: { nutritionalGoal: { select: { targetKcal: true, proteinG: true, carbsG: true, fatG: true } } } },
      days: {
        orderBy: { orderNum: "asc" },
        select: {
          id: true,
          name: true,
          meals: { orderBy: { orderNum: "asc" }, select: { id: true, type: true, items: { select: itemSelect } } },
        },
      },
    },
  });
  if (!plan) return null;

  const days: PortalDay[] = plan.days.map((day) => {
    const allItems = day.meals.flatMap((m) => m.items);
    return {
      id: day.id,
      name: day.name,
      totals: computePlanTotals(allItems),
      meals: day.meals.map((meal) => ({
        id: meal.id,
        type: meal.type,
        items: meal.items.map((item) => ({
          id: item.id,
          foodName: item.food.name,
          grams: Math.round(item.portionGrams * item.quantity),
          kcal: Math.round(
            calculateItemNutrients(
              item.food.nutrients.map((n) => ({ nutrientName: n.nutrient.name, unit: n.nutrient.unit, amountPer100g: n.amountPer100g })),
              item.portionGrams,
              item.quantity
            ).energyKcal
          ),
        })),
      })),
    };
  });

  return {
    id: plan.id,
    name: plan.name,
    patientInstructions: plan.patientInstructions,
    activatedAt: plan.activatedAt ?? plan.updatedAt,
    goal: plan.assessment?.nutritionalGoal ?? null,
    days,
  };
}

export async function getAppointments(patientId: string, now: Date): Promise<{ upcoming: PortalAppointment[]; past: PortalAppointment[] }> {
  const select = { id: true, date: true, duration: true, reason: true, status: true } as const;
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId, status: "SCHEDULED", date: { gte: now } }, orderBy: { date: "asc" }, select }),
    prisma.appointment.findMany({
      where: { patientId, OR: [{ date: { lt: now } }, { status: { not: "SCHEDULED" } }] },
      orderBy: { date: "desc" },
      take: 30,
      select,
    }),
  ]);
  return { upcoming, past };
}

export async function getProgressSnapshot(
  patientId: string
): Promise<{ bmiCategory: string | null; latest: MeasurementPoint | null; previous: MeasurementPoint | null }> {
  const assessments = await prisma.assessment.findMany({
    where: { patientId, anthropometry: { isNot: null } },
    orderBy: { assessmentDate: "desc" },
    take: 2,
    select: {
      anthropometry: { select: { weightKg: true, waistCm: true } },
      nutritionalGoal: { select: { bmiCategory: true } },
    },
  });
  const point = (a: (typeof assessments)[number] | undefined): MeasurementPoint | null =>
    a?.anthropometry ? { weightKg: a.anthropometry.weightKg, waistCm: a.anthropometry.waistCm } : null;
  return {
    bmiCategory: assessments[0]?.nutritionalGoal?.bmiCategory ?? null,
    latest: point(assessments[0]),
    previous: point(assessments[1]),
  };
}
