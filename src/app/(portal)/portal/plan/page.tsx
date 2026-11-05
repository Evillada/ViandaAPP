import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { PORTAL_TIME_ZONE, keyToNoonUtc } from "@/core/portal/plan-cycle";
import { getPortalPlanAction } from "@/features/portal/actions";
import { DayMenu } from "@/features/portal/components/day-menu";
import { PlanViewToggle } from "@/features/portal/components/plan-view-toggle";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";
import { cn } from "@/shared/lib/utils";

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "short" }).format(keyToNoonUtc(key));
const shortDate = (date: Date) => new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(date);

export default async function PortalPlanPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; semana?: string }> }) {
  const { p, vista, semana } = await searchParams;
  const view = vista === "completo" ? "completo" : "semana";
  const data = await getPortalPlanAction(p ?? null, Number(semana ?? 0));

  if (!data) return <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />;
  const patientQuery = p ? `&p=${p}` : "";

  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={data.context.records} currentId={data.context.current.patientId} basePath="/portal/plan" />
      <h1 className="text-xl font-bold text-text">Mi plan alimentario</h1>

      {!data.plan ? (
        <PortalEmpty title="Aún no tienes un plan activo" text="Cuando tu profesional active tu plan, aquí verás tu alimentación día a día." />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-1">
            <p className="font-semibold text-text">{data.plan.name}</p>
            <p className="text-sm text-muted">{data.context.current.professionalName} · activo desde el {shortDate(data.plan.activatedAt)}</p>
            {data.plan.goal && <p className="text-sm text-muted">Meta diaria: {Math.round(data.plan.goal.targetKcal)} kcal</p>}
          </div>

          <PlanViewToggle view={view} query={patientQuery} />

          {view === "semana" ? (
            <section aria-label="Esta semana" className="space-y-3">
              <div className="flex items-center justify-between">
                <Link href={`/portal/plan?vista=semana&semana=${data.weekOffset - 1}${patientQuery}`} aria-label="Semana anterior" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border">
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Link>
                <p className="text-sm font-medium text-text">
                  {data.weekOffset === 0 ? "Esta semana" : data.weekOffset > 0 ? `En ${data.weekOffset} semana(s)` : `Hace ${-data.weekOffset} semana(s)`}
                </p>
                <Link href={`/portal/plan?vista=semana&semana=${data.weekOffset + 1}${patientQuery}`} aria-label="Semana siguiente" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border">
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
              <ul className="space-y-2">
                {data.week.map(({ dateKey, dayIndex }) => {
                  const day = dayIndex === null ? null : data.plan!.days[dayIndex] ?? null;
                  const isToday = dateKey === data.todayKey;
                  return (
                    <li key={dateKey}>
                      <details open={isToday} className={cn("rounded-2xl border bg-surface", isToday ? "border-primary" : "border-border")}>
                        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4">
                          <span>
                            <span className="block text-sm font-semibold capitalize text-text">{dayLabel(dateKey)}{isToday ? " · Hoy" : ""}</span>
                            <span className="block text-xs text-muted">{day ? day.name : "Plan aún no activo"}</span>
                          </span>
                          {day && <span className="text-xs text-muted">{Math.round(day.totals.energyKcal)} kcal</span>}
                        </summary>
                        {day && (
                          <div className="px-4 pb-4">
                            <DayMenu day={day} goalKcal={data.plan!.goal?.targetKcal ?? null} />
                          </div>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section aria-label="Plan completo" className="space-y-6">
              {data.plan.patientInstructions && (
                <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
                  <h2 className="flex items-center gap-2 font-semibold text-text">
                    <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" /> Indicaciones de tu profesional
                  </h2>
                  <p className="text-sm text-text whitespace-pre-line">{data.plan.patientInstructions}</p>
                </div>
              )}
              {data.plan.days.map((day) => (
                <div key={day.id} className="space-y-2">
                  <h2 className="text-lg font-semibold text-text">{day.name}</h2>
                  <p className="text-xs text-muted">
                    Proteína {Math.round(day.totals.proteinG)} g · Carbohidratos {Math.round(day.totals.carbsG)} g · Grasas {Math.round(day.totals.fatG)} g
                  </p>
                  <DayMenu day={day} goalKcal={data.plan!.goal?.targetKcal ?? null} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
