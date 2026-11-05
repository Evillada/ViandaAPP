import type { PortalDay } from "@/features/portal/portal-data";
import { PORTAL_MEAL_LABELS } from "@/shared/lib/labels";

export function DayMenu({ day, goalKcal }: { day: PortalDay; goalKcal: number | null }) {
  const meals = day.meals.filter((m) => m.items.length > 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {Math.round(day.totals.energyKcal)} kcal{goalKcal ? ` de ${Math.round(goalKcal)} kcal de tu meta` : ""}
      </p>
      {meals.length === 0 ? (
        <p className="text-sm text-muted">Tu profesional aún no ha agregado alimentos a este día.</p>
      ) : (
        <ul className="space-y-3">
          {meals.map((meal) => (
            <li key={meal.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
              <h3 className="bg-primary-light px-4 py-2 text-sm font-semibold text-primary">
                {PORTAL_MEAL_LABELS[meal.type] ?? meal.type}
              </h3>
              <ul className="divide-y divide-border">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-text">{item.foodName}</span>
                    <span className="shrink-0 text-muted">{item.grams} g · {item.kcal} kcal</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
