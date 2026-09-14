/**
 * Diagnóstico nutricional automático
 * Basado en indicadores antropométricos y bioquímicos
 * Lineamientos AAND (Academy of Nutrition and Dietetics)
 */

export interface NutritionalDiagnosis {
  bmiDiagnosis: string;
  bmiRisk: "low" | "moderate" | "high" | "very_high";
  bodyCompositionDiagnosis: string | null;
  waistRiskDiagnosis: string | null;
  overallDiagnosis: string;
  recommendations: string[];
  cie10Code: string; // Código CIE-10 sugerido
}

interface DiagnosisInput {
  bmi: number;
  sex: "MALE" | "FEMALE" | "OTHER";
  age: number;
  bodyFatPercent?: number | null;
  waistCm?: number | null;
  waistHipRatio?: number | null;
  heightCm: number;
  weightKg: number;
}

function diagnoseBmi(bmi: number): { label: string; risk: "low" | "moderate" | "high" | "very_high"; cie10: string } {
  if (bmi < 16) return { label: "Desnutrición severa", risk: "very_high", cie10: "E43" };
  if (bmi < 17) return { label: "Desnutrición moderada", risk: "high", cie10: "E44.0" };
  if (bmi < 18.5) return { label: "Desnutrición leve (bajo peso)", risk: "moderate", cie10: "E44.1" };
  if (bmi < 25) return { label: "Estado nutricional normal", risk: "low", cie10: "Z71.3" };
  if (bmi < 30) return { label: "Sobrepeso", risk: "moderate", cie10: "E66.0" };
  if (bmi < 35) return { label: "Obesidad grado I", risk: "high", cie10: "E66.0" };
  if (bmi < 40) return { label: "Obesidad grado II", risk: "high", cie10: "E66.0" };
  return { label: "Obesidad grado III (mórbida)", risk: "very_high", cie10: "E66.2" };
}

function diagnoseBodyFat(percent: number, sex: "MALE" | "FEMALE" | "OTHER"): string | null {
  if (sex === "OTHER") return null;

  if (sex === "MALE") {
    if (percent < 6) return "Grasa corporal por debajo del mínimo esencial";
    if (percent < 14) return "Grasa corporal en rango atlético";
    if (percent < 18) return "Grasa corporal en rango fitness";
    if (percent < 25) return "Grasa corporal aceptable";
    return "Exceso de grasa corporal";
  }
  // FEMALE
  if (percent < 14) return "Grasa corporal por debajo del mínimo esencial";
  if (percent < 21) return "Grasa corporal en rango atlético";
  if (percent < 25) return "Grasa corporal en rango fitness";
  if (percent < 32) return "Grasa corporal aceptable";
  return "Exceso de grasa corporal";
}

function diagnoseWaist(
  waistCm: number,
  sex: "MALE" | "FEMALE" | "OTHER"
): string | null {
  if (sex === "OTHER") return null;
  const threshold = sex === "MALE" ? 102 : 88;
  const elevated = sex === "MALE" ? 94 : 80;

  if (waistCm >= threshold) return "Perímetro abdominal: riesgo cardiovascular alto";
  if (waistCm >= elevated) return "Perímetro abdominal: riesgo cardiovascular moderado";
  return "Perímetro abdominal dentro de límites normales";
}

/** Índice cintura-talla: >0.5 indica riesgo cardiovascular */
function waistHeightRatio(waistCm: number, heightCm: number): number {
  return Math.round((waistCm / heightCm) * 100) / 100;
}

export function generateNutritionalDiagnosis(input: DiagnosisInput): NutritionalDiagnosis {
  const bmiResult = diagnoseBmi(input.bmi);
  const recommendations: string[] = [];

  // Body composition
  const bodyCompDx = input.bodyFatPercent != null
    ? diagnoseBodyFat(input.bodyFatPercent, input.sex)
    : null;

  // Waist
  const waistDx = input.waistCm != null
    ? diagnoseWaist(input.waistCm, input.sex)
    : null;

  // Cintura-talla
  let whrNote: string | null = null;
  if (input.waistCm != null) {
    const whr = waistHeightRatio(input.waistCm, input.heightCm);
    if (whr > 0.5) {
      whrNote = `Índice cintura-talla ${whr} (>0.5 = riesgo CV aumentado)`;
    }
  }

  // Generate recommendations
  if (input.bmi < 18.5) {
    recommendations.push("Aumentar aporte calórico gradualmente (+300-500 kcal/día)");
    recommendations.push("Priorizar proteínas de alto valor biológico");
    recommendations.push("Evaluar causas subyacentes de bajo peso");
  } else if (input.bmi >= 25 && input.bmi < 30) {
    recommendations.push("Reducción calórica moderada (-300-500 kcal/día)");
    recommendations.push("Aumentar actividad física (150 min/semana mínimo)");
    recommendations.push("Incrementar consumo de fibra y vegetales");
  } else if (input.bmi >= 30) {
    recommendations.push("Déficit calórico controlado (-500-750 kcal/día)");
    recommendations.push("Actividad física progresiva (30 min/día)");
    recommendations.push("Considerar remisión a equipo multidisciplinario");
    recommendations.push("Monitoreo mensual de composición corporal");
  }

  if (bodyCompDx?.includes("Exceso")) {
    recommendations.push("Programa de recomposición corporal con énfasis en entrenamiento de fuerza");
  }

  if (waistDx?.includes("alto")) {
    recommendations.push("Priorizar reducción de perímetro abdominal como meta primaria");
  }

  if (recommendations.length === 0) {
    recommendations.push("Mantener alimentación balanceada según plan");
    recommendations.push("Control de seguimiento en 30-60 días");
  }

  // Overall
  const parts = [bmiResult.label];
  if (bodyCompDx) parts.push(bodyCompDx.toLowerCase());
  if (waistDx && waistDx.includes("riesgo")) parts.push("con riesgo cardiovascular");
  if (whrNote) parts.push(whrNote.toLowerCase());

  return {
    bmiDiagnosis: bmiResult.label,
    bmiRisk: bmiResult.risk,
    bodyCompositionDiagnosis: bodyCompDx,
    waistRiskDiagnosis: waistDx,
    overallDiagnosis: parts.join(". "),
    recommendations,
    cie10Code: bmiResult.cie10,
  };
}
