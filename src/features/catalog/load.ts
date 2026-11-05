import type { PrismaClient } from "@prisma/client";
import { TCAC_GROUPS, TCAC_NUTRIENTS, type CatalogEntry } from "@/core/catalog/catalog-entry";
import { normalizeSearch } from "@/core/catalog/names";
import { prisma as defaultClient } from "@/infrastructure/database/prisma";

export interface LoadResult {
  created: number;
  updated: number;
  manualIndexed: number;
}

// El pooler de Supabase tiene pocas conexiones: pocas transacciones a la vez y espera amplia.
const CONCURRENCY = 4;
const TRANSACTION_OPTIONS = { maxWait: 30_000, timeout: 30_000 };

/**
 * Carga idempotente del catálogo TCAC: upsert por código. Nunca borra alimentos (pueden estar en planes);
 * los nutrientes y porciones de cada alimento TCAC se reemplazan para reflejar el CSV. Los alimentos MANUAL
 * sólo reciben su searchName.
 */
export async function loadCatalog(entries: CatalogEntry[], db: PrismaClient = defaultClient): Promise<LoadResult> {
  const nutrientIds = new Map<string, string>();
  for (const nutrient of Object.values(TCAC_NUTRIENTS)) {
    const row = await db.nutrient.upsert({ where: { name: nutrient!.name }, update: {}, create: nutrient! });
    nutrientIds.set(row.name, row.id);
  }

  const categoryIds = new Map<string, string>();
  for (const [letter, title] of Object.entries(TCAC_GROUPS)) {
    const slug = `tcac-${letter.toLowerCase()}`;
    const name = `${letter}. ${title}`;
    const row = await db.foodCategory.upsert({ where: { slug }, update: { name }, create: { slug, name } });
    categoryIds.set(letter, row.id);
  }

  const existing = new Set(
    (await db.food.findMany({ where: { code: { in: entries.map((e) => e.code) } }, select: { code: true } })).map((f) => f.code)
  );

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    await Promise.all(entries.slice(i, i + CONCURRENCY).map((entry) => upsertEntry(db, entry, nutrientIds, categoryIds)));
  }

  const manual = await db.food.findMany({ where: { catalogSource: "MANUAL" }, select: { id: true, name: true } });
  for (const food of manual) {
    await db.food.update({ where: { id: food.id }, data: { searchName: normalizeSearch(food.name) } });
  }

  const created = entries.filter((e) => !existing.has(e.code)).length;
  return { created, updated: entries.length - created, manualIndexed: manual.length };
}

async function upsertEntry(db: PrismaClient, entry: CatalogEntry, nutrientIds: Map<string, string>, categoryIds: Map<string, string>) {
  const categoryId = categoryIds.get(entry.groupLetter);
  if (!categoryId) throw new Error(`${entry.code}: grupo TCAC desconocido ${entry.groupLetter}`);
  const data = {
    name: entry.name,
    source: "ICBF",
    isGlobal: true,
    catalogSource: "TCAC_2018" as const,
    sourceRef: entry.sourceRef,
    gabaGroup: entry.gabaGroup,
    gabaSubgroup: entry.gabaSubgroup,
    isProcessed: entry.isProcessed,
    allergens: entry.allergens,
    highIn: entry.highIn,
    exchangeGrams: entry.exchangeGrams,
    exchangeMeasure: entry.exchangeMeasure,
    exchangeEstimated: entry.exchangeEstimated,
    edibleFraction: entry.edibleFraction,
    searchName: entry.searchName,
    needsReview: entry.needsReview,
    categoryId,
  };
  await db.$transaction(async (tx) => {
    const food = await tx.food.upsert({ where: { code: entry.code }, update: data, create: { code: entry.code, ...data } });
    await tx.foodNutrient.deleteMany({ where: { foodId: food.id } });
    await tx.foodNutrient.createMany({
      data: entry.nutrients.map((n) => ({ foodId: food.id, nutrientId: nutrientIds.get(n.name)!, amountPer100g: n.amountPer100g, source: "TCAC_2018" as const })),
    });
    await tx.foodPortion.deleteMany({ where: { foodId: food.id } });
    await tx.foodPortion.createMany({ data: entry.portions.map((p) => ({ foodId: food.id, ...p })) });
  }, TRANSACTION_OPTIONS);
}
