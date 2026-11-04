"use client";

import { useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { rankPatients, type SearchablePatient } from "@/core/patients/patient-search";
import { cn } from "@/shared/lib/utils";

const MAX_RESULTS = 8;

function fullName(p: SearchablePatient) {
  return `${p.firstName} ${p.lastName}`;
}

function detail(p: SearchablePatient) {
  return [p.documentId && `Doc. ${p.documentId}`, p.phone, p.email].filter(Boolean).join(" · ");
}

interface PatientPickerProps {
  patients: SearchablePatient[];
  name: string;
  label?: string;
}

export function PatientPicker({ patients, name, label = "Paciente" }: PatientPickerProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchablePatient | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => rankPatients(patients, query).slice(0, MAX_RESULTS), [patients, query]);

  function choose(p: SearchablePatient) {
    setSelected(p);
    setQuery(fullName(p));
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={`${baseId}-input`} className="block text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${baseId}-opt-${results[active].id}` : undefined}
          autoComplete="off"
          placeholder="Nombre, documento o teléfono"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full min-h-11 rounded-xl border border-border bg-surface pl-10 pr-11 text-base sm:text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpiar paciente"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <input type="hidden" name={name} value={selected?.id ?? ""} />

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">Sin resultados para “{query}”</li>
            ) : (
              results.map((p, i) => (
                <li
                  key={p.id}
                  id={`${baseId}-opt-${p.id}`}
                  role="option"
                  aria-selected={selected?.id === p.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(p);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2", i === active && "bg-primary-light")}
                >
                  <span className="text-sm font-medium text-text">{fullName(p)}</span>
                  {detail(p) && <span className="text-xs text-muted truncate">{detail(p)}</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
