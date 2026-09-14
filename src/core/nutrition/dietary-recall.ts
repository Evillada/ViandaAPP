/**
 * Recordatorio de 24 horas (24-hour dietary recall)
 * Herramienta clínica estándar para evaluar ingesta alimentaria
 *
 * Basado en el método de pasos múltiples del USDA:
 * 1. Lista rápida (quick list)
 * 2. Preguntas sobre alimentos olvidados
 * 3. Hora y ocasión de consumo
 * 4. Ciclo de detalle (cantidades, preparación)
 * 5. Revisión final
 */

export interface RecallItem {
  id: string;
  mealType: string;        // BREAKFAST, LUNCH, etc.
  time: string;            // "07:30"
  foodName: string;        // Nombre del alimento
  foodId?: string;         // Referencia al catálogo si se enlaza
  quantity: number;
  portionDescription: string; // "1 taza", "2 cucharadas"
  portionGrams: number;
  preparationMethod?: string; // "frito", "al horno", "crudo"
  brand?: string;
  notes?: string;
}

export interface RecallSummary {
  totalKcal: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  mealCount: number;
  itemCount: number;
}

export interface RecallAnalysis {
  summary: RecallSummary;
  /** Comparación vs metas */
  vsTarget: {
    kcalDiff: number;
    kcalPct: number;     // % del objetivo
    proteinDiff: number;
    proteinPct: number;
    carbsDiff: number;
    carbsPct: number;
    fatDiff: number;
    fatPct: number;
  } | null;
  /** Patrones detectados */
  patterns: string[];
}

export function analyzeRecall(
  items: RecallItem[],
  nutrients: Map<string, { energyKcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }>,
  targets?: { targetKcal: number; proteinG: number; carbsG: number; fatG: number }
): RecallAnalysis {
  const summary: RecallSummary = {
    totalKcal: 0,
    totalProteinG: 0,
    totalCarbsG: 0,
    totalFatG: 0,
    totalFiberG: 0,
    mealCount: new Set(items.map((i) => i.mealType)).size,
    itemCount: items.length,
  };

  for (const item of items) {
    if (item.foodId && nutrients.has(item.foodId)) {
      const n = nutrients.get(item.foodId)!;
      const factor = (item.portionGrams * item.quantity) / 100;
      summary.totalKcal += n.energyKcal * factor;
      summary.totalProteinG += n.proteinG * factor;
      summary.totalCarbsG += n.carbsG * factor;
      summary.totalFatG += n.fatG * factor;
      summary.totalFiberG += n.fiberG * factor;
    }
  }

  // Round
  summary.totalKcal = Math.round(summary.totalKcal);
  summary.totalProteinG = Math.round(summary.totalProteinG * 10) / 10;
  summary.totalCarbsG = Math.round(summary.totalCarbsG * 10) / 10;
  summary.totalFatG = Math.round(summary.totalFatG * 10) / 10;
  summary.totalFiberG = Math.round(summary.totalFiberG * 10) / 10;

  // vs targets
  let vsTarget: RecallAnalysis["vsTarget"] = null;
  if (targets) {
    vsTarget = {
      kcalDiff: Math.round(summary.totalKcal - targets.targetKcal),
      kcalPct: Math.round((summary.totalKcal / targets.targetKcal) * 100),
      proteinDiff: Math.round((summary.totalProteinG - targets.proteinG) * 10) / 10,
      proteinPct: Math.round((summary.totalProteinG / targets.proteinG) * 100),
      carbsDiff: Math.round((summary.totalCarbsG - targets.carbsG) * 10) / 10,
      carbsPct: Math.round((summary.totalCarbsG / targets.carbsG) * 100),
      fatDiff: Math.round((summary.totalFatG - targets.fatG) * 10) / 10,
      fatPct: Math.round((summary.totalFatG / targets.fatG) * 100),
    };
  }

  // Pattern detection
  const patterns: string[] = [];
  const mealTypes = items.map((i) => i.mealType);
  if (!mealTypes.includes("BREAKFAST")) patterns.push("No desayuna — patrón de ayuno matutino");
  if (summary.mealCount <= 2) patterns.push("Menos de 3 tiempos de comida — distribución inadecuada");
  if (summary.mealCount >= 5) patterns.push("Buena distribución en 5+ tiempos de comida");
  if (summary.totalFiberG < 15) patterns.push("Bajo aporte de fibra (<15g)");
  if (summary.totalFiberG >= 25) patterns.push("Buen aporte de fibra (≥25g)");
  if (targets && vsTarget) {
    if (vsTarget.kcalPct < 70) patterns.push("Ingesta calórica muy por debajo del requerimiento (<70%)");
    if (vsTarget.kcalPct > 130) patterns.push("Ingesta calórica excesiva (>130% del requerimiento)");
    if (vsTarget.proteinPct < 80) patterns.push("Déficit proteico — evaluar calidad de ingesta");
  }

  // Check late eating
  const lateMeals = items.filter((i) => {
    const hour = parseInt(i.time?.split(":")[0] ?? "0");
    return hour >= 22;
  });
  if (lateMeals.length > 0) patterns.push("Consumo alimentario después de las 22:00");

  return { summary, vsTarget, patterns };
}
