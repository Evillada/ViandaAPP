"use client";

import { useState, useTransition } from "react";
import { addMealItem, removeMealItem } from "../actions";
import { FoodSearch } from "@/features/catalog/components/food-search";
import type { FoodSearchResult } from "@/features/catalog/search";
import { Button } from "@/shared/ui/components";
import { MEAL_TYPE_LABELS } from "@/shared/lib/labels";

interface MealItem {
  id: string;
  quantity: number;
  portionGrams: number;
  food: { name: string };
}

interface Meal {
  id: string;
  type: string;
  items: MealItem[];
}

interface MealPlanEditorProps {
  mealPlanId: string;
  meals: Meal[];
}

export function MealPlanEditor({ mealPlanId, meals }: MealPlanEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [food, setFood] = useState<FoodSearchResult | null>(null);
  const [grams, setGrams] = useState(100);

  function handleAdd(mealId: string) {
    if (!food || !grams) return;
    const fd = new FormData();
    fd.set("mealId", mealId);
    fd.set("foodId", food.id);
    fd.set("portionGrams", String(grams));
    fd.set("quantity", "1");
    fd.set("mealPlanId", mealPlanId);
    startTransition(async () => { await addMealItem(fd); });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 p-4 bg-background rounded-xl border border-border">
        <FoodSearch
          selectedId={food?.id ?? null}
          onSelect={(selected) => {
            setFood(selected);
            setGrams(selected.portion.grams);
          }}
        />
        {food ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-text">{food.name}</span>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="number"
                min={1}
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
                className="min-h-11 w-24 rounded-xl border border-border px-3 py-2 text-sm text-text"
                aria-label="Gramos"
              />
              gramos
            </label>
            <span className="text-xs text-muted">Porción ref: {food.portion.name} ({food.portion.grams} g)</span>
          </div>
        ) : (
          <p className="text-xs text-muted">Busca y elige un alimento; luego agrégalo a la comida.</p>
        )}
      </div>

      {meals.map((meal) => (
        <div key={meal.id} className="border border-border rounded-2xl overflow-hidden">
          <div className="bg-primary-light px-4 py-2 flex items-center justify-between">
            <h4 className="font-semibold text-primary">
              {MEAL_TYPE_LABELS[meal.type] ?? meal.type}
            </h4>
            <Button size="sm" variant="outline" onClick={() => handleAdd(meal.id)} disabled={isPending || !food}>
              + Agregar alimento
            </Button>
          </div>
          {meal.items.length === 0 ? (
            <p className="text-sm text-muted p-4">Sin alimentos aún</p>
          ) : (
            <ul className="divide-y divide-border">
              {meal.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    <strong>{item.food.name}</strong> — {item.portionGrams * item.quantity}g
                  </span>
                  <button
                    onClick={() => startTransition(() => { void removeMealItem(item.id, mealPlanId); })}
                    className="text-danger text-xs hover:underline"
                    disabled={isPending}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
