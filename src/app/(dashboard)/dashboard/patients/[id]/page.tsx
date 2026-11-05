import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient } from "@/features/patients/actions";
import { PatientDetailTabs } from "@/features/assessments/components/patient-detail-tabs";
import { getInvitationStatusAction } from "@/features/invitations/actions";
import { InvitePatientPanel } from "@/features/invitations/components/invite-patient-panel";
import { PatientEditButton } from "@/features/patients/components/patient-edit-button";
import { PortalSettingsPanel } from "@/features/patients/components/portal-settings-panel";
import { localDateKey } from "@/core/portal/plan-cycle";
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
  const [patient, invitationStatus] = await Promise.all([getPatient(id), getInvitationStatusAction(id)]);
  if (!patient) notFound();

  const weightSummary = getWeightChangeSummary(patient.assessments);
  const age = patient.dateOfBirth ? calculateAge(new Date(patient.dateOfBirth)) : null;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <PatientEditButton patient={patient} />
          <Link href={`/dashboard/patients/${id}/assessments/new`}>
            <Button>Nueva valoración</Button>
          </Link>
        </div>
      </div>

      {invitationStatus && (
        <InvitePatientPanel patientId={patient.id} status={invitationStatus} />
      )}

      <PortalSettingsPanel
        patientId={patient.id}
        message={patient.portalMessage}
        until={patient.portalMessageUntil ? localDateKey(patient.portalMessageUntil) : null}
        progressEnabled={patient.progressMessagesEnabled}
      />

      <PatientDetailTabs patient={patient} />
    </div>
  );
}
