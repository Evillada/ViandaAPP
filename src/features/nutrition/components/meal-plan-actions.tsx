"use client";

import { useTransition } from "react";
import { Button, Card } from "@/shared/ui/components";

interface MealPlanActionsProps {
  patientId: string;
  assessmentId: string;
  createManual: (formData: FormData) => Promise<void>;
  createAutomatic: (formData: FormData) => Promise<void>;
}

export function MealPlanActions({
  patientId,
  assessmentId,
  createManual,
  createAutomatic,
}: MealPlanActionsProps) {
  const [isPendingManual, startManual] = useTransition();
  const [isPendingAuto, startAuto] = useTransition();

  function submit(action: (formData: FormData) => Promise<void>) {
    return (formData: FormData) => {
      formData.set("patientId", patientId);
      formData.set("assessmentId", assessmentId);
      action(formData);
    };
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary-light/30 p-5 !bg-primary-light/30">
        <h3 className="font-semibold text-text mb-1">Plan inteligente (recomendado)</h3>
        <p className="text-sm text-muted mb-4">
          Vianda selecciona alimentos del catálogo ICBF y distribuye desayuno, almuerzo y cena
          según las calorías y macros calculados en la valoración.
        </p>
        <form
          action={(fd) => startAuto(() => submit(createAutomatic)(fd))}
        >
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <Button type="submit" size="lg" disabled={isPendingAuto || isPendingManual} className="w-full sm:w-auto">
            {isPendingAuto ? "Generando plan..." : "✨ Generar plan automático"}
          </Button>
        </form>
      </Card>

      <form action={(fd) => startManual(() => submit(createManual)(fd))}>
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="assessmentId" value={assessmentId} />
        <Button
          type="submit"
          variant="outline"
          size="lg"
          disabled={isPendingAuto || isPendingManual}
        >
          {isPendingManual ? "Creando..." : "Crear plan vacío (manual)"}
        </Button>
      </form>

      <p className="text-xs text-muted">
        El sistema propone y calcula. Tú validas, modificas y apruebas el plan final.
      </p>
    </div>
  );
}
