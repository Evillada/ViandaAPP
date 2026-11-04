"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 250;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "INACTIVE", label: "Inactivos" },
  { value: "DISCHARGED", label: "Alta" },
];

export function PatientSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "ACTIVE";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "ALL" && key === "status") {
        params.set(key, value);
      } else if (value && key === "q") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.push(`/dashboard/patients?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function handleQueryChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams("q", value), SEARCH_DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          aria-label="Buscar pacientes"
          placeholder="Nombre, documento, teléfono o email"
          defaultValue={currentQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="w-full min-h-11 rounded-xl border border-border bg-surface pl-10 pr-10 text-base sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {isPending && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
            aria-label="Buscando"
          />
        )}
      </div>
      <select
        value={currentStatus}
        aria-label="Estado del paciente"
        onChange={(e) => updateParams("status", e.target.value)}
        className="min-h-11 rounded-xl border border-border bg-surface px-4 text-base sm:text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
