import type { Allergen, FoodSource, GabaGroup, HighIn } from "@prisma/client";
import { rankByQuery, searchTokens } from "@/core/catalog/names";
import { prisma } from "@/infrastructure/database/prisma";

type Macro = "kcal" | "protein" | "carbs" | "fat";

export interface FoodSearchResult {
  id: string;
  name: string;
  catalogSource: FoodSource;
  gabaGroup: GabaGroup | null;
  highIn: HighIn[];
  allergens: Allergen[];
  needsReview: boolean;
  isProcessed: boolean;
  exchangeEstimated: boolean;
  portion: { name: string; grams: number };
  /** `null` = la fuente no reporta el dato; no equivale a 0. */
  per100g: Record<Macro, number | null>;
}

const MACROS = { Energía: "kcal", Proteína: "protein", Carbohidratos: "carbs", "Grasas totales": "fat" } as const;
const CANDIDATES = 200;
const MIN_QUERY_LENGTH = 2;

export async function searchFoods({ query, gabaGroup, limit = 20 }: { query: string; gabaGroup?: GabaGroup; limit?: number }): Promise<FoodSearchResult[]> {
  const tokens = searchTokens(query);
  if (!gabaGroup && tokens.join("").length < MIN_QUERY_LENGTH) return [];

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
      isProcessed: true,
      exchangeEstimated: true,
      portions: { where: { isDefault: true }, take: 1, select: { name: true, grams: true } },
      nutrients: { where: { nutrient: { name: { in: Object.keys(MACROS) } } }, select: { amountPer100g: true, nutrient: { select: { name: true } } } },
    },
    orderBy: { searchName: "asc" },
    take: tokens.length > 0 ? CANDIDATES : limit,
  });

  return rankByQuery(foods, query)
    .slice(0, limit)
    .map((food) => {
      const per100g: Record<Macro, number | null> = { kcal: null, protein: null, carbs: null, fat: null };
      for (const n of food.nutrients) per100g[MACROS[n.nutrient.name as keyof typeof MACROS]] = n.amountPer100g;
      return {
        id: food.id,
        name: food.name,
        catalogSource: food.catalogSource,
        gabaGroup: food.gabaGroup,
        highIn: food.highIn,
        allergens: food.allergens,
        needsReview: food.needsReview,
        isProcessed: food.isProcessed,
        exchangeEstimated: food.exchangeEstimated,
        portion: food.portions[0] ?? { name: "100 g", grams: 100 },
        per100g,
      };
    });
}
