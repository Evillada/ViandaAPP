"use server";

import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { prisma } from "@/infrastructure/database/prisma";
import {
  calculateAge,
  calculateBmi,
  calculateMacros,
  calculateTargetKcal,
  calculateTmb,
  MACRO_PRESETS,
  type ActivityLevel,
  type Sex,
  type TmbFormula,
} from "@/core/nutrition/nutrition-calculator";
import { classifyBmiOms } from "@/core/anthropometry/bmi-classifier";
import { calculateBodyComposition } from "@/core/anthropometry/body-composition";
import {
  calculateArmMuscleArea,
  calculateWaistHipRatio,
} from "@/core/anthropometry/perimeters";
import { calculateSomatotype } from "@/core/anthropometry/somatotype";
import { calculateWaterRequirement } from "@/core/nutrition/water-calculator";
import { generateNutritionalDiagnosis } from "@/core/nutrition/diagnosis";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";

const optionalFloat = z
  .union([z.literal(""), z.coerce.number()])
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const assessmentSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(["INITIAL", "FOLLOW_UP", "REASSESSMENT", "DISCHARGE"]),
  assessmentDate: z.string().min(1),
  reason: z.string().min(3, "Motivo requerido"),
  notes: z.string().optional(),
  allergies: z.string().optional(),
  conditions: z.string().optional(),
  medications: z.string().optional(),
  activityLevel: z.enum([
    "SEDENTARY",
    "LIGHT",
    "MODERATE",
    "ACTIVE",
    "VERY_ACTIVE",
  ]),
  tmbFormula: z.enum(["MIFFLIN_ST_JEOR", "HARRIS_BENEDICT", "FAO_OMS"]).optional(),
  // Macro distribution
  macroPreset: z.string().optional(),
  proteinPct: optionalFloat,
  carbsPct: optionalFloat,
  fatPct: optionalFloat,
  // Medidas
  weightKg: z.coerce.number().min(20).max(300),
  heightCm: z.coerce.number().min(100).max(250),
  bodyFatPercent: optionalFloat,
  // Perímetros
  headCm: optionalFloat,
  neckCm: optionalFloat,
  chestCm: optionalFloat,
  waistCm: optionalFloat,
  abdominalCm: optionalFloat,
  hipCm: optionalFloat,
  armRelaxedCm: optionalFloat,
  armContractedCm: optionalFloat,
  forearmCm: optionalFloat,
  wristCm: optionalFloat,
  thighProximalCm: optionalFloat,
  thighCm: optionalFloat,
  calfCm: optionalFloat,
  // Pliegues
  skinfoldTricepsMm: optionalFloat,
  skinfoldBicepsMm: optionalFloat,
  skinfoldSubscapularMm: optionalFloat,
  skinfoldIliacCrestMm: optionalFloat,
  skinfoldSuprailiacMm: optionalFloat,
  skinfoldAbdominalMm: optionalFloat,
  skinfoldThighMm: optionalFloat,
  skinfoldCalfMm: optionalFloat,
  skinfoldMidaxillaryMm: optionalFloat,
  skinfoldPectoralMm: optionalFloat,
  // Diámetros óseos
  humerusBreadthCm: optionalFloat,
  femurBreadthCm: optionalFloat,
  anthropometryNotes: z.string().optional(),
});

export async function getAssessment(id: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  const assessment = await prisma.assessment.findFirst({
    where: { id, professionalId: actor.userId },
    include: {
      patient: true,
      anthropometry: true,
      nutritionalGoal: true,
      mealPlans: { orderBy: { createdAt: "desc" } },
    },
  });

  if (assessment) {
    const { ip } = await getRequestMeta();
    await recordAuditBestEffort({
      actorId: actor.userId,
      actorRole: "PROFESSIONAL",
      action: "PATIENT_RECORD_VIEWED",
      entityType: "Assessment",
      entityId: assessment.id,
      patientId: assessment.patientId,
      ip,
    });
  }

  return assessment;
}

export async function getPatientAssessments(patientId: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.assessment.findMany({
    where: { patientId, professionalId: actor.userId },
    include: { anthropometry: true, nutritionalGoal: true },
    orderBy: { assessmentDate: "desc" },
  });
}

export async function createAssessment(formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = assessmentSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const data = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, professionalId: actor.userId },
  });
  if (!patient) return { error: "Paciente no encontrado" };
  if (!patient.dateOfBirth || !patient.sex) {
    return {
      error: "El paciente debe tener fecha de nacimiento y sexo registrados",
    };
  }

  const age = calculateAge(patient.dateOfBirth);
  const sex = patient.sex as Sex;
  const bmi = calculateBmi(data.weightKg, data.heightCm);
  const bmiClassification = classifyBmiOms(bmi);
  const tmbFormula = (data.tmbFormula ?? "MIFFLIN_ST_JEOR") as TmbFormula;
  const tmb = calculateTmb(data.weightKg, data.heightCm, age, sex, tmbFormula);
  const targetKcal = calculateTargetKcal(tmb, data.activityLevel as ActivityLevel);

  // Custom macros
  const presetKey = data.macroPreset ?? "STANDARD";
  let proteinPct = 25;
  let carbsPct = 50;
  let fatPct = 25;

  if (presetKey === "CUSTOM") {
    proteinPct = data.proteinPct ?? 25;
    carbsPct = data.carbsPct ?? 50;
    fatPct = data.fatPct ?? 25;
  } else if (presetKey in MACRO_PRESETS) {
    const preset = MACRO_PRESETS[presetKey]!;
    proteinPct = preset.proteinPct;
    carbsPct = preset.carbsPct;
    fatPct = preset.fatPct;
  }

  const macros = calculateMacros(targetKcal, { proteinPct, carbsPct, fatPct });

  // Waist-hip ratio
  const waistHipRatio =
    data.waistCm && data.hipCm
      ? calculateWaistHipRatio(data.waistCm, data.hipCm)
      : null;

  const armMuscleAreaCm2 =
    data.armContractedCm && data.skinfoldTricepsMm != null
      ? calculateArmMuscleArea(data.armContractedCm, data.skinfoldTricepsMm)
      : null;

  // Body composition
  const composition = calculateBodyComposition(
    data.weightKg,
    {
      biceps: data.skinfoldBicepsMm,
      triceps: data.skinfoldTricepsMm,
      subscapular: data.skinfoldSubscapularMm,
      suprailiac: data.skinfoldSuprailiacMm,
      abdominal: data.skinfoldAbdominalMm,
      thigh: data.skinfoldThighMm,
      calf: data.skinfoldCalfMm,
      midaxillary: data.skinfoldMidaxillaryMm,
      pectoral: data.skinfoldPectoralMm,
    },
    age,
    sex,
    data.bodyFatPercent
  );

  // Somatotype Heath-Carter
  const somatotype = calculateSomatotype({
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    skinfoldTricepsMm: data.skinfoldTricepsMm ?? undefined,
    skinfoldSubscapularMm: data.skinfoldSubscapularMm ?? undefined,
    skinfoldSuprailiacMm: data.skinfoldSuprailiacMm ?? undefined,
    skinfoldCalfMm: data.skinfoldCalfMm ?? undefined,
    armContractedCm: data.armContractedCm ?? undefined,
    calfCm: data.calfCm ?? undefined,
    humerusBreadthCm: data.humerusBreadthCm ?? undefined,
    femurBreadthCm: data.femurBreadthCm ?? undefined,
  });

  // Water requirement
  const water = calculateWaterRequirement(
    data.weightKg,
    age,
    data.activityLevel,
    "ADJUSTED"
  );

  // Nutritional diagnosis
  const diagnosis = generateNutritionalDiagnosis({
    bmi,
    sex,
    age,
    bodyFatPercent: composition?.bodyFatPercent ?? data.bodyFatPercent,
    waistCm: data.waistCm,
    waistHipRatio,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
  });

  const assessment = await prisma.assessment.create({
    data: {
      type: data.type,
      assessmentDate: new Date(data.assessmentDate),
      reason: data.reason,
      notes: data.notes || null,
      allergies: data.allergies || null,
      conditions: data.conditions || null,
      medications: data.medications || null,
      activityLevel: data.activityLevel,
      patientId: data.patientId,
      professionalId: actor.userId,
      anthropometry: {
        create: {
          weightKg: data.weightKg,
          heightCm: data.heightCm,
          bodyFatPercent: composition?.bodyFatPercent ?? data.bodyFatPercent ?? null,
          bodyFatMethod: composition?.method ?? (data.bodyFatPercent ? "MANUAL" : null),
          fatMassKg: composition?.fatMassKg ?? null,
          leanMassKg: composition?.leanMassKg ?? null,
          waistHipRatio,
          // Perímetros
          headCm: data.headCm ?? null,
          neckCm: data.neckCm ?? null,
          chestCm: data.chestCm ?? null,
          waistCm: data.waistCm ?? null,
          abdominalCm: data.abdominalCm ?? null,
          hipCm: data.hipCm ?? null,
          armRelaxedCm: data.armRelaxedCm ?? null,
          armContractedCm: data.armContractedCm ?? null,
          forearmCm: data.forearmCm ?? null,
          wristCm: data.wristCm ?? null,
          thighProximalCm: data.thighProximalCm ?? null,
          thighCm: data.thighCm ?? null,
          calfCm: data.calfCm ?? null,
          armMuscleAreaCm2,
          // Pliegues
          skinfoldTricepsMm: data.skinfoldTricepsMm ?? null,
          skinfoldBicepsMm: data.skinfoldBicepsMm ?? null,
          skinfoldSubscapularMm: data.skinfoldSubscapularMm ?? null,
          skinfoldIliacCrestMm: data.skinfoldIliacCrestMm ?? null,
          skinfoldSuprailiacMm: data.skinfoldSuprailiacMm ?? null,
          skinfoldAbdominalMm: data.skinfoldAbdominalMm ?? null,
          skinfoldThighMm: data.skinfoldThighMm ?? null,
          skinfoldCalfMm: data.skinfoldCalfMm ?? null,
          skinfoldMidaxillaryMm: data.skinfoldMidaxillaryMm ?? null,
          skinfoldPectoralMm: data.skinfoldPectoralMm ?? null,
          // Diámetros óseos
          humerusBreadthCm: data.humerusBreadthCm ?? null,
          femurBreadthCm: data.femurBreadthCm ?? null,
          // Somatotipo calculado
          somatotypeEndo: somatotype?.endomorphy ?? null,
          somatotypeMeso: somatotype?.mesomorphy ?? null,
          somatotypeEcto: somatotype?.ectomorphy ?? null,
          anthropometryNotes: data.anthropometryNotes || null,
        },
      },
      nutritionalGoal: {
        create: {
          bmi,
          bmiCategory: bmiClassification.category,
          tmbKcal: tmb,
          tmbFormula,
          targetKcal,
          proteinG: macros.proteinG,
          carbsG: macros.carbsG,
          fatG: macros.fatG,
          macroPreset: presetKey as never,
          proteinPct,
          carbsPct,
          fatPct,
          waterMlPerDay: water.mlPerDay,
          waterMethod: water.method,
          nutritionalDiagnosis: diagnosis.overallDiagnosis,
          cie10Code: diagnosis.cie10Code,
        },
      },
    },
  });

  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId: actor.userId,
    actorRole: "PROFESSIONAL",
    action: "ASSESSMENT_CREATED",
    entityType: "Assessment",
    entityId: assessment.id,
    patientId: data.patientId,
    ip,
  });

  revalidatePath(`/dashboard/patients/${data.patientId}`);
  redirect(`/dashboard/patients/${data.patientId}/assessments/${assessment.id}`);
}
