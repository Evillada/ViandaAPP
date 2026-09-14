import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient } from "@/features/patients/actions";
import { PatientDetailTabs } from "@/features/assessments/components/patient-detail-tabs";
import { PatientEditButton } from "@/features/patients/components/patient-edit-button";
import { Button, Badge } from "@/shared/ui/components";
import { formatDate } from "@/shared/lib/utils";
import { SEX_LABELS, PATIENT_STATUS_LABELS } from "@/shared/lib/labels";
import { getWeightChangeSummary } from "@/core/anthropometry/evolution";
import { calculateAge } from "@/core/nutrition/nutrition-calculator";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  const weightSummary = getWeightChangeSummary(patient.assessments);
  const age = patient.dateOfBirth ? calculateAge(new Date(patient.dateOfBirth)) : null;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/patients" className="text-sm text-primary hover:underline">
            ← Pacientes
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h2 className="text-2xl font-bold text-text">
              {patient.firstName} {patient.lastName}
            </h2>
            <Badge
              variant={
                patient.status === "ACTIVE"
                  ? "default"
                  : patient.status === "DISCHARGED"
                    ? "info"
                    : "muted"
              }
            >
              {PATIENT_STATUS_LABELS[patient.status] ?? patient.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted">
            {patient.documentId && <span>CC {patient.documentId}</span>}
            {patient.sex && <span>{SEX_LABELS[patient.sex]}</span>}
            {age != null && <span>{age} años</span>}
            {patient.dateOfBirth && <span>{formatDate(patient.dateOfBirth)}</span>}
            {patient.phone && <span>📞 {patient.phone}</span>}
            {patient.email && <span>✉️ {patient.email}</span>}
          </div>
          {patient.notes && (
            <p className="text-sm text-muted mt-2 italic">{patient.notes}</p>
          )}
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
        <div className="flex gap-2 shrink-0">
          <PatientEditButton patient={patient} />
          <Link href={`/dashboard/patients/${id}/assessments/new`}>
            <Button>Nueva valoración</Button>
          </Link>
        </div>
      </div>

      <PatientDetailTabs patient={patient} />
    </div>
  );
}
