import Link from "next/link";
import { CalendarClock, ClipboardList } from "lucide-react";
import { PORTAL_TIME_ZONE } from "@/core/portal/plan-cycle";
import { getPortalHomeAction } from "@/features/portal/actions";
import { DayMenu } from "@/features/portal/components/day-menu";
import { GreetingCard } from "@/features/portal/components/greeting-card";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";

const formatAppointment = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(date);

export default async function PortalTodayPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const home = await getPortalHomeAction(p ?? null);

  if (!home) {
    return (
      <div className="space-y-4 max-w-xl">
        <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={home.context.records} currentId={home.context.current.patientId} basePath="/portal" />
      <GreetingCard greeting={home.greeting} />

      {home.nextAppointment && (
        <Link href="/portal/citas" className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <CalendarClock className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm text-text">
            Próxima cita: <strong className="font-semibold">{formatAppointment(home.nextAppointment.date)}</strong>
          </span>
        </Link>
      )}

      <section aria-labelledby="menu-hoy" className="space-y-3">
        <h2 id="menu-hoy" className="text-lg font-semibold text-text">Tu menú de hoy</h2>
        {home.today.day ? (
          <>
            <p className="text-sm text-muted">{home.today.planName} · {home.today.day.name}</p>
            <DayMenu day={home.today.day} goalKcal={home.today.goalKcal} />
          </>
        ) : (
          <PortalEmpty title="Aún no tienes un plan activo" text="Cuando tu profesional active tu plan, aquí verás qué comer cada día." />
        )}
      </section>

      {home.today.instructions && (
        <section aria-labelledby="indicaciones" className="rounded-2xl border border-border bg-surface p-4 space-y-2">
          <h2 id="indicaciones" className="flex items-center gap-2 font-semibold text-text">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" /> Indicaciones de tu profesional
          </h2>
          <p className="text-sm text-text whitespace-pre-line">{home.today.instructions}</p>
        </section>
      )}
    </div>
  );
}
