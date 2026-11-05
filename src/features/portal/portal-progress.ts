import { buildEvolutionTimeline, type EvolutionRow } from "@/core/anthropometry/evolution";
import { prisma } from "@/infrastructure/database/prisma";

export interface PortalGoals {
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  waterMlPerDay: number | null;
}
export interface PortalAssessmentSummary { id: string; date: Date; type: string }
export interface PortalProgressData { assessments: PortalAssessmentSummary[]; timeline: EvolutionRow[]; goals: PortalGoals | null }
export interface PortalMeasures {
  weightKg: number;
  heightCm: number;
  bmi: number | null;
  bodyFatPercent: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  waistHipRatio: number | null;
}
export interface PortalAssessmentDetail {
  id: string;
  patientId: string;
  date: Date;
  type: string;
  measures: PortalMeasures | null;
  diagnosis: { text: string; cie10Code: string | null } | null;
  instructions: string | null;
}

const goalSelect = {
  targetKcal: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  proteinPct: true,
  carbsPct: true,
  fatPct: true,
  waterMlPerDay: true,
} as const;

const toGoals = (g: PortalGoals): PortalGoals => ({
  targetKcal: g.targetKcal,
  proteinG: g.proteinG,
  carbsG: g.carbsG,
  fatG: g.fatG,
  proteinPct: g.proteinPct,
  carbsPct: g.carbsPct,
  fatPct: g.fatPct,
  waterMlPerDay: g.waterMlPerDay,
});

export async function getPortalProgress(patientId: string): Promise<PortalProgressData> {
  const [assessments, activePlan] = await Promise.all([
    prisma.assessment.findMany({
      where: { patientId },
      orderBy: { assessmentDate: "desc" },
      select: {
        id: true,
        type: true,
        assessmentDate: true,
        anthropometry: { select: { weightKg: true, bodyFatPercent: true, waistCm: true, waistHipRatio: true, leanMassKg: true } },
        nutritionalGoal: { select: { bmi: true, ...goalSelect } },
      },
    }),
    prisma.mealPlan.findFirst({
      where: { patientId, status: "ACTIVE" },
      orderBy: [{ activatedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      select: { assessment: { select: { nutritionalGoal: { select: goalSelect } } } },
    }),
  ]);

  const timeline = buildEvolutionTimeline(
    assessments.map((a) => ({
      id: a.id,
      assessmentDate: a.assessmentDate,
      reason: "",
      anthropometry: a.anthropometry,
      nutritionalGoal: a.nutritionalGoal ? { bmi: a.nutritionalGoal.bmi } : null,
    }))
  );
  const goal = activePlan?.assessment?.nutritionalGoal ?? assessments.find((a) => a.nutritionalGoal)?.nutritionalGoal ?? null;

  return {
    assessments: assessments.map((a) => ({ id: a.id, date: a.assessmentDate, type: a.type })),
    timeline,
    goals: goal ? toGoals(goal) : null,
  };
}

export async function getPortalAssessment(patientIds: string[], assessmentId: string): Promise<PortalAssessmentDetail | null> {
  if (patientIds.length === 0) return null;
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, patientId: { in: patientIds } },
    select: {
      id: true,
      patientId: true,
      type: true,
      assessmentDate: true,
      anthropometry: {
        select: { weightKg: true, heightCm: true, bodyFatPercent: true, fatMassKg: true, leanMassKg: true, waistCm: true, hipCm: true, waistHipRatio: true },
      },
      nutritionalGoal: { select: { bmi: true, nutritionalDiagnosis: true, cie10Code: true } },
      mealPlans: {
        where: { status: { not: "DRAFT" }, patientInstructions: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { patientInstructions: true },
      },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    patientId: a.patientId,
    date: a.assessmentDate,
    type: a.type,
    measures: a.anthropometry ? { ...a.anthropometry, bmi: a.nutritionalGoal?.bmi ?? null } : null,
    diagnosis: a.nutritionalGoal?.nutritionalDiagnosis
      ? { text: a.nutritionalGoal.nutritionalDiagnosis, cie10Code: a.nutritionalGoal.cie10Code }
      : null,
    instructions: a.mealPlans[0]?.patientInstructions ?? null,
  };
}
