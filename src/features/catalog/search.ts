import type { Allergen, FoodSource, GabaGroup, HighIn } from "@prisma/client";
import { rankByQuery, searchTokens } from "@/core/catalog/names";
import { prisma } from "@/infrastructure/database/prisma";

export interface FoodSearchResult {
  id: string;
  name: string;
  catalogSource: FoodSource;
  gabaGroup: GabaGroup | null;
  highIn: HighIn[];
  allergens: Allergen[];
  needsReview: boolean;
  portion: { name: string; grams: number };
  per100g: { kcal: number; protein: number; carbs: number; fat: number };
}

const MACROS = { Energía: "kcal", Proteína: "protein", Carbohidratos: "carbs", "Grasas totales": "fat" } as const;
const CANDIDATES = 200;

export async function searchFoods({ query, gabaGroup, limit = 20 }: { query: string; gabaGroup?: GabaGroup; limit?: number }): Promise<FoodSearchResult[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0 && !gabaGroup) return [];

  const foods = await prisma.food.findMany({
    where: {
      AND: tokens.map((token) => ({ searchName: { contains: token } })),
      ...(gabaGroup ? { gabaGroup } : {}),
    },
    select: {
      id: true,
      name: true,
      searchName: true,
      catalogSource: true,
      gabaGroup: true,
      highIn: true,
      allergens: true,
      needsReview: true,
      portions: { where: { isDefault: true }, take: 1, select: { name: true, grams: true } },
      nutrients: { where: { nutrient: { name: { in: Object.keys(MACROS) } } }, select: { amountPer100g: true, nutrient: { select: { name: true } } } },
    },
    orderBy: { searchName: "asc" },
    take: tokens.length > 0 ? CANDIDATES : limit,
  });

  return rankByQuery(foods, query)
    .slice(0, limit)
    .map((food) => {
      const per100g = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      for (const n of food.nutrients) per100g[MACROS[n.nutrient.name as keyof typeof MACROS]] = n.amountPer100g;
      return {
        id: food.id,
        name: food.name,
        catalogSource: food.catalogSource,
        gabaGroup: food.gabaGroup,
        highIn: food.highIn,
        allergens: food.allergens,
        needsReview: food.needsReview,
        portion: food.portions[0] ?? { name: "100 g", grams: 100 },
        per100g,
      };
    });
}
