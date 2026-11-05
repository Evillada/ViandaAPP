import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMeasure } from "@/core/portal/progress";
import { getPortalAssessmentAction } from "@/features/portal/actions";
import type { PortalMeasures } from "@/features/portal/portal-progress";
import { ASSESSMENT_TYPE_LABELS } from "@/shared/lib/labels";
import { formatCalendarDate } from "@/shared/lib/utils";

const MEASURE_ROWS: { key: keyof PortalMeasures; label: string; unit: string; digits?: number }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "heightCm", label: "Talla", unit: "cm" },
  { key: "bmi", label: "IMC", unit: "kg/m²" },
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "hipCm", label: "Cadera", unit: "cm" },
  { key: "waistHipRatio", label: "Índice cintura/cadera", unit: "", digits: 2 },
  { key: "bodyFatPercent", label: "Grasa corporal", unit: "%" },
  { key: "fatMassKg", label: "Masa grasa", unit: "kg" },
  { key: "leanMassKg", label: "Masa magra", unit: "kg" },
];

export default async function PortalAssessmentPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const data = await getPortalAssessmentAction(assessmentId);
  if (!data) notFound();

  const measures = data.measures;
  const rows = measures ? MEASURE_ROWS.filter((r) => measures[r.key] != null) : [];

  return (
    <div className="space-y-5 max-w-xl">
      <Link href={`/portal/progreso?p=${data.patientId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a mi progreso
      </Link>
      <div>
        <h1 className="text-xl font-bold text-text">{ASSESSMENT_TYPE_LABELS[data.type] ?? "Valoración"}</h1>
        <p className="text-sm text-muted">{formatCalendarDate(data.date)} · {data.professionalName}</p>
      </div>

      {measures && rows.length > 0 && (
        <section aria-labelledby="medidas" className="rounded-2xl border border-border bg-surface p-4">
          <h2 id="medidas" className="mb-2 font-semibold text-text">Medidas</h2>
          <dl className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.key} className="flex justify-between py-2 text-sm">
                <dt className="text-muted">{r.label}</dt>
                <dd className="font-medium text-text">{formatMeasure(measures[r.key] as number, r.digits)}{r.unit ? ` ${r.unit}` : ""}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.diagnosis && (
        <section aria-labelledby="diagnostico" className="rounded-2xl border border-border bg-surface p-4 space-y-1">
          <h2 id="diagnostico" className="font-semibold text-text">Diagnóstico nutricional</h2>
          <p className="text-sm text-text">{data.diagnosis.text}</p>
          {data.diagnosis.cie10Code && <p className="text-xs text-muted">CIE-10: {data.diagnosis.cie10Code}</p>}
        </section>
      )}

      <section aria-labelledby="indicaciones" className="rounded-2xl border border-border bg-surface p-4 space-y-1">
        <h2 id="indicaciones" className="font-semibold text-text">Indicaciones de tu nutricionista</h2>
        <p className="whitespace-pre-line text-sm text-text">
          {data.instructions ?? "Tu nutricionista no dejó indicaciones en esta valoración."}
        </p>
      </section>
    </div>
  );
}
