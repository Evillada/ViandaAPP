import { getProfessionalsForReviewAction } from "@/features/admin/actions";
import { ProfessionalReviewCard } from "@/features/admin/components/professional-review-card";

export default async function ProfessionalsReviewPage() {
  const professionals = await getProfessionalsForReviewAction();
  const pending = professionals.filter((p) => p.status === "PENDING");
  const others = professionals.filter((p) => p.status !== "PENDING");

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-3">
        <h1 className="text-xl font-bold text-text">Profesionales por aprobar</h1>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No hay solicitudes pendientes.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <ProfessionalReviewCard key={p.profileId} professional={p} />
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Profesionales registrados</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {others.map((p) => (
            <ProfessionalReviewCard key={p.profileId} professional={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
