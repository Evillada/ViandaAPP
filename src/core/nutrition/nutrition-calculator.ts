export type Sex = "MALE" | "FEMALE" | "OTHER";

export type ActivityLevel =
  | "SEDENTARY"
  | "LIGHT"
  | "MODERATE"
  | "ACTIVE"
  | "VERY_ACTIVE";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export type TmbFormula = "MIFFLIN_ST_JEOR" | "HARRIS_BENEDICT" | "FAO_OMS";

/** Mifflin-St Jeor (1990) */
export function calculateTmbMifflin(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "MALE" ? base + 5 : base - 161);
}

/** Harris-Benedict revisada (1984) */
export function calculateTmbHarrisBenedict(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  if (sex === "MALE") {
    return Math.round(88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age);
  }
  return Math.round(447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age);
}

/** FAO/OMS/UNU (1985) — usa solo peso */
export function calculateTmbFaoOms(
  weightKg: number,
  age: number,
  sex: Sex
): number {
  if (sex === "MALE") {
    if (age < 30) return Math.round(15.3 * weightKg + 679);
    if (age < 60) return Math.round(11.6 * weightKg + 879);
    return Math.round(13.5 * weightKg + 487);
  }
  // FEMALE (y OTHER usa femenino por convención clínica colombiana)
  if (age < 30) return Math.round(14.7 * weightKg + 496);
  if (age < 60) return Math.round(8.7 * weightKg + 829);
  return Math.round(10.5 * weightKg + 596);
}

/** Calcula TMB con la fórmula seleccionada */
export function calculateTmb(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  formula: TmbFormula = "MIFFLIN_ST_JEOR"
): number {
  switch (formula) {
    case "HARRIS_BENEDICT":
      return calculateTmbHarrisBenedict(weightKg, heightCm, age, sex);
    case "FAO_OMS":
      return calculateTmbFaoOms(weightKg, age, sex);
    case "MIFFLIN_ST_JEOR":
    default:
      return calculateTmbMifflin(weightKg, heightCm, age, sex);
  }
}

export function calculateTargetKcal(tmb: number, activity: ActivityLevel): number {
  return Math.round(tmb * ACTIVITY_FACTORS[activity]);
}

export interface MacroDistribution {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MacroRatios {
  proteinPct: number; // e.g. 25
  carbsPct: number;   // e.g. 50
  fatPct: number;     // e.g. 25
}

/** Distribuciones predefinidas comunes en nutrición clínica */
export const MACRO_PRESETS: Record<string, MacroRatios & { label: string }> = {
  STANDARD: { label: "Estándar (25/50/25)", proteinPct: 25, carbsPct: 50, fatPct: 25 },
  HIGH_PROTEIN: { label: "Alta en proteína (30/40/30)", proteinPct: 30, carbsPct: 40, fatPct: 30 },
  LOW_CARB: { label: "Baja en carbohidratos (30/30/40)", proteinPct: 30, carbsPct: 30, fatPct: 40 },
  KETOGENIC: { label: "Cetogénica (20/5/75)", proteinPct: 20, carbsPct: 5, fatPct: 75 },
  ATHLETIC: { label: "Deportista (25/55/20)", proteinPct: 25, carbsPct: 55, fatPct: 20 },
  RENAL: { label: "Renal (10/60/30)", proteinPct: 10, carbsPct: 60, fatPct: 30 },
};

/**
 * Calcula macros con distribución personalizable
 * @param targetKcal kcal objetivo
 * @param ratios porcentajes (suman 100). Default: 25/50/25
 */
export function calculateMacros(
  targetKcal: number,
  ratios?: Partial<MacroRatios>
): MacroDistribution {
  const pPct = ratios?.proteinPct ?? 25;
  const cPct = ratios?.carbsPct ?? 50;
  const fPct = ratios?.fatPct ?? 25;

  return {
    proteinG: Math.round((targetKcal * (pPct / 100)) / 4),
    carbsG: Math.round((targetKcal * (cPct / 100)) / 4),
    fatG: Math.round((targetKcal * (fPct / 100)) / 9),
  };
}

export interface NutritionTotals {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface FoodNutrientInput {
  nutrientName: string;
  unit: string;
  amountPer100g: number;
}

export function calculateItemNutrients(
  nutrients: FoodNutrientInput[],
  portionGrams: number,
  quantity: number
): NutritionTotals {
  const totalGrams = portionGrams * quantity;
  const factor = totalGrams / 100;

  const get = (name: string) => {
    const n = nutrients.find((x) => x.nutrientName === name);
    return n ? n.amountPer100g * factor : 0;
  };

  return {
    energyKcal: Math.round(get("Energía") * 10) / 10,
    proteinG: Math.round(get("Proteína") * 10) / 10,
    carbsG: Math.round(get("Carbohidratos") * 10) / 10,
    fatG: Math.round(get("Grasas totales") * 10) / 10,
    fiberG: Math.round(get("Fibra") * 10) / 10,
  };
}

export function sumNutritionTotals(items: NutritionTotals[]): NutritionTotals {
  return items.reduce(
    (acc, item) => ({
      energyKcal: Math.round((acc.energyKcal + item.energyKcal) * 10) / 10,
      proteinG: Math.round((acc.proteinG + item.proteinG) * 10) / 10,
      carbsG: Math.round((acc.carbsG + item.carbsG) * 10) / 10,
      fatG: Math.round((acc.fatG + item.fatG) * 10) / 10,
      fiberG: Math.round((acc.fiberG + item.fiberG) * 10) / 10,
    }),
    { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );
}
