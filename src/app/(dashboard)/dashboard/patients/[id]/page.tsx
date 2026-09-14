import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient } from "@/features/patients/actions";
import { PatientDetailTabs } from "@/features/assessments/components/patient-detail-tabs";
import { Button } from "@/shared/ui/components";
import { formatDate } from "@/shared/lib/utils";
import { SEX_LABELS } from "@/shared/lib/labels";
import { getWeightChangeSummary } from "@/core/anthropometry/evolution";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  const weightSummary = getWeightChangeSummary(patient.assessments);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/patients" className="text-sm text-primary hover:underline">
            ← Pacientes
          </Link>
          <h2 className="text-2xl font-bold text-text mt-2">
            {patient.firstName} {patient.lastName}
          </h2>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted">
            {patient.documentId && <span>CC {patient.documentId}</span>}
            {patient.sex && <span>{SEX_LABELS[patient.sex]}</span>}
            {patient.dateOfBirth && <span>{formatDate(patient.dateOfBirth)}</span>}
            {patient.phone && <span>{patient.phone}</span>}
          </div>
          {weightSummary && (
            <p className="text-sm text-primary mt-2 font-medium">
              Peso actual: {weightSummary.current} kg
              {weightSummary.change != null && (
                <span className={weightSummary.change < 0 ? " text-emerald-700" : " text-amber-700"}>
                  {" "}
                  {weightSummary.change > 0 ? "▲" : "▼"} {Math.abs(weightSummary.change)} kg
                </span>
              )}
            </p>
          )}
        </div>
        <Link href={`/dashboard/patients/${id}/assessments/new`}>
          <Button>Nueva valoración</Button>
        </Link>
      </div>

      <PatientDetailTabs patient={patient} />
    </div>
  );
}
