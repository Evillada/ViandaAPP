import {
  calculateItemNutrients,
  sumNutritionTotals,
  type FoodNutrientInput,
  type NutritionTotals,
} from "./nutrition-calculator";

export type GeneratorMealType =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "EVENING_SNACK";

export type MealPlanTemplate = "3_MEALS" | "5_MEALS" | "6_MEALS";

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

const MEAL_SPLITS_3: Record<string, number> = {
  BREAKFAST: 0.25,
  LUNCH: 0.4,
  DINNER: 0.35,
};

const MEAL_SPLITS_5: Record<string, number> = {
  BREAKFAST: 0.25,
  MORNING_SNACK: 0.1,
  LUNCH: 0.3,
  AFTERNOON_SNACK: 0.1,
  DINNER: 0.25,
};

const MEAL_SPLITS_6: Record<string, number> = {
  BREAKFAST: 0.2,
  MORNING_SNACK: 0.1,
  LUNCH: 0.25,
  AFTERNOON_SNACK: 0.1,
  DINNER: 0.25,
  EVENING_SNACK: 0.1,
};

function getSplits(template: MealPlanTemplate): Record<string, number> {
  switch (template) {
    case "5_MEALS": return MEAL_SPLITS_5;
    case "6_MEALS": return MEAL_SPLITS_6;
    default: return MEAL_SPLITS_3;
  }
}

const MEAL_PREFERENCES: Record<string, string[]> = {
  BREAKFAST: ["cereales", "lacteos", "frutas", "carnes"],
  MORNING_SNACK: ["frutas", "lacteos", "cereales"],
  LUNCH: ["carnes", "cereales", "leguminosas", "verduras"],
  AFTERNOON_SNACK: ["frutas", "lacteos", "grasas"],
  DINNER: ["carnes", "verduras", "grasas", "lacteos"],
  EVENING_SNACK: ["lacteos", "frutas"],
};

function mealTargets(
  goals: NutritionalGoalsInput,
  type: GeneratorMealType,
  template: MealPlanTemplate = "3_MEALS"
): NutritionTotals {
  const splits = getSplits(template);
  const split = splits[type] ?? 0.1;
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
  goals: NutritionalGoalsInput,
  template: MealPlanTemplate = "3_MEALS"
): GeneratedMeal {
  const target = mealTargets(goals, type, template);
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

const TEMPLATE_MEALS: Record<MealPlanTemplate, GeneratorMealType[]> = {
  "3_MEALS": ["BREAKFAST", "LUNCH", "DINNER"],
  "5_MEALS": ["BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER"],
  "6_MEALS": ["BREAKFAST", "MORNING_SNACK", "LUNCH", "AFTERNOON_SNACK", "DINNER", "EVENING_SNACK"],
};

/** Genera un plan de N comidas optimizado hacia las metas nutricionales. */
export function generateAutomaticMealPlan(
  goals: NutritionalGoalsInput,
  foods: FoodForGenerator[],
  template: MealPlanTemplate = "3_MEALS"
): GeneratedMeal[] {
  if (foods.length === 0) return [];

  const meals = TEMPLATE_MEALS[template];
  return meals.map((type) => buildMeal(type, foods, goals, template));
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
