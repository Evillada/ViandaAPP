import { UserRound } from "lucide-react";
import { SEX_LABELS } from "@/shared/lib/labels";
import { formatCalendarDate } from "@/shared/lib/utils";
import { PhoneForm } from "./phone-form";

export interface AccountDetailsRecord {
  firstName: string;
  lastName: string;
  documentId: string | null;
  sex: string | null;
  dateOfBirth: Date | null;
  phone: string | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text break-words">{value}</dd>
    </div>
  );
}

export function AccountDetails({ email, record }: { email: string; record: AccountDetailsRecord | null }) {
  return (
    <section aria-labelledby="account-details-title" className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 id="account-details-title" className="font-semibold text-text">Mis datos</h2>
      </div>
      <dl className="space-y-3">
        {record && (
          <>
            <Row label="Nombre" value={`${record.firstName} ${record.lastName}`.trim()} />
            <Row label="Cédula (CC)" value={record.documentId ?? "Sin registrar"} />
            <Row label="Sexo" value={record.sex ? (SEX_LABELS[record.sex] ?? "Sin registrar") : "Sin registrar"} />
            <Row label="Fecha de nacimiento" value={record.dateOfBirth ? formatCalendarDate(record.dateOfBirth) : "Sin registrar"} />
          </>
        )}
        <Row label="Correo de la cuenta" value={email} />
      </dl>
      {record && (
        <>
          <p className="text-xs text-muted">Si algún dato está mal, pídele a tu nutricionista que lo corrija.</p>
          <PhoneForm initialPhone={record.phone} />
        </>
      )}
    </section>
  );
}
