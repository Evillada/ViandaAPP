import { parseCsv } from "./corrections";
import {
  allergensFor,
  exchangeFor,
  gabaGroupFor,
  gabaSubgroupFor,
  highInFor,
  isProcessed,
  needsReview,
  type Allergen,
  type CatalogFood,
  type ExchangeMatch,
  type HighIn,
} from "./enrich";
import type { GabaGroup, GabaSubgroupKey } from "./gaba";
import { normalizeSearch } from "./names";
import { ALL_FIELDS, type TcacField } from "./tcac-parse";

export interface TcacCsvRow extends CatalogFood {
  sourcePage: number;
  ocrNeedsReview: boolean;
}

/** Títulos de grupo tal como aparecen en la TCAC 2018. */
export const TCAC_GROUPS: Record<string, string> = {
  A: "Cereales y derivados",
  B: "Verduras, hortalizas y derivados",
  C: "Frutas y derivados",
  D: "Grasas y aceites",
  E: "Pescados y mariscos",
  F: "Carnes y derivados",
  G: "Leche y derivados",
  H: "Bebidas (alcohólicas y no alcohólicas)",
  J: "Huevos y derivados",
  K: "Productos azucarados",
  L: "Misceláneos",
  N: "Alimentos para regímenes especiales",
  P: "Alimentos nativos",
  R: "Alimentos manufacturados",
  S: "Alimentos preparados",
  T: "Leguminosas y derivados",
};

/** Nutriente de la base para cada columna de la TCAC. "Carbohidratos" son los totales; kJ no se guarda (se deriva de kcal). */
export const TCAC_NUTRIENTS: Partial<Record<TcacField, { name: string; unit: string; category: "ENERGY" | "MACRO" | "LIPID" | "MINERAL" }>> = {
  energyKcal: { name: "Energía", unit: "kcal", category: "ENERGY" },
  protein: { name: "Proteína", unit: "g", category: "MACRO" },
  fat: { name: "Grasas totales", unit: "g", category: "LIPID" },
  carbsTotal: { name: "Carbohidratos", unit: "g", category: "MACRO" },
  carbsAvailable: { name: "Carbohidratos disponibles", unit: "g", category: "MACRO" },
  fiber: { name: "Fibra", unit: "g", category: "MACRO" },
  moisture: { name: "Humedad", unit: "g", category: "MACRO" },
  ash: { name: "Cenizas", unit: "g", category: "MACRO" },
  sodium: { name: "Sodio", unit: "mg", category: "MINERAL" },
  saturatedFat: { name: "Grasas saturadas", unit: "g", category: "LIPID" },
};

export function parseTcacCsv(csv: string): TcacCsvRow[] {
  const [header, ...rows] = parseCsv(csv);
  const col = (name: string) => header.indexOf(name);
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => ({
      code: row[col("code")],
      name: row[col("name")],
      part: row[col("part")] || null,
      values: Object.fromEntries(ALL_FIELDS.map((field) => [field, row[col(field)] === "" ? null : Number(row[col(field)])])),
      sourcePage: Number(row[col("source_page")]),
      ocrNeedsReview: row[col("needs_review")] === "true",
    }));
}

export interface CatalogEntry {
  code: string;
  name: string;
  groupLetter: string;
  sourceRef: string;
  searchName: string;
  gabaGroup: GabaGroup | null;
  gabaSubgroup: GabaSubgroupKey | null;
  isProcessed: boolean;
  allergens: Allergen[];
  highIn: HighIn[];
  exchangeGrams: number | null;
  exchangeMeasure: string | null;
  exchangeEstimated: boolean;
  edibleFraction: number | null;
  needsReview: boolean;
  nutrients: { name: string; amountPer100g: number }[];
  portions: { name: string; grams: number; isDefault: boolean }[];
}

export function catalogEntry(row: TcacCsvRow, matches: ReadonlyMap<string, ExchangeMatch>): CatalogEntry {
  const exchange = exchangeFor(row, matches);
  const nutrients = Object.entries(TCAC_NUTRIENTS).flatMap(([field, nutrient]) => {
    const value = row.values[field as TcacField];
    return value == null ? [] : [{ name: nutrient!.name, amountPer100g: value }];
  });
  const exchangeName = exchange?.measure ? `1 intercambio · ${exchange.measure}` : "1 intercambio";
  return {
    code: row.code,
    name: row.name,
    groupLetter: row.code[0],
    sourceRef: `TCAC 2018, p. ${row.sourcePage}`,
    searchName: normalizeSearch(row.name),
    gabaGroup: gabaGroupFor(row, matches),
    gabaSubgroup: gabaSubgroupFor(row, matches),
    isProcessed: isProcessed(row),
    allergens: allergensFor(row),
    highIn: highInFor(row),
    exchangeGrams: exchange?.grams ?? null,
    exchangeMeasure: exchange?.measure ?? null,
    exchangeEstimated: exchange?.estimated ?? false,
    edibleFraction: row.values.edibleFraction ?? null,
    needsReview: row.ocrNeedsReview || needsReview(row),
    nutrients,
    portions: exchange
      ? [
          { name: exchangeName, grams: exchange.grams, isDefault: true },
          { name: "100 g", grams: 100, isDefault: false },
        ]
      : [{ name: "100 g", grams: 100, isDefault: true }],
  };
}
