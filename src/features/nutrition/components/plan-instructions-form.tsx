import { updatePlanInstructionsForm } from "../actions";

export function PlanInstructionsForm({ mealPlanId, value }: { mealPlanId: string; value: string | null }) {
  return (
    <form action={updatePlanInstructionsForm} className="space-y-2">
      <input type="hidden" name="mealPlanId" value={mealPlanId} />
      <label htmlFor="patientInstructions" className="block text-sm font-medium text-text">
        Indicaciones para el paciente
      </label>
      <p className="text-xs text-muted">Las verá en su portal. Las notas internas del plan nunca se muestran.</p>
      <textarea
        id="patientInstructions"
        name="patientInstructions"
        defaultValue={value ?? ""}
        maxLength={2000}
        rows={4}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
      />
      <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-white">
        Guardar indicaciones
      </button>
    </form>
  );
}
