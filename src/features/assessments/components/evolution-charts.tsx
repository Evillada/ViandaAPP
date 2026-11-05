"use client";

import type { EvolutionPoint } from "@/core/anthropometry/evolution";
import { MetricLineChart } from "@/shared/ui/charts/metric-line-chart";

interface EvolutionChartsProps {
  timeline: EvolutionPoint[];
}

export function EvolutionCharts({ timeline }: EvolutionChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MetricLineChart
        title="Evolución de peso"
        unit="kg"
        data={timeline}
        getValue={(p) => p.weightKg}
      />
      <MetricLineChart
        title="Evolución de IMC"
        unit="kg/m²"
        data={timeline}
        getValue={(p) => p.bmi}
        referenceBands={[
          { min: 18.5, max: 24.9, label: "Normal", color: "#d1fae5" },
        ]}
        color="#457B9D"
      />
      <MetricLineChart
        title="% Grasa corporal"
        unit="%"
        data={timeline}
        getValue={(p) => p.bodyFatPercent}
        color="#F4A261"
      />
      <MetricLineChart
        title="Cintura"
        unit="cm"
        data={timeline}
        getValue={(p) => p.waistCm}
        color="#e76f51"
      />
    </div>
  );
}
