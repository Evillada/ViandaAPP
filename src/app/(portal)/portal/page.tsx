import { Stethoscope } from "lucide-react";
import { getMyProfessionalsAction } from "@/features/portal/actions";
import { RevokeConsentButton } from "@/features/portal/components/revoke-consent-button";
import { formatDate } from "@/shared/lib/utils";

export default async function PortalHome() {
  const professionals = await getMyProfessionalsAction();

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold text-text">Mis profesionales</h1>
      {professionals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
          <Stethoscope className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
          <p className="font-medium text-text mt-3">No tienes profesionales vinculados</p>
          <p className="text-sm text-muted mt-1">Pide a tu nutricionista un enlace de invitación.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {professionals.map((p) => (
            <li key={p.patientId} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <p className="font-semibold text-text">{p.professionalName}</p>
                {p.grantedAt && <p className="text-sm text-muted">Autorización otorgada el {formatDate(p.grantedAt)}</p>}
              </div>
              <RevokeConsentButton patientId={p.patientId} professionalName={p.professionalName} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
