import {
  getDashboardStats,
  getUpcomingAppointments,
} from "@/features/appointments/actions";
import { Card } from "@/shared/ui/components";
import { formatDateTime } from "@/shared/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const [stats, upcoming] = await Promise.all([
    getDashboardStats(),
    getUpcomingAppointments(),
  ]);

  const statCards = [
    { title: "Pacientes", value: stats.patientCount, icon: "👥", href: "/dashboard/patients", color: "bg-primary-light text-primary" },
    { title: "Valoraciones", value: stats.assessmentCount, icon: "📋", href: "/dashboard/patients", color: "bg-blue-50 text-secondary" },
    { title: "Planes activos", value: stats.planCount, icon: "🥗", href: "/dashboard/patients", color: "bg-accent-light text-accent" },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-text">Dashboard</h2>
        <p className="text-muted mt-1">Gestión nutricional clínica — el sistema calcula, tú decides</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card hover className="cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{card.title}</p>
                  <p className="text-3xl font-bold text-text mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">Flujo rápido</h3>
        </div>
        <ol className="space-y-2 text-sm text-muted">
          <li>1. Registra un <Link href="/dashboard/patients" className="text-primary hover:underline">paciente</Link> con fecha de nacimiento y sexo</li>
          <li>2. Crea una <strong className="text-text">valoración</strong> con antropometría → el sistema calcula TMB y macros</li>
          <li>3. Genera un <strong className="text-text">plan alimentario</strong> y compara totales vs. metas</li>
        </ol>
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-text mb-4">Próximas citas</h3>
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                <p className="font-medium text-text">{apt.patient.firstName} {apt.patient.lastName}</p>
                <p className="text-sm text-primary">{formatDateTime(apt.date)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
