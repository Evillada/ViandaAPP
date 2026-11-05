import Link from "next/link";
import { Copy, Plus, Trash2 } from "lucide-react";
import { addPlanDayForm, deletePlanDayForm, duplicatePlanDayForm, renamePlanDayForm } from "../actions";
import { MAX_PLAN_DAYS } from "../plan-days";
import { cn } from "@/shared/lib/utils";

interface Props {
  mealPlanId: string;
  days: { id: string; name: string }[];
  selectedDayId: string;
}

export function PlanDayTabs({ mealPlanId, days, selectedDayId }: Props) {
  const selected = days.find((d) => d.id === selectedDayId) ?? days[0];
  const full = days.length >= MAX_PLAN_DAYS;

  return (
    <div className="space-y-3">
      <nav aria-label="Días del plan" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((day) => (
          <Link
            key={day.id}
            href={`/dashboard/meal-plans/${mealPlanId}?day=${day.id}`}
            aria-current={day.id === selected?.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium",
              day.id === selected?.id ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-text"
            )}
          >
            {day.name}
          </Link>
        ))}
        <form action={addPlanDayForm}>
          <input type="hidden" name="mealPlanId" value={mealPlanId} />
          <button
            type="submit"
            disabled={full}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-dashed border-border px-4 text-sm text-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Agregar día
          </button>
        </form>
      </nav>

      {selected && (
        <div className="flex flex-wrap items-end gap-2">
          <form action={renamePlanDayForm} className="flex flex-1 items-end gap-2 min-w-[220px]">
            <input type="hidden" name="mealPlanId" value={mealPlanId} />
            <input type="hidden" name="dayId" value={selected.id} />
            <label className="flex-1 text-sm">
              <span className="block text-muted mb-1">Nombre del día</span>
              <input
                name="name"
                defaultValue={selected.name}
                maxLength={60}
                className="w-full min-h-11 rounded-xl border border-border bg-surface px-3"
              />
            </label>
            <button type="submit" className="min-h-11 rounded-xl border border-border px-4 text-sm">Renombrar</button>
          </form>
          <form action={duplicatePlanDayForm}>
            <input type="hidden" name="mealPlanId" value={mealPlanId} />
            <input type="hidden" name="dayId" value={selected.id} />
            <button type="submit" disabled={full} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-4 text-sm disabled:opacity-50">
              <Copy className="h-4 w-4" aria-hidden="true" /> Duplicar
            </button>
          </form>
          <form action={deletePlanDayForm}>
            <input type="hidden" name="mealPlanId" value={mealPlanId} />
            <input type="hidden" name="dayId" value={selected.id} />
            <button
              type="submit"
              disabled={days.length <= 1}
              aria-label={`Eliminar ${selected.name}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border text-danger disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
