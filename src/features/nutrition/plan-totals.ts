import {
  calculateItemNutrients,
  sumNutritionTotals,
  type NutritionTotals,
} from "@/core/nutrition/nutrition-calculator";

interface MealItemWithFood {
  portionGrams: number;
  quantity: number;
  food: {
    nutrients: {
      amountPer100g: number;
      nutrient: { name: string; unit: string };
    }[];
  };
}

export function computePlanTotals(items: MealItemWithFood[]): NutritionTotals {
  const totals = items.map((item) =>
    calculateItemNutrients(
      item.food.nutrients.map((fn) => ({
        nutrientName: fn.nutrient.name,
        unit: fn.nutrient.unit,
        amountPer100g: fn.amountPer100g,
      })),
      item.portionGrams,
      item.quantity
    )
  );
  return sumNutritionTotals(totals);
}
