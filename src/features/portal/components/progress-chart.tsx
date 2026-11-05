"use client";

import { useState } from "react";
import type { EvolutionPoint } from "@/core/anthropometry/evolution";
import type { ProgressMetric } from "@/core/portal/progress";
import { cn } from "@/shared/lib/utils";
import { MetricLineChart } from "@/shared/ui/charts/metric-line-chart";

export function ProgressChart({ timeline, metrics }: { timeline: EvolutionPoint[]; metrics: ProgressMetric[] }) {
  const [selected, setSelected] = useState(metrics[0]!.key);
  const metric = metrics.find((m) => m.key === selected) ?? metrics[0]!;
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Medida" className="flex gap-2 overflow-x-auto pb-1">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.key === metric.key}
            onClick={() => setSelected(m.key)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
              m.key === metric.key ? "border-primary bg-primary text-white" : "border-border bg-surface text-text"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <MetricLineChart title={metric.label} unit={metric.unit} data={timeline} getValue={(p) => p[metric.key]} />
    </div>
  );
}
