import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { availableMetrics, describeChange, formatMeasure } from "@/core/portal/progress";
import { getPortalProgressAction } from "@/features/portal/actions";
import { GoalsCard } from "@/features/portal/components/goals-card";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { ProgressChart } from "@/features/portal/components/progress-chart";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";
import { ASSESSMENT_TYPE_LABELS } from "@/shared/lib/labels";
import { formatCalendarDate } from "@/shared/lib/utils";

export default async function PortalProgressPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const data = await getPortalProgressAction(p ?? null);
  if (!data) return <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />;

  const latest = data.timeline.at(-1) ?? null;
  const previous = data.timeline.at(-2) ?? null;
  const metrics = availableMetrics(data.timeline);
  const patientId = data.context.current.patientId;

  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={data.context.records} currentId={patientId} basePath="/portal/progreso" />
      <h1 className="text-xl font-bold text-text">Mi progreso</h1>

      {data.assessments.length === 0 ? (
        <PortalEmpty title="Aún no tienes valoraciones" text="Aparecerán aquí después de tu consulta." />
      ) : (
        <>
          {latest && metrics.length > 0 && (
            <section aria-labelledby="ultima" className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <h2 id="ultima" className="font-semibold text-text">Tu última valoración</h2>
                <p className="text-sm text-muted">{formatCalendarDate(latest.date)}</p>
              </div>
              <ul className="grid grid-cols-2 gap-3">
                {metrics.map((m) => {
                  const value = latest[m.key];
                  if (value == null) return null;
                  const change = describeChange(value, previous?.[m.key] ?? null, m.unit);
                  return (
                    <li key={m.key} className="rounded-xl bg-background p-3">
                      <p className="text-xs text-muted">{m.label}</p>
                      <p className="text-lg font-semibold text-text">{formatMeasure(value)} {m.unit}</p>
                      {change && <p className="text-xs text-muted">{change}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {data.timeline.length >= 2 && metrics.length > 0 && (
            <section aria-label="Evolución">
              <ProgressChart timeline={data.timeline} metrics={metrics} />
            </section>
          )}

          {data.goals && <GoalsCard goals={data.goals} />}

          <section aria-labelledby="valoraciones" className="space-y-3">
            <h2 id="valoraciones" className="font-semibold text-text">Tus valoraciones</h2>
            <ul className="space-y-2">
              {data.assessments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/portal/progreso/${a.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
                  >
                    <span>
                      <span className="block font-medium text-text">{ASSESSMENT_TYPE_LABELS[a.type] ?? "Valoración"}</span>
                      <span className="block text-sm text-muted">{formatCalendarDate(a.date)}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
