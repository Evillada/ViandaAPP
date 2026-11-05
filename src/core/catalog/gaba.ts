/**
 * Intercambios de las Guías Alimentarias Basadas en Alimentos para la población colombiana mayor de 2 años
 * (documento técnico, ICBF/FAO 2015, ISBN 978-92-5-308687-0). Cifras transcritas del documento;
 * `scripts/catalog/build-gaba.ts` las vuelve a leer del texto de la fuente y falla si no coinciden.
 */

export type GabaGroup = "CEREALS_TUBERS" | "FRUITS" | "VEGETABLES" | "DAIRY" | "PROTEINS" | "FATS" | "SUGARS";

export type GabaSubgroupKey =
  | "CEREALS"
  | "ROOTS"
  | "TUBERS"
  | "PLANTAINS"
  | "FRUITS"
  | "VEGETABLES"
  | "MILK_WHOLE"
  | "DAIRY_WHOLE"
  | "MILK_REDUCED_FAT"
  | "DAIRY_REDUCED_FAT"
  | "LEAN_MEATS"
  | "HIGH_FAT_MEATS"
  | "EGGS"
  | "LEGUMES"
  | "NUTS_SEEDS"
  | "FATS_POLYUNSATURATED"
  | "FATS_MONOUNSATURATED"
  | "FATS_SATURATED"
  | "SUGARS_SIMPLE"
  | "SWEETS";

export interface GabaSubgroup {
  key: GabaSubgroupKey;
  /** Tabla del documento técnico con la lista de intercambio. */
  table: number;
  /** Grupo y subgrupo tal como los numera el documento. */
  sourceGroup: string;
  sourceSubgroup: string;
  group: GabaGroup;
}

/** Tablas 26–45. Raíces, tubérculos y plátanos pertenecen al grupo I (cereales). */
export const GABA_SUBGROUPS: GabaSubgroup[] = [
  { key: "CEREALS", table: 26, sourceGroup: "I", sourceSubgroup: "I", group: "CEREALS_TUBERS" },
  { key: "ROOTS", table: 27, sourceGroup: "I", sourceSubgroup: "II", group: "CEREALS_TUBERS" },
  { key: "TUBERS", table: 28, sourceGroup: "I", sourceSubgroup: "III", group: "CEREALS_TUBERS" },
  { key: "PLANTAINS", table: 29, sourceGroup: "I", sourceSubgroup: "IV", group: "CEREALS_TUBERS" },
  { key: "FRUITS", table: 30, sourceGroup: "II", sourceSubgroup: "I", group: "FRUITS" },
  { key: "VEGETABLES", table: 31, sourceGroup: "II", sourceSubgroup: "II", group: "VEGETABLES" },
  { key: "MILK_WHOLE", table: 32, sourceGroup: "III", sourceSubgroup: "I-A", group: "DAIRY" },
  { key: "DAIRY_WHOLE", table: 33, sourceGroup: "III", sourceSubgroup: "II-A", group: "DAIRY" },
  { key: "MILK_REDUCED_FAT", table: 34, sourceGroup: "III", sourceSubgroup: "I-B", group: "DAIRY" },
  { key: "DAIRY_REDUCED_FAT", table: 35, sourceGroup: "III", sourceSubgroup: "II-B", group: "DAIRY" },
  { key: "LEAN_MEATS", table: 36, sourceGroup: "IV", sourceSubgroup: "I-A", group: "PROTEINS" },
  { key: "HIGH_FAT_MEATS", table: 37, sourceGroup: "IV", sourceSubgroup: "I-B", group: "PROTEINS" },
  { key: "EGGS", table: 38, sourceGroup: "IV", sourceSubgroup: "II", group: "PROTEINS" },
  { key: "LEGUMES", table: 39, sourceGroup: "IV", sourceSubgroup: "III", group: "PROTEINS" },
  { key: "NUTS_SEEDS", table: 40, sourceGroup: "IV", sourceSubgroup: "IV", group: "PROTEINS" },
  { key: "FATS_POLYUNSATURATED", table: 41, sourceGroup: "V", sourceSubgroup: "I", group: "FATS" },
  { key: "FATS_MONOUNSATURATED", table: 42, sourceGroup: "V", sourceSubgroup: "II", group: "FATS" },
  { key: "FATS_SATURATED", table: 43, sourceGroup: "V", sourceSubgroup: "III", group: "FATS" },
  { key: "SUGARS_SIMPLE", table: 44, sourceGroup: "VI", sourceSubgroup: "I", group: "SUGARS" },
  { key: "SWEETS", table: 45, sourceGroup: "VI", sourceSubgroup: "II", group: "SUGARS" },
];

export interface ExchangeMacros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

/** Aporte promedio de un intercambio: fila "Aporte nutricional promedio del intercambio" de cada tabla 26–45 (= tabla 46). */
export const EXCHANGE_AVERAGES: Record<GabaSubgroupKey, ExchangeMacros> = {
  CEREALS: { kcal: 88, protein: 2.2, fat: 1.5, carbs: 16.7, fiber: 1.1 },
  ROOTS: { kcal: 90, protein: 0.9, fat: 0.1, carbs: 21.7, fiber: 3.0 },
  TUBERS: { kcal: 93, protein: 2.2, fat: 0.1, carbs: 21.3, fiber: 1.9 },
  PLANTAINS: { kcal: 92, protein: 0.9, fat: 0.1, carbs: 23.8, fiber: 1.7 },
  FRUITS: { kcal: 55, protein: 1.0, fat: 0.3, carbs: 13.9, fiber: 2.3 },
  VEGETABLES: { kcal: 24, protein: 1.3, fat: 0.3, carbs: 5.3, fiber: 1.6 },
  MILK_WHOLE: { kcal: 129, protein: 7.0, fat: 7.2, carbs: 9.5, fiber: 0 },
  DAIRY_WHOLE: { kcal: 86, protein: 5.6, fat: 5.3, carbs: 3.9, fiber: 0 },
  MILK_REDUCED_FAT: { kcal: 87, protein: 7.7, fat: 1.2, carbs: 11.3, fiber: 0 },
  DAIRY_REDUCED_FAT: { kcal: 87, protein: 8.2, fat: 0.5, carbs: 12.3, fiber: 0 },
  LEAN_MEATS: { kcal: 79, protein: 9.9, fat: 4.1, carbs: 2.0, fiber: 0 },
  HIGH_FAT_MEATS: { kcal: 113, protein: 12.4, fat: 6.3, carbs: 0.7, fiber: 0 },
  EGGS: { kcal: 77, protein: 6.5, fat: 5.3, carbs: 0.4, fiber: 0 },
  LEGUMES: { kcal: 82, protein: 4.9, fat: 1.0, carbs: 13.3, fiber: 3.9 },
  NUTS_SEEDS: { kcal: 55, protein: 1.5, fat: 5.1, carbs: 1.9, fiber: 0.8 },
  FATS_POLYUNSATURATED: { kcal: 44, protein: 0, fat: 5.0, carbs: 0, fiber: 0 },
  FATS_MONOUNSATURATED: { kcal: 45, protein: 0.2, fat: 4.9, carbs: 0.7, fiber: 0.5 },
  FATS_SATURATED: { kcal: 45, protein: 0.5, fat: 4.8, carbs: 0.5, fiber: 0.2 },
  SUGARS_SIMPLE: { kcal: 81, protein: 0.1, fat: 0, carbs: 21.7, fiber: 0 },
  SWEETS: { kcal: 86, protein: 0.7, fat: 0.8, carbs: 20.5, fiber: 0.9 },
};

/** La tabla 56 cuenta verduras y frutas como un solo grupo de intercambio. */
export const DAILY_GROUPS = ["CEREALS_TUBERS", "FRUITS_VEGETABLES", "DAIRY", "PROTEINS", "FATS", "SUGARS"] as const;
export type DailyGroup = (typeof DAILY_GROUPS)[number];

export type DailyColumn = "2-5" | "6-9" | "10-13" | "14-17:M" | "14-17:F" | "18-59:M" | "18-59:F" | "60+";

const column = (values: number[]): Record<DailyGroup, number> =>
  Object.fromEntries(DAILY_GROUPS.map((group, i) => [group, values[i]])) as Record<DailyGroup, number>;

/** Tabla 56: intercambios por día. Orden: cereales, verduras y frutas, lácteos, carnes/huevos/leguminosas, grasas, azúcares. */
export const DAILY_EXCHANGES: Record<DailyColumn, Record<DailyGroup, number>> = {
  "2-5": column([3.5, 2.0, 2.0, 4.5, 3.0, 1.0]),
  "6-9": column([4.0, 2.5, 2.5, 5.0, 3.0, 2.0]),
  "10-13": column([5.5, 3.5, 3.5, 6.0, 4.0, 3.0]),
  "14-17:M": column([8.5, 5.5, 5.0, 8.0, 5.0, 3.5]),
  "14-17:F": column([6.0, 4.0, 3.5, 6.5, 4.0, 3.0]),
  "18-59:M": column([8.0, 5.0, 5.0, 7.5, 5.0, 3.0]),
  "18-59:F": column([6.0, 4.0, 3.5, 6.5, 4.0, 3.0]),
  "60+": column([5.5, 3.5, 3.5, 6.0, 5.0, 3.0]),
};

/**
 * Columna de la tabla 56 para una edad en años. Entre 14 y 59 años la tabla distingue sexo: sin sexo
 * binario no se elige una columna por defecto (lo decide el profesional). Menores de 2 años: fuera de las GABA.
 */
export function dailyExchangesFor(age: number, sex: "MALE" | "FEMALE" | "OTHER" | null): Record<DailyGroup, number> | null {
  if (age < 2) return null;
  if (age <= 5) return DAILY_EXCHANGES["2-5"];
  if (age <= 9) return DAILY_EXCHANGES["6-9"];
  if (age <= 13) return DAILY_EXCHANGES["10-13"];
  if (age >= 60) return DAILY_EXCHANGES["60+"];
  if (sex !== "MALE" && sex !== "FEMALE") return null;
  const band = age <= 17 ? "14-17" : "18-59";
  return DAILY_EXCHANGES[`${band}:${sex === "MALE" ? "M" : "F"}`];
}
