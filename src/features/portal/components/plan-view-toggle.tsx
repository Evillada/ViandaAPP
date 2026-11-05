import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function PlanViewToggle({ view, query }: { view: "semana" | "completo"; query: string }) {
  const tab = (value: "semana" | "completo", label: string) => (
    <Link
      href={`/portal/plan?vista=${value}${query}`}
      aria-current={view === value ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium",
        view === value ? "bg-surface text-primary shadow-sm" : "text-muted"
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Vista del plan" className="flex gap-1 rounded-xl bg-background p-1 border border-border">
      {tab("semana", "Esta semana")}
      {tab("completo", "Plan completo")}
    </nav>
  );
}
