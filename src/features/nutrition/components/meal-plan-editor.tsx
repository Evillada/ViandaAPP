"use client";

import { useState, useTransition } from "react";
import { addMealItem, removeMealItem } from "../actions";
import { Button } from "@/shared/ui/components";
import { MEAL_TYPE_LABELS } from "@/shared/lib/labels";

interface Food {
  id: string;
  name: string;
  portions: { name: string; grams: number }[];
}

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
  foods: Food[];
}

export function MealPlanEditor({ mealPlanId, meals, foods }: MealPlanEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedFood, setSelectedFood] = useState(foods[0]?.id ?? "");
  const [grams, setGrams] = useState(foods[0]?.portions[0]?.grams ?? 100);

  const food = foods.find((f) => f.id === selectedFood);

  function handleAdd(mealId: string) {
    if (!selectedFood || !grams) return;
    const fd = new FormData();
    fd.set("mealId", mealId);
    fd.set("foodId", selectedFood);
    fd.set("portionGrams", String(grams));
    fd.set("quantity", "1");
    fd.set("mealPlanId", mealPlanId);
    startTransition(async () => { await addMealItem(fd); });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 p-4 bg-background rounded-xl border border-border">
        <select
          value={selectedFood}
          onChange={(e) => {
            setSelectedFood(e.target.value);
            const f = foods.find((x) => x.id === e.target.value);
            setGrams(f?.portions[0]?.grams ?? 100);
          }}
          className="flex-1 min-w-[200px] rounded-xl border border-border px-3 py-2 text-sm"
        >
          {foods.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <input
          type="number"
          value={grams}
          onChange={(e) => setGrams(Number(e.target.value))}
          className="w-24 rounded-xl border border-border px-3 py-2 text-sm"
          placeholder="g"
        />
        <span className="text-sm text-muted self-center">gramos</span>
        {food?.portions[0] && (
          <span className="text-xs text-muted self-center">
            Porción ref: {food.portions[0].name} ({food.portions[0].grams}g)
          </span>
        )}
      </div>

      {meals.map((meal) => (
        <div key={meal.id} className="border border-border rounded-2xl overflow-hidden">
          <div className="bg-primary-light px-4 py-2 flex items-center justify-between">
            <h4 className="font-semibold text-primary">
              {MEAL_TYPE_LABELS[meal.type] ?? meal.type}
            </h4>
            <Button size="sm" variant="outline" onClick={() => handleAdd(meal.id)} disabled={isPending}>
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
