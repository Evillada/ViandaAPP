import {
  calculateItemNutrients,
  sumNutritionTotals,
  type FoodNutrientInput,
  type NutritionTotals,
} from "./nutrition-calculator";

export type GeneratorMealType = "BREAKFAST" | "LUNCH" | "DINNER";

export interface FoodForGenerator {
  id: string;
  name: string;
  categorySlug: string;
  nutrients: FoodNutrientInput[];
  defaultPortionGrams: number;
}

export interface GeneratedMealItem {
  foodId: string;
  portionGrams: number;
  quantity: number;
}

export interface GeneratedMeal {
  type: GeneratorMealType;
  items: GeneratedMealItem[];
}

export interface NutritionalGoalsInput {
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const MEAL_SPLITS: Record<GeneratorMealType, number> = {
  BREAKFAST: 0.25,
  LUNCH: 0.4,
  DINNER: 0.35,
};

const MEAL_PREFERENCES: Record<GeneratorMealType, string[]> = {
  BREAKFAST: ["cereales", "lacteos", "frutas", "carnes"],
  LUNCH: ["carnes", "cereales", "leguminosas", "verduras"],
  DINNER: ["carnes", "verduras", "grasas", "lacteos"],
};

function mealTargets(goals: NutritionalGoalsInput, type: GeneratorMealType): NutritionTotals {
  const split = MEAL_SPLITS[type];
  return {
    energyKcal: Math.round(goals.targetKcal * split),
    proteinG: Math.round(goals.proteinG * split),
    carbsG: Math.round(goals.carbsG * split),
    fatG: Math.round(goals.fatG * split),
    fiberG: 0,
  };
}

function distanceToTarget(current: NutritionTotals, target: NutritionTotals): number {
  return (
    Math.abs(current.energyKcal - target.energyKcal) * 2 +
    Math.abs(current.proteinG - target.proteinG) * 4 +
    Math.abs(current.carbsG - target.carbsG) * 2 +
    Math.abs(current.fatG - target.fatG) * 4
  );
}

function exceedsLimits(current: NutritionTotals, target: NutritionTotals, maxRatio = 1.2): boolean {
  return (
    current.energyKcal > target.energyKcal * maxRatio ||
    current.proteinG > target.proteinG * maxRatio ||
    current.carbsG > target.carbsG * maxRatio ||
    current.fatG > target.fatG * maxRatio
  );
}

function buildMeal(
  type: GeneratorMealType,
  foods: FoodForGenerator[],
  goals: NutritionalGoalsInput
): GeneratedMeal {
  const target = mealTargets(goals, type);
  const preferences = MEAL_PREFERENCES[type];

  const candidates = [
    ...preferences.flatMap((slug) => foods.filter((f) => f.categorySlug === slug)),
    ...foods.filter((f) => !preferences.includes(f.categorySlug)),
  ];

  const items: GeneratedMealItem[] = [];
  const usedFoodIds = new Set<string>();
  let current: NutritionTotals = {
    energyKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
  };

  const maxItems = 5;
  const minFillRatio = 0.8;

  while (
    items.length < maxItems &&
    current.energyKcal < target.energyKcal * minFillRatio
  ) {
    let best: { food: FoodForGenerator; grams: number; score: number } | null = null;

    for (const food of candidates) {
      if (usedFoodIds.has(food.id)) continue;

      const multipliers = [0.75, 1, 1.25, 1.5];
      for (const mult of multipliers) {
        const grams = Math.round(food.defaultPortionGrams * mult);
        if (grams < 20) continue;

        const added = calculateItemNutrients(food.nutrients, grams, 1);
        const projected = sumNutritionTotals([current, added]);

        if (exceedsLimits(projected, target)) continue;

        const score = distanceToTarget(current, target) - distanceToTarget(projected, target);
        if (!best || score > best.score) {
          best = { food, grams, score };
        }
      }
    }

    if (!best || best.score <= 0) break;

    items.push({
      foodId: best.food.id,
      portionGrams: best.grams,
      quantity: 1,
    });
    usedFoodIds.add(best.food.id);
    current = sumNutritionTotals([
      current,
      calculateItemNutrients(best.food.nutrients, best.grams, 1),
    ]);
  }

  return { type, items };
}

/** Genera un plan de 3 comidas optimizado hacia las metas nutricionales. */
export function generateAutomaticMealPlan(
  goals: NutritionalGoalsInput,
  foods: FoodForGenerator[]
): GeneratedMeal[] {
  if (foods.length === 0) return [];

  return (["BREAKFAST", "LUNCH", "DINNER"] as GeneratorMealType[]).map((type) =>
    buildMeal(type, foods, goals)
  );
}

export function summarizeGeneratedPlan(meals: GeneratedMeal[], foods: FoodForGenerator[]) {
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const allTotals = meals.flatMap((meal) =>
    meal.items.map((item) => {
      const food = foodMap.get(item.foodId);
      if (!food) return { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
      return calculateItemNutrients(food.nutrients, item.portionGrams, item.quantity);
    })
  );
  return sumNutritionTotals(allTotals);
}
