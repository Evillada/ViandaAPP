import { CalendarCheck2, CalendarX2, Clock } from "lucide-react";
import { PORTAL_TIME_ZONE } from "@/core/portal/plan-cycle";
import { getPortalAppointmentsAction } from "@/features/portal/actions";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(date);

const STATUS = {
  SCHEDULED: { label: "Programada", Icon: Clock, className: "text-primary" },
  COMPLETED: { label: "Completada", Icon: CalendarCheck2, className: "text-muted" },
  CANCELLED: { label: "Cancelada", Icon: CalendarX2, className: "text-danger" },
} as const;

export default async function PortalAppointmentsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const data = await getPortalAppointmentsAction(p ?? null);
  if (!data) return <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />;

  const [next, ...later] = data.upcoming;
  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={data.context.records} currentId={data.context.current.patientId} basePath="/portal/citas" />
      <h1 className="text-xl font-bold text-text">Mis citas</h1>

      <section aria-labelledby="proximas" className="space-y-3">
        <h2 id="proximas" className="font-semibold text-text">Próximas</h2>
        {!next ? (
          <PortalEmpty title="No tienes citas programadas" text="Tu profesional agenda tus citas; aparecerán aquí." />
        ) : (
          <>
            <div className="rounded-2xl border-2 border-primary bg-primary-light/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Tu próxima cita</p>
              <p className="mt-1 font-semibold capitalize text-text">{formatDate(next.date)}</p>
              <p className="text-sm text-muted">{next.duration} min · {data.context.current.professionalName}{next.reason ? ` · ${next.reason}` : ""}</p>
            </div>
            {later.length > 0 && (
              <ul className="space-y-2">
                {later.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
                    <p className="font-medium capitalize text-text">{formatDate(a.date)}</p>
                    <p className="text-sm text-muted">{a.duration} min{a.reason ? ` · ${a.reason}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="historial" className="space-y-3">
        <h2 id="historial" className="font-semibold text-text">Historial</h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay citas anteriores.</p>
        ) : (
          <ul className="space-y-2">
            {data.past.map((a) => {
              const s = STATUS[a.status];
              return (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                  <div>
                    <p className="font-medium capitalize text-text">{formatDate(a.date)}</p>
                    {a.reason && <p className="text-sm text-muted">{a.reason}</p>}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${s.className}`}>
                    <s.Icon className="h-4 w-4" aria-hidden="true" /> {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
