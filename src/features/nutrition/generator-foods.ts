import type { FoodForGenerator } from "@/core/nutrition/meal-plan-generator";
import { prisma } from "@/infrastructure/database/prisma";

/** El generador actual elige por slug de categoría manual; los alimentos del catálogo esperan al generador nuevo (fase C). */
export async function loadFoodsForGenerator(): Promise<FoodForGenerator[]> {
  const foods = await prisma.food.findMany({
    where: { catalogSource: "MANUAL" },
    include: {
      category: true,
      nutrients: { include: { nutrient: true } },
      portions: { where: { isDefault: true }, take: 1 },
    },
  });

  return foods.map((food) => ({
    id: food.id,
    name: food.name,
    categorySlug: food.category.slug,
    defaultPortionGrams: food.portions[0]?.grams ?? 100,
    nutrients: food.nutrients.map((fn) => ({
      nutrientName: fn.nutrient.name,
      unit: fn.nutrient.unit,
      amountPer100g: fn.amountPer100g,
    })),
  }));
}
