import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function RecordSwitcher({ records, currentId, basePath }: { records: { patientId: string; professionalName: string }[]; currentId: string; basePath: string }) {
  if (records.length < 2) return null;
  return (
    <nav aria-label="Profesional" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {records.map((r) => (
        <Link
          key={r.patientId}
          href={`${basePath}?p=${r.patientId}`}
          aria-current={r.patientId === currentId ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm",
            r.patientId === currentId ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-text"
          )}
        >
          {r.professionalName}
        </Link>
      ))}
    </nav>
  );
}
