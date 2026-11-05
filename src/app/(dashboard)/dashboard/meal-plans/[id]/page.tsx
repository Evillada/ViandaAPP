import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { notFound } from "next/navigation";
import { getMealPlan, getFoods, activateMealPlanForm, regenerateMealPlanFromForm } from "@/features/nutrition/actions";
import { computePlanTotals } from "@/features/nutrition/plan-totals";
import { MealPlanEditor } from "@/features/nutrition/components/meal-plan-editor";
import { PlanDayTabs } from "@/features/nutrition/components/plan-day-tabs";
import { PlanInstructionsForm } from "@/features/nutrition/components/plan-instructions-form";
import { Card, Badge, Button } from "@/shared/ui/components";
import { PLAN_STATUS_LABELS } from "@/shared/lib/labels";

export default async function MealPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;
  const [plan, foods] = await Promise.all([getMealPlan(id), getFoods()]);
  if (!plan) notFound();

  const selectedDay = plan.days.find((d) => d.id === day) ?? plan.days[0];
  const totals = computePlanTotals(selectedDay?.meals.flatMap((m) => m.items) ?? []);
  const goal = plan.assessment?.nutritionalGoal;

  const pct = (actual: number, target: number) =>
    target > 0 ? Math.round((actual / target) * 100) : 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/dashboard/patients/${plan.patientId}`} className="text-sm text-primary hover:underline">
            ← {plan.patient.firstName} {plan.patient.lastName}
          </Link>
          <h2 className="text-2xl font-bold text-text mt-2">{plan.name}</h2>
          <Badge className="mt-2">{PLAN_STATUS_LABELS[plan.status]}</Badge>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {plan.assessmentId && plan.status === "DRAFT" && (
            <form action={regenerateMealPlanFromForm}>
              <input type="hidden" name="mealPlanId" value={id} />
              <Button type="submit" variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Regenerar automático
              </Button>
            </form>
          )}
          {plan.status === "DRAFT" && (
            <form action={activateMealPlanForm}>
              <input type="hidden" name="mealPlanId" value={id} />
              <Button type="submit" variant="secondary">Aprobar plan</Button>
            </form>
          )}
        </div>
      </div>

      {plan.notes && (
        <p className="text-sm text-muted bg-accent-light/50 border border-accent/20 rounded-xl px-4 py-3">
          {plan.notes}
        </p>
      )}

      <p className="text-sm text-muted">Totales de {selectedDay?.name ?? "el día"} frente a la meta diaria</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Calorías", actual: totals.energyKcal, target: goal?.targetKcal, unit: "kcal" },
          { label: "Proteína", actual: totals.proteinG, target: goal?.proteinG, unit: "g" },
          { label: "Carbohidratos", actual: totals.carbsG, target: goal?.carbsG, unit: "g" },
          { label: "Grasas", actual: totals.fatG, target: goal?.fatG, unit: "g" },
        ].map((m) => (
          <Card key={m.label}>
            <p className="text-xs text-muted">{m.label}</p>
            <p className="text-xl font-bold text-text mt-1">
              {m.actual} <span className="text-sm font-normal text-muted">/ {m.target ?? "—"}{m.unit}</span>
            </p>
            {m.target && (
              <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(pct(m.actual, m.target), 100)}%` }}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold text-text mb-4">Días del plan</h3>
        <PlanDayTabs mealPlanId={id} days={plan.days.map((d) => ({ id: d.id, name: d.name }))} selectedDayId={selectedDay?.id ?? ""} />
        <div className="mt-6">
          <MealPlanEditor key={selectedDay?.id} mealPlanId={id} meals={selectedDay?.meals ?? []} foods={foods} />
        </div>
      </Card>

      <Card>
        <PlanInstructionsForm mealPlanId={id} value={plan.patientInstructions} />
      </Card>
    </div>
  );
}
