import { Droplets } from "lucide-react";
import { formatMeasure } from "@/core/portal/progress";
import type { PortalGoals } from "@/features/portal/portal-progress";

const MACROS = [
  { key: "protein", label: "Proteína", className: "bg-primary" },
  { key: "carbs", label: "Carbohidratos", className: "bg-secondary" },
  { key: "fat", label: "Grasa", className: "bg-accent" },
] as const;

export function GoalsCard({ goals }: { goals: PortalGoals }) {
  const values = {
    protein: { g: goals.proteinG, pct: goals.proteinPct },
    carbs: { g: goals.carbsG, pct: goals.carbsPct },
    fat: { g: goals.fatG, pct: goals.fatPct },
  };
  return (
    <section aria-labelledby="metas" className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <h2 id="metas" className="font-semibold text-text">Tus metas</h2>
      <p className="text-2xl font-bold text-text">
        {formatMeasure(Math.round(goals.targetKcal))} <span className="text-base font-medium text-muted">kcal al día</span>
      </p>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
        {MACROS.map((m) => (
          <div key={m.key} className={m.className} style={{ width: `${values[m.key].pct}%` }} />
        ))}
      </div>
      <ul className="space-y-1">
        {MACROS.map((m) => (
          <li key={m.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-text">
              <span className={`h-2.5 w-2.5 rounded-full ${m.className}`} aria-hidden="true" /> {m.label}
            </span>
            <span className="text-muted">{Math.round(values[m.key].g)} g · {formatMeasure(values[m.key].pct)} %</span>
          </li>
        ))}
      </ul>
      {goals.waterMlPerDay != null && (
        <p className="flex items-center gap-2 border-t border-border pt-3 text-sm text-text">
          <Droplets className="h-4 w-4 text-secondary" aria-hidden="true" /> Agua: {formatMeasure(goals.waterMlPerDay / 1000)} litros al día
        </p>
      )}
    </section>
  );
}
