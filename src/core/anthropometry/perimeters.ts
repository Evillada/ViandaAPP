/** Índice cintura-cadera (ICC / waist-hip ratio). */
export function calculateWaistHipRatio(waistCm: number, hipCm: number): number | null {
  if (!waistCm || !hipCm || hipCm <= 0) return null;
  return Math.round((waistCm / hipCm) * 100) / 100;
}

/**
 * Área muscular del brazo (AMA) — fórmula de Frisancho.
 * @param armContractedCm perímetro brazo contraído (cm)
 * @param tricepsSkinfoldMm pliegue tríceps (mm)
 */
export function calculateArmMuscleArea(
  armContractedCm: number,
  tricepsSkinfoldMm: number
): number | null {
  if (!armContractedCm || tricepsSkinfoldMm == null || tricepsSkinfoldMm < 0) return null;
  const corrected = armContractedCm - (Math.PI * tricepsSkinfoldMm) / 10;
  if (corrected <= 0) return null;
  const area = (corrected * corrected) / (4 * Math.PI) - 10;
  return Math.round(area * 10) / 10;
}

export function classifyWaistHipRatio(
  ratio: number,
  sex: "MALE" | "FEMALE" | "OTHER"
): { label: string; risk: "low" | "moderate" | "high" } {
  if (sex === "FEMALE") {
    if (ratio < 0.8) return { label: "Riesgo bajo", risk: "low" };
    if (ratio < 0.85) return { label: "Riesgo moderado", risk: "moderate" };
    return { label: "Riesgo alto", risk: "high" };
  }
  if (ratio < 0.9) return { label: "Riesgo bajo", risk: "low" };
  if (ratio < 1.0) return { label: "Riesgo moderado", risk: "moderate" };
  return { label: "Riesgo alto", risk: "high" };
}
