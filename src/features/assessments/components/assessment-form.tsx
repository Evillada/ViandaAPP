"use client";

import { useState, useTransition } from "react";
import { createAssessment } from "../actions";
import { BmiLivePreview } from "./bmi-live-preview";
import { FormSection } from "./form-section";
import { Button, Input } from "@/shared/ui/components";
import { ACTIVITY_LABELS, ASSESSMENT_TYPE_LABELS } from "@/shared/lib/labels";

const selectClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm";

function optionalNumber(name: string, label: string, step = "0.1") {
  return (
    <Input
      key={name}
      label={label}
      id={name}
      name={name}
      type="number"
      step={step}
      min="0"
    />
  );
}

const TMB_FORMULA_LABELS: Record<string, string> = {
  MIFFLIN_ST_JEOR: "Mifflin-St Jeor (1990)",
  HARRIS_BENEDICT: "Harris-Benedict revisada (1984)",
  FAO_OMS: "FAO/OMS/UNU (1985)",
};

export function AssessmentForm({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("patientId", patientId);
    startTransition(async () => {
      const result = await createAssessment(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormSection title="Datos de la consulta" description="Tipo, fecha y contexto clínico">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="type" className="block text-sm font-medium text-text">
              Tipo de valoración
            </label>
            <select id="type" name="type" required className={selectClass} defaultValue="INITIAL">
              {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <Input label="Fecha de consulta" id="assessmentDate" name="assessmentDate" type="date" defaultValue={today} required />
        </div>

        <Input label="Motivo de consulta" id="reason" name="reason" required placeholder="Control nutricional, pérdida de peso..." />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="activityLevel" className="block text-sm font-medium text-text">
              Nivel de actividad
            </label>
            <select id="activityLevel" name="activityLevel" required className={selectClass} defaultValue="SEDENTARY">
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="tmbFormula" className="block text-sm font-medium text-text">
              Fórmula TMB
            </label>
            <select id="tmbFormula" name="tmbFormula" className={selectClass} defaultValue="MIFFLIN_ST_JEOR">
              {Object.entries(TMB_FORMULA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Input label="Alergias alimentarias" id="allergies" name="allergies" placeholder="Opcional" />
          <Input label="Condiciones médicas" id="conditions" name="conditions" placeholder="Opcional" />
          <Input label="Medicamentos actuales" id="medications" name="medications" placeholder="Opcional" />
        </div>
      </FormSection>

      <FormSection title="Medidas básicas" description="Peso, talla e IMC automático (OMS)">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Peso (kg)"
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min="20"
            max="300"
            required
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="Ej: 72.5"
          />
          <Input
            label="Talla (cm)"
            id="heightCm"
            name="heightCm"
            type="number"
            step="0.1"
            min="100"
            max="250"
            required
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="Ej: 165"
          />
        </div>
        <BmiLivePreview weightKg={weightKg} heightCm={heightCm} />
        {optionalNumber("bodyFatPercent", "% Grasa manual (opcional)")}
      </FormSection>

      <FormSection title="Perímetros (cm)" description="ISAK completo — todos opcionales" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["headCm", "Cefálico"],
            ["neckCm", "Cuello"],
            ["chestCm", "Mesoesternal"],
            ["armRelaxedCm", "Braquial (relajado)"],
            ["armContractedCm", "Brazo contraído"],
            ["forearmCm", "Antebrazo"],
            ["wristCm", "Muñeca"],
            ["waistCm", "Cintura"],
            ["abdominalCm", "Abdominal"],
            ["hipCm", "Cadera"],
            ["thighProximalCm", "Muslo a 1 cm"],
            ["thighCm", "Muslo"],
            ["calfCm", "Pantorrilla"],
          ].map(([name, label]) => optionalNumber(name!, label!))}
        </div>
      </FormSection>

      <FormSection title="Pliegues cutáneos (mm)" description="Protocolo ISAK — opcionales. Se calculan Durnin-Womersley, Jackson-Pollock 3 y Yuhasz según disponibilidad." defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["skinfoldTricepsMm", "Tricipital"],
            ["skinfoldBicepsMm", "Bicipital"],
            ["skinfoldSubscapularMm", "Subescapular"],
            ["skinfoldIliacCrestMm", "Iliocrestal"],
            ["skinfoldSuprailiacMm", "Suprailiaco"],
            ["skinfoldAbdominalMm", "Abdominal"],
            ["skinfoldThighMm", "Muslo frontal"],
            ["skinfoldCalfMm", "Pantorrilla medial"],
            ["skinfoldMidaxillaryMm", "Axilar medial"],
            ["skinfoldPectoralMm", "Pectoral"],
          ].map(([name, label]) => optionalNumber(name!, label!))}
        </div>
        <p className="text-xs text-muted">
          El sistema calcula % grasa con la mejor fórmula disponible: Durnin-Womersley (4 pliegues), Jackson-Pollock 3, o Yuhasz (6 pliegues).
          Si ingresas % grasa manual, tiene prioridad.
        </p>
      </FormSection>

      <FormSection title="Diámetros óseos (cm)" description="Para cálculo de somatotipo Heath-Carter" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["humerusBreadthCm", "Biepicondíleo húmero"],
            ["femurBreadthCm", "Biepicondíleo fémur"],
          ].map(([name, label]) => optionalNumber(name!, label!))}
        </div>
        <p className="text-xs text-muted">
          Con diámetros + pliegues + perímetros, el sistema calcula el somatotipo y genera la somatocarta.
        </p>
      </FormSection>

      <FormSection title="Notas" defaultOpen={false}>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 resize-none text-sm"
          placeholder="Observaciones adicionales..."
        />
        <Input label="Notas antropométricas" id="anthropometryNotes" name="anthropometryNotes" placeholder="Opcional" />
      </FormSection>

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Calculando..." : "Crear valoración y calcular metas"}
      </Button>
    </form>
  );
}
