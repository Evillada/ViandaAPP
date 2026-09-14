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

/** 25% proteína, 50% carbos, 25% grasas */
export function calculateMacros(targetKcal: number): MacroDistribution {
  return {
    proteinG: Math.round((targetKcal * 0.25) / 4),
    carbsG: Math.round((targetKcal * 0.5) / 4),
    fatG: Math.round((targetKcal * 0.25) / 9),
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
