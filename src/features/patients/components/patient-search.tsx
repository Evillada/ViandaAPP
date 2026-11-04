"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

const SEARCH_DEBOUNCE_MS = 350;

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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
        <input
          type="search"
          placeholder="Buscar por nombre, email, documento..."
          defaultValue={currentQuery}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {isPending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">
            ⏳
          </span>
        )}
      </div>
      <select
        value={currentStatus}
        onChange={(e) => updateParams("status", e.target.value)}
        className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
