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
      <div>
        <h2 className="text-2xl font-bold text-text">Citas</h2>
        <p className="text-muted mt-1">
          Programa y gestiona las consultas de tus pacientes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
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

        <div className="lg:col-span-2">
          <AppointmentList appointments={appointments} />
        </div>
      </div>
    </div>
  );
}
