import { Suspense } from "react";
import { UserPlus } from "lucide-react";
import { searchPatients } from "@/features/patients/actions";
import { PatientForm } from "@/features/patients/components/patient-form";
import { PatientList } from "@/features/patients/components/patient-list";
import { PatientSearch } from "@/features/patients/components/patient-search";
import { Card } from "@/shared/ui/components";

interface PatientsPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const { q, status } = await searchParams;
  const statusFilter = status || "ACTIVE";
  const patients = await searchPatients(q, statusFilter === "ALL" ? undefined : statusFilter);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text">Pacientes</h2>
          <p className="text-muted mt-1">
            Gestiona la información de tus pacientes
          </p>
        </div>
        <a
          href="#nuevo-paciente"
          className="lg:hidden inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Nuevo
        </a>
      </div>

      <Suspense>
        <PatientSearch />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card id="nuevo-paciente" className="order-2 lg:order-1 lg:col-span-1 scroll-mt-20">
          <h3 className="text-lg font-semibold text-text mb-4">
            Nuevo paciente
          </h3>
          <PatientForm />
        </Card>

        <div className="order-1 lg:order-2 lg:col-span-2">
          <PatientList patients={patients} searchQuery={q} statusFilter={statusFilter} />
        </div>
      </div>
    </div>
  );
}
