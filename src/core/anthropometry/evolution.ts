export interface EvolutionPoint {
  assessmentId: string;
  date: Date;
  label: string;
  weightKg: number | null;
  bmi: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  waistHipRatio: number | null;
  leanMassKg: number | null;
}

export interface EvolutionDelta {
  weightKg: number | null;
  bmi: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  waistHipRatio: number | null;
}

export interface EvolutionRow extends EvolutionPoint {
  delta: EvolutionDelta | null;
}

function delta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

function toTimestamp(date: Date | string): number {
  return new Date(date).getTime();
}

export function buildEvolutionTimeline(
  assessments: {
    id: string;
    assessmentDate: Date | string;
    reason: string;
    anthropometry: {
      weightKg: number;
      bodyFatPercent: number | null;
      waistCm: number | null;
      waistHipRatio: number | null;
      leanMassKg: number | null;
    } | null;
    nutritionalGoal: { bmi: number } | null;
  }[]
): EvolutionRow[] {
  const sorted = [...assessments].sort(
    (a, b) => toTimestamp(a.assessmentDate) - toTimestamp(b.assessmentDate)
  );

  const points: EvolutionPoint[] = sorted.map((a) => ({
    assessmentId: a.id,
    date: new Date(a.assessmentDate),
    label: a.reason,
    weightKg: a.anthropometry?.weightKg ?? null,
    bmi: a.nutritionalGoal?.bmi ?? null,
    bodyFatPercent: a.anthropometry?.bodyFatPercent ?? null,
    waistCm: a.anthropometry?.waistCm ?? null,
    waistHipRatio: a.anthropometry?.waistHipRatio ?? null,
    leanMassKg: a.anthropometry?.leanMassKg ?? null,
  }));

  return points.map((point, index) => {
    const prev = index > 0 ? points[index - 1]! : null;
    return {
      ...point,
      delta: prev
        ? {
            weightKg: delta(point.weightKg, prev.weightKg),
            bmi: delta(point.bmi, prev.bmi),
            bodyFatPercent: delta(point.bodyFatPercent, prev.bodyFatPercent),
            waistCm: delta(point.waistCm, prev.waistCm),
            waistHipRatio: delta(point.waistHipRatio, prev.waistHipRatio),
          }
        : null,
    };
  });
}

export interface PlotPoint { x: number; y: number; date: Date; label: string }

/** `x` es la posición entre los puntos con valor, no entre todas las valoraciones. */
export function plotPoints(data: EvolutionPoint[], getValue: (p: EvolutionPoint) => number | null): PlotPoint[] {
  return data
    .map((d) => ({ y: getValue(d), date: d.date, label: d.label }))
    .filter((p): p is { y: number; date: Date; label: string } => p.y != null)
    .map((p, x) => ({ ...p, x }));
}

export function formatDelta(value: number | null, unit = ""): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${unit}`;
}

export function getWeightChangeSummary(
  assessments: { anthropometry: { weightKg: number } | null }[]
): { current: number; change: number | null } | null {
  const withWeight = assessments
    .filter((a) => a.anthropometry?.weightKg != null)
    .map((a) => a.anthropometry!.weightKg);

  if (withWeight.length === 0) return null;
  const current = withWeight[0]!;
  const previous = withWeight.length > 1 ? withWeight[1]! : null;
  return {
    current,
    change: previous != null ? Math.round((current - previous) * 10) / 10 : null,
  };
}
