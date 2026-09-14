import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatient } from "@/features/patients/actions";
import { AssessmentForm } from "@/features/assessments/components/assessment-form";
import { Card } from "@/shared/ui/components";

export default async function NewAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href={`/dashboard/patients/${id}`} className="text-sm text-primary hover:underline">
          ← {patient.firstName} {patient.lastName}
        </Link>
        <h2 className="text-2xl font-bold text-text mt-2">Nueva valoración</h2>
        <p className="text-muted text-sm mt-1">
          El sistema calculará IMC, TMB y distribución de macros. Tú validas y decides.
        </p>
      </div>
      <Card>
        <AssessmentForm patientId={id} />
      </Card>
    </div>
  );
}
