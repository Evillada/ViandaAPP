import { PACKAGE_STATUS_LABELS, type PackageDisplayStatus } from "@/core/portal/package-status";
import { PORTAL_TIME_ZONE } from "@/core/portal/plan-cycle";
import { formatDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components";
import { RevokeConsentButton } from "./revoke-consent-button";

export interface ProfessionalCardPackage {
  id: string;
  name: string;
  includedSessions: number | null;
  startsAt: Date;
  endsAt: Date | null;
  status: PackageDisplayStatus;
}

export interface ProfessionalCardRecord {
  patientId: string;
  professionalName: string;
  grantedAt: Date | null;
  packages: ProfessionalCardPackage[];
}

const STATUS_VARIANT = {
  ACTIVE: "success",
  EXPIRED: "warning",
  COMPLETED: "muted",
  CANCELLED: "danger",
} as const;

function PackageSummary({ pkg }: { pkg: ProfessionalCardPackage }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">{pkg.name}</p>
        <Badge variant={STATUS_VARIANT[pkg.status]}>{PACKAGE_STATUS_LABELS[pkg.status]}</Badge>
      </div>
      {pkg.includedSessions != null && (
        <p className="text-sm text-muted">
          {pkg.includedSessions} {pkg.includedSessions === 1 ? "consulta incluida" : "consultas incluidas"}
        </p>
      )}
      <p className="text-sm text-muted">{pkg.endsAt ? `Vigente hasta ${formatDate(pkg.endsAt, PORTAL_TIME_ZONE)}` : "Sin fecha de fin"}</p>
    </div>
  );
}

export function ProfessionalCard({ record }: { record: ProfessionalCardRecord }) {
  // Packages arrive newest first. Show the most recent active one; if none is active,
  // fall back to the most recent so the status badge still tells the story.
  const current = record.packages.find((p) => p.status === "ACTIVE") ?? record.packages[0] ?? null;
  const history = current ? record.packages.filter((p) => p.id !== current.id) : [];

  return (
    <li className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div>
        <p className="font-semibold text-text">{record.professionalName}</p>
        {record.grantedAt && <p className="text-sm text-muted">Autorización otorgada el {formatDate(record.grantedAt, PORTAL_TIME_ZONE)}</p>}
      </div>
      <div className="rounded-xl bg-background p-3 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Plan contratado</p>
        {current ? (
          <PackageSummary pkg={current} />
        ) : (
          <p className="text-sm text-muted">Tu nutricionista no ha registrado un plan contratado</p>
        )}
        {history.length > 0 && (
          <details className="border-t border-border pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">Ver historial</summary>
            <ul className="space-y-3 pt-2">
              {history.map((p) => (
                <li key={p.id}>
                  <PackageSummary pkg={p} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <RevokeConsentButton patientId={record.patientId} professionalName={record.professionalName} />
    </li>
  );
}
