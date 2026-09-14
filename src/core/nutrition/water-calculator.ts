/**
 * Calculadora de requerimiento hídrico
 * Basada en guías clínicas estándar
 */

export type WaterMethod =
  | "STANDARD"          // 30-35 ml/kg
  | "HOLLIDAY_SEGAR"    // Fórmula pediátrica/adultos por tramos
  | "ADJUSTED";         // Ajustada por actividad y clima

export interface WaterRequirement {
  mlPerDay: number;
  litersPerDay: number;
  method: WaterMethod;
  glasses: number; // Vasos de 250ml
  note: string;
}

/**
 * Método estándar: 30-35 ml/kg/día
 * Se usa 35 ml/kg para <65 años, 30 ml/kg para ≥65 años
 */
function waterStandard(weightKg: number, age: number): number {
  const mlPerKg = age >= 65 ? 30 : 35;
  return Math.round(weightKg * mlPerKg);
}

/**
 * Holliday-Segar: aplicable en pediátricos y adultos
 * 0-10 kg: 100 ml/kg
 * 10-20 kg: 1000 + 50 ml/kg por cada kg sobre 10
 * >20 kg: 1500 + 20 ml/kg por cada kg sobre 20
 */
function waterHollidaySegar(weightKg: number): number {
  if (weightKg <= 10) return Math.round(weightKg * 100);
  if (weightKg <= 20) return Math.round(1000 + (weightKg - 10) * 50);
  return Math.round(1500 + (weightKg - 20) * 20);
}

/**
 * Ajustada: base estándar + ajuste por actividad física
 * Sedentario: base
 * Ligera: +300 ml
 * Moderada: +500 ml
 * Activa: +700 ml
 * Muy activa: +1000 ml
 */
const ACTIVITY_WATER_BONUS: Record<string, number> = {
  SEDENTARY: 0,
  LIGHT: 300,
  MODERATE: 500,
  ACTIVE: 700,
  VERY_ACTIVE: 1000,
};

export function calculateWaterRequirement(
  weightKg: number,
  age: number,
  activityLevel?: string,
  method: WaterMethod = "STANDARD"
): WaterRequirement {
  let ml: number;
  let note: string;

  switch (method) {
    case "HOLLIDAY_SEGAR":
      ml = waterHollidaySegar(weightKg);
      note = "Holliday-Segar: escalonado por peso";
      break;
    case "ADJUSTED":
      ml = waterStandard(weightKg, age);
      if (activityLevel && ACTIVITY_WATER_BONUS[activityLevel]) {
        ml += ACTIVITY_WATER_BONUS[activityLevel]!;
      }
      note = `Ajustada: ${age >= 65 ? "30" : "35"} ml/kg + actividad`;
      break;
    case "STANDARD":
    default:
      ml = waterStandard(weightKg, age);
      note = `Estándar: ${age >= 65 ? "30" : "35"} ml/kg/día`;
      break;
  }

  // Mínimo 1500 ml, máximo 4000 ml como límite seguro
  ml = Math.max(1500, Math.min(ml, 4000));

  return {
    mlPerDay: ml,
    litersPerDay: Math.round((ml / 1000) * 10) / 10,
    method,
    glasses: Math.round(ml / 250),
    note,
  };
}
