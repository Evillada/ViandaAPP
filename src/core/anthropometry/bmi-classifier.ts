import { calculateBmi } from "@/core/nutrition/nutrition-calculator";

export type BmiCategory =
  | "UNDERWEIGHT"
  | "NORMAL"
  | "OVERWEIGHT"
  | "OBESE_I"
  | "OBESE_II"
  | "OBESE_III";

export interface BmiClassification {
  bmi: number;
  category: BmiCategory;
  label: string;
  description: string;
  color: "info" | "success" | "warning" | "danger";
  range: string;
}

const CLASSIFICATIONS: Record<
  BmiCategory,
  Omit<BmiClassification, "bmi" | "category">
> = {
  UNDERWEIGHT: {
    label: "Bajo peso",
    description: "IMC por debajo del rango saludable. Valorar causas y plan de recuperación ponderal.",
    color: "info",
    range: "< 18.5",
  },
  NORMAL: {
    label: "Peso normal",
    description: "IMC dentro del rango saludable según OMS. Enfoque en mantenimiento y hábitos.",
    color: "success",
    range: "18.5 – 24.9",
  },
  OVERWEIGHT: {
    label: "Sobrepeso",
    description: "IMC en rango de sobrepeso. Priorizar déficit calórico moderado y composición corporal.",
    color: "warning",
    range: "25.0 – 29.9",
  },
  OBESE_I: {
    label: "Obesidad grado I",
    description: "Obesidad moderada. Intervención nutricional estructurada y seguimiento frecuente.",
    color: "warning",
    range: "30.0 – 34.9",
  },
  OBESE_II: {
    label: "Obesidad grado II",
    description: "Obesidad severa. Plan intensivo con metas graduales y monitoreo de comorbilidades.",
    color: "danger",
    range: "35.0 – 39.9",
  },
  OBESE_III: {
    label: "Obesidad grado III",
    description: "Obesidad mórbida. Requiere abordaje multidisciplinario y metas altamente individualizadas.",
    color: "danger",
    range: "≥ 40.0",
  },
};

/** Clasificación nutricional según rangos OMS (adultos). */
export function classifyBmiOms(bmi: number): BmiClassification {
  let category: BmiCategory;

  if (bmi < 18.5) category = "UNDERWEIGHT";
  else if (bmi < 25) category = "NORMAL";
  else if (bmi < 30) category = "OVERWEIGHT";
  else if (bmi < 35) category = "OBESE_I";
  else if (bmi < 40) category = "OBESE_II";
  else category = "OBESE_III";

  return {
    bmi,
    category,
    ...CLASSIFICATIONS[category],
  };
}

export function getBmiFromAnthropometry(
  weightKg: number,
  heightCm: number
): BmiClassification | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const bmi = calculateBmi(weightKg, heightCm);
  return classifyBmiOms(bmi);
}

export const BMI_OMS_RANGES = [
  { label: "Bajo peso", range: "< 18.5", color: "bg-blue-50" },
  { label: "Normal", range: "18.5 – 24.9", color: "bg-emerald-50" },
  { label: "Sobrepeso", range: "25 – 29.9", color: "bg-amber-50" },
  { label: "Obesidad I", range: "30 – 34.9", color: "bg-orange-50" },
  { label: "Obesidad II", range: "35 – 39.9", color: "bg-red-50" },
  { label: "Obesidad III", range: "≥ 40", color: "bg-red-100" },
] as const;
