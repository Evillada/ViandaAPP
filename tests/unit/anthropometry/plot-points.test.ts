import { describe, expect, it } from "vitest";
import { plotPoints, type EvolutionPoint } from "@/core/anthropometry/evolution";

const point = (day: string, waistCm: number | null): EvolutionPoint => ({
  assessmentId: day,
  date: new Date(`2026-${day}T00:00:00Z`),
  label: "",
  weightKg: 70,
  bmi: null,
  bodyFatPercent: null,
  waistCm,
  waistHipRatio: null,
  leanMassKg: null,
});

describe("puntos de la gráfica", () => {
  it("una medida faltante en medio no deja huecos en el eje X", () => {
    const points = plotPoints([point("07-01", 85), point("08-01", null), point("09-01", 82)], (p) => p.waistCm);
    expect(points.map((p) => [p.x, p.y])).toEqual([
      [0, 85],
      [1, 82],
    ]);
  });
});
