"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { searchFoodsAction } from "@/features/nutrition/actions";
import type { FoodSearchResult } from "@/features/catalog/search";
import { ALLERGEN_LABELS, GABA_GROUP_SHORT_LABELS, HIGH_IN_LABELS } from "@/shared/lib/labels";
import { cn } from "@/shared/lib/utils";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const perPortion = (per100g: number | null, grams: number) => (per100g === null ? "—" : Math.round((per100g * grams) / 100));

interface FoodSearchProps {
  selectedId: string | null;
  onSelect: (food: FoodSearchResult) => void;
}

export function FoodSearch({ selectedId, onSelect }: FoodSearchProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = query.trim().length >= MIN_QUERY_LENGTH || group !== null;
  const shown = active ? results : [];

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchFoodsAction(query, group);
        if (cancelled) return;
        setResults(found);
        setSearched(true);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, query, group]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Buscar alimento</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alimento (ej. arroz cocido)"
          maxLength={100}
          className="min-h-11 w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por grupo">
        {Object.entries(GABA_GROUP_SHORT_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={group === key}
            onClick={() => setGroup(group === key ? null : key)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm transition",
              group === key ? "border-primary bg-primary text-white" : "border-border bg-surface text-text hover:border-primary"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending && <p className="text-xs text-muted">Buscando…</p>}
      {!isPending && active && searched && shown.length === 0 && <p className="text-sm text-muted">Sin resultados</p>}

      {shown.length > 0 && (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {shown.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => onSelect(food)}
                aria-pressed={selectedId === food.id}
                className={cn("min-h-11 w-full px-3 py-2 text-left text-sm transition hover:bg-primary-light/50", selectedId === food.id && "bg-primary-light")}
              >
                <span className="block font-medium text-text">{food.name}</span>
                <span className="block text-xs text-muted">
                  {food.portion.name} ({food.portion.grams} g{food.exchangeEstimated && ", estimado"}): {perPortion(food.per100g.kcal, food.portion.grams)} kcal · P{" "}
                  {perPortion(food.per100g.protein, food.portion.grams)} g · C {perPortion(food.per100g.carbs, food.portion.grams)} g · G{" "}
                  {perPortion(food.per100g.fat, food.portion.grams)} g
                </span>
                <FoodBadges food={food} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const BADGE = "rounded px-1.5 py-0.5 text-[10px] font-semibold";

function FoodBadges({ food }: { food: FoodSearchResult }) {
  if (food.highIn.length === 0 && food.allergens.length === 0 && !food.needsReview && !food.isProcessed) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {food.highIn.map((seal) => (
        <span key={seal} className={cn(BADGE, "bg-text uppercase text-white")}>
          {HIGH_IN_LABELS[seal]}
        </span>
      ))}
      {food.isProcessed && <span className={cn(BADGE, "border border-border text-muted")}>Azúcares sin evaluar</span>}
      {food.allergens.length > 0 && (
        <span className={cn(BADGE, "bg-amber-100 text-amber-900")}>Contiene: {food.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}</span>
      )}
      {food.needsReview && <span className={cn(BADGE, "bg-amber-50 text-amber-800")}>Pendiente de revisión</span>}
    </span>
  );
}
