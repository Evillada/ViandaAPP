import { CalendarPlus } from "lucide-react";
import { getAppointments } from "@/features/appointments/actions";
import { getPatients } from "@/features/patients/actions";
import { AppointmentForm } from "@/features/appointments/components/appointment-form";
import { AppointmentList } from "@/features/appointments/components/appointment-list";
import { Card } from "@/shared/ui/components";

export default async function AppointmentsPage() {
  const [appointments, patients] = await Promise.all([
    getAppointments(),
    getPatients(),
  ]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text">Citas</h2>
          <p className="text-muted mt-1">
            Programa y gestiona las consultas de tus pacientes
          </p>
        </div>
        <a
          href="#nueva-cita"
          className="lg:hidden inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Agendar
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card id="nueva-cita" className="order-2 lg:order-1 lg:col-span-1 scroll-mt-20">
          <h3 className="text-lg font-semibold text-text mb-4">
            Nueva cita
          </h3>
          <AppointmentForm
            patients={patients.map(({ id, firstName, lastName, email, documentId, phone }) => ({
              id,
              firstName,
              lastName,
              email,
              documentId,
              phone,
            }))}
          />
        </Card>

        <div className="order-1 lg:order-2 lg:col-span-2">
          <AppointmentList appointments={appointments} />
        </div>
      </div>
    </div>
  );
}
