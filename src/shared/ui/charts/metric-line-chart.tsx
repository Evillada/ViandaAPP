"use client";

import type { EvolutionPoint } from "@/core/anthropometry/evolution";

interface MetricLineChartProps {
  title: string;
  unit: string;
  data: EvolutionPoint[];
  getValue: (p: EvolutionPoint) => number | null;
  referenceBands?: { min: number; max: number; label: string; color: string }[];
  color?: string;
}

/** Las valoraciones son fechas sin hora guardadas a medianoche UTC. */
const shortDate = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));

export function MetricLineChart({
  title,
  unit,
  data,
  getValue,
  referenceBands,
  color = "#2A9D8F",
}: MetricLineChartProps) {
  const points = data
    .map((d, i) => ({ x: i, y: getValue(d), date: d.date, label: d.label }))
    .filter((p) => p.y != null) as { x: number; y: number; date: Date; label: string }[];

  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="text-xs text-muted mt-2">Se necesitan al menos 2 valoraciones para graficar.</p>
      </div>
    );
  }

  const width = 320;
  const height = 140;
  const pad = { top: 12, right: 12, bottom: 28, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const values = points.map((p) => p.y);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (referenceBands) {
    for (const band of referenceBands) {
      yMin = Math.min(yMin, band.min);
      yMax = Math.max(yMax, band.max);
    }
  }
  const yPad = (yMax - yMin) * 0.1 || 1;
  yMin -= yPad;
  yMax += yPad;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.x)} ${toY(p.y)}`)
    .join(" ");

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium text-text mb-3">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {referenceBands?.map((band) => {
          const y1 = toY(band.max);
          const y2 = toY(band.min);
          return (
            <rect
              key={band.label}
              x={pad.left}
              y={y1}
              width={chartW}
              height={Math.max(y2 - y1, 1)}
              fill={band.color}
              opacity={0.35}
            />
          );
        })}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.x} cx={toX(p.x)} cy={toY(p.y)} r="3.5" fill={color} />
        ))}
        {points.map((p, i) => (
          <text
            key={`label-${i}`}
            x={toX(p.x)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            className="fill-muted"
            fontSize="8"
          >
            {shortDate(p.date)}
          </text>
        ))}
      </svg>
      <p className="text-xs text-muted mt-1">
        Último: <span className="font-medium text-text">{points[points.length - 1]!.y} {unit}</span>
      </p>
    </div>
  );
}
