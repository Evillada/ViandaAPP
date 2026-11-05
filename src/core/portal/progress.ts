export type ProgressMetricKey = "waistCm" | "weightKg" | "bmi" | "bodyFatPercent";

export interface ProgressMetric {
  key: ProgressMetricKey;
  label: string;
  unit: string;
}

/** La cintura va primero: el peso nunca es la medida que se abre por defecto. */
export const PROGRESS_METRICS: ProgressMetric[] = [
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "bmi", label: "IMC", unit: "kg/m²" },
  { key: "bodyFatPercent", label: "% grasa", unit: "%" },
];

export function formatMeasure(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value);
}

/** Cambio frente a la valoración anterior, sin calificarlo como mejor o peor. */
export function describeChange(current: number | null, previous: number | null, unit: string): string | null {
  if (current == null || previous == null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return "Igual que la valoración anterior";
  const amount = `${formatMeasure(Math.abs(diff))} ${unit}`;
  return diff < 0 ? `${amount} menos que la valoración anterior` : `${amount} más que la valoración anterior`;
}

export function availableMetrics(points: Record<ProgressMetricKey, number | null>[]): ProgressMetric[] {
  return PROGRESS_METRICS.filter((m) => points.some((p) => p[m.key] != null));
}
