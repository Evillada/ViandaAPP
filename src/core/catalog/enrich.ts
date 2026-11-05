import { parseCsv } from "./corrections";
import { EXCHANGE_AVERAGES, GABA_SUBGROUPS, type GabaGroup, type GabaSubgroupKey } from "./gaba";
import { normalizeSearch } from "./names";
import type { TcacField } from "./tcac-parse";

export interface CatalogFood {
  code: string;
  name: string;
  part: string | null;
  values: Partial<Record<TcacField, number | null>>;
}

export type Allergen = "GLUTEN" | "MILK" | "EGG" | "PEANUT" | "TREE_NUTS" | "FISH" | "SHELLFISH" | "SOY" | "SESAME";
export type HighIn = "SODIUM" | "SATURATED_FAT";

export interface ExchangeMatch {
  subgroup: GabaSubgroupKey;
  grams: number;
  measure: string;
}

const NO_MATCHES: ReadonlyMap<string, ExchangeMatch> = new Map();

/** Sólo las filas de gaba-matches.csv con confirmed = 1. */
export function confirmedMatches(csv: string): Map<string, ExchangeMatch> {
  const [header, ...rows] = parseCsv(csv);
  const col = (name: string) => header.indexOf(name);
  return new Map(
    rows
      .filter((row) => row[col("confirmed")] === "1")
      .map((row) => [
        row[col("tcac_code")],
        { subgroup: row[col("gaba_subgroup")] as GabaSubgroupKey, grams: Number(row[col("grams")]), measure: row[col("measure")] },
      ])
  );
}

export interface Exchange {
  grams: number;
  measure: string | null;
  estimated: boolean;
}

const has = (text: string, pattern: RegExp) => pattern.test(text);
const groupLetter = (food: CatalogFood) => food.code[0];
const searchText = (food: CatalogFood) => normalizeSearch(food.name);

const ROOTS = /^(yuca|arracacha|achira|ñame|malanga|almidon de (yuca|achira|arracacha)|harina de (yuca|achira|arracacha))/;
const TUBERS = /^(papa|batata|harina de papa|oll[ou]co|majua|cubio|oca|ruba|chugua)\b/;
const PLANTAINS = /^(platano|harina de (platano|banano))/;
const TREE_NUTS = /\b(almendras?|nuez|nueces|marañon|pistachos?|avellanas?|macadamia|pecanas?)\b/;
const VISCERA = /\b(higado|riñon|corazon|lengua|callo|mondongo|panza|bofe|pulmon|pajarilla|bazo|ubre|sesos|menudencias?|molleja)\b/;
const SHELLFISH = /\b(almejas?|calamar|camaron|cangrejo|caracol|jaiba|langost\w*|ostras?|pulpo|piangua|chipichipi|mejillon)\b/;
const HIGH_FAT_MEATS_FAT = 10;

// Fuera del grupo E sólo nombres inequívocos: "dorado" o "lisa" también describen preparaciones o texturas.
const FISH = /\b(pescado|atun|salmon|sardinas?|bagre|bocachico|tilapia|mojarra|trucha|pirarucu|bacalao|robalo|corvina|merluza|cachama|anchoas?)\b/;

function meatSubgroup(food: CatalogFood, text: string): GabaSubgroupKey {
  const fat = food.values.fat ?? 0;
  if (has(text, VISCERA) || has(text, /\b(camaron|langostinos?)\b/)) return "HIGH_FAT_MEATS";
  // Las GABA dejan el pescado en magras aunque sea graso (su grasa es insaturada), salvo la sardina.
  if (groupLetter(food) === "E") return has(text, /^sardinas?/) ? "HIGH_FAT_MEATS" : "LEAN_MEATS";
  return fat >= HIGH_FAT_MEATS_FAT ? "HIGH_FAT_MEATS" : "LEAN_MEATS";
}

function fatSubgroup(text: string): GabaSubgroupKey {
  if (has(text, /mantequilla de mani/)) return "NUTS_SEEDS";
  if (has(text, /oliva|canola|aguacate|margarina/)) return "FATS_MONOUNSATURATED";
  if (has(text, /palma|manteca|mantequilla|coco|sebo|tocino/)) return "FATS_SATURATED";
  return "FATS_POLYUNSATURATED";
}

function dairySubgroup(text: string): GabaSubgroupKey | null {
  if (has(text, /leche humana/)) return null;
  if (has(text, /crema de leche|queso crema/)) return "FATS_SATURATED";
  if (has(text, /condensada|arequipe|manjar/)) return "SWEETS";
  const reduced = has(text, /descremad|semidescremad|magr[oa]|deslactosad[oa], descremad|lactosuero|bajo en grasa|light/);
  if (has(text, /^leche/)) return reduced ? "MILK_REDUCED_FAT" : "MILK_WHOLE";
  return reduced ? "DAIRY_REDUCED_FAT" : "DAIRY_WHOLE";
}

/** Subgrupo GABA por grupo de la tabla, con las excepciones que las propias GABA hacen (aguacate es grasa, maní es semilla…). */
export function gabaSubgroupFor(food: CatalogFood, confirmed = NO_MATCHES): GabaSubgroupKey | null {
  return confirmed.get(food.code)?.subgroup ?? subgroupByRules(food);
}

function subgroupByRules(food: CatalogFood): GabaSubgroupKey | null {
  const text = searchText(food);
  switch (groupLetter(food)) {
    case "A":
      return "CEREALS";
    case "B":
      if (has(text, PLANTAINS)) return "PLANTAINS";
      if (has(text, TUBERS)) return "TUBERS";
      if (has(text, ROOTS)) return "ROOTS";
      if (has(text, /^aceitunas?/)) return "FATS_MONOUNSATURATED";
      return "VEGETABLES";
    case "C":
      if (has(text, /^aguacate/)) return "FATS_MONOUNSATURATED";
      // Con más de 50 % de agua es la fruta (p. ej. el pseudofruto del marañón), no la nuez.
      if ((has(text, TREE_NUTS) && (food.values.moisture ?? 0) < 50) || has(text, /^coco/)) return "NUTS_SEEDS";
      if (has(text, PLANTAINS)) return "PLANTAINS";
      return "FRUITS";
    case "D":
      return fatSubgroup(text);
    case "E":
    case "F":
      return meatSubgroup(food, text);
    case "G":
      return dairySubgroup(text);
    case "J":
      return "EGGS";
    case "K":
      return has(text, /^(azucar|panela|miel|melaza)/) ? "SUGARS_SIMPLE" : "SWEETS";
    case "N":
      if (has(text, /^(margarina|mayonesa)/)) return fatSubgroup(text);
      if (has(text, /^yogur/)) return dairySubgroup(text);
      if (has(text, /^mermelada/)) return "SWEETS";
      if (has(text, /^salchich/)) return meatSubgroup(food, text);
      return null;
    case "P":
      if (has(text, ROOTS) || has(text, /^(almidon|harina) de (malanga|ñame)|^casabe/)) return "ROOTS";
      if (has(text, TUBERS)) return "TUBERS";
      if (has(text, /sacha inchi|semillas? de|^nuez/)) return "NUTS_SEEDS";
      if (has(normalizeSearch(food.part ?? ""), /pulpa/)) return "FRUITS";
      return null;
    case "T":
      if (has(text, /^(ajonjoli|mani)\b/)) return "NUTS_SEEDS";
      if (has(text, /bebida/)) return null;
      return "LEGUMES";
    default:
      return null;
  }
}

const GROUP_BY_SUBGROUP = new Map(GABA_SUBGROUPS.map((s) => [s.key, s.group]));

export function gabaGroupFor(food: CatalogFood, confirmed = NO_MATCHES): GabaGroup | null {
  const subgroup = gabaSubgroupFor(food, confirmed);
  return subgroup ? (GROUP_BY_SUBGROUP.get(subgroup) ?? null) : null;
}

/** Porción de intercambio: la de la lista GABA si hay coincidencia confirmada; si no, los gramos que aportan la energía promedio del subgrupo. */
export function exchangeFor(food: CatalogFood, confirmed: ReadonlyMap<string, ExchangeMatch>): Exchange | null {
  const match = confirmed.get(food.code);
  if (match) return { grams: match.grams, measure: match.measure, estimated: false };
  const subgroup = gabaSubgroupFor(food);
  const kcal = food.values.energyKcal;
  if (!subgroup || !kcal) return null;
  return { grams: Math.round(EXCHANGE_AVERAGES[subgroup].kcal / (kcal / 100)), measure: null, estimated: true };
}

const ALLERGEN_PATTERNS: [Allergen, RegExp][] = [
  ["GLUTEN", /\b(trigo|cebada|centeno|avena|pan(?! de yuca)|panes|galletas?|ponque|pasta alimenticia|espaguetis?|macarron\w*|croissant|hojaldre|muffin|brownie|roscon|mogolla|cerveza|malta|mantecada|pancakes?|calados?|bienestarina|seitan|cuscus|salvado)\b/],
  ["MILK", /\b(leche|lacteo|queso|cuajada|crema|yogur\w*|kumis|arequipe|manjar|suero|lactosuero|bienestarina|helado de (crema|leche)|chocolatina|almojabana|pandebono|pan de yuca|ponque|croissant)\b|mantequilla(?! de mani)/],
  ["EGG", /\b(huevos?|mayonesa|ponque|merengue|pancakes?|natilla)\b/],
  ["PEANUT", /\bmani\b/],
  ["TREE_NUTS", TREE_NUTS],
  ["FISH", FISH],
  ["SHELLFISH", SHELLFISH],
  ["SOY", /\b(soya|soja|tofu|bienestarina)\b/],
  ["SESAME", /\b(ajonjoli|sesamo)\b/],
];

/** Propuesta conservadora: marca de más antes que de menos. La confirma la nutricionista (allergen-review.csv). */
export function allergensFor(food: CatalogFood): Allergen[] {
  const text = withoutFalseFriends(searchText(food));
  const letter = groupLetter(food);
  return ALLERGEN_PATTERNS.filter(([allergen, pattern]) => {
    if (allergen === "MILK" && letter === "G") return true;
    if (allergen === "EGG" && letter === "J") return true;
    if (allergen === "FISH" && letter === "E") return !has(text, SHELLFISH);
    return has(text, pattern);
  }).map(([allergen]) => allergen);
}

const withoutFalseFriends = (text: string) => text.replace(/arbol del pan|para pan\b/g, "");

// Productos industriales (Res. 2492 aplica a empacados). Lo frito o con sal en casa y los platos típicos (grupo S) no lo son.
const PROCESSED_GROUPS = new Set(["K", "N", "R"]);
const PROCESSED = /\b(con azucar|salad[oa]s?|enlatad[oa]s?|en conserva|en almibar|encurtid[oa]s?|ahumad[oa]s?|precocid[oa]s?|nectar|gaseosa|salchich\w*|chorizo|jamon|mortadela|butifarra|morcilla|galletas?|ponque|pan|panes|mayonesa|margarina|hojaldre|croissant|roscon|mantecada|brownie|almojabana|pandebono|cereal para el desayuno|mezcla lista)\b/;

export function isProcessed(food: CatalogFood): boolean {
  return PROCESSED_GROUPS.has(groupLetter(food)) || has(withoutFalseFriends(searchText(food)), PROCESSED);
}

/** Sellos de la Resolución 2492 de 2022 para sólidos. Sin dato no se asume cero: no hay sello. */
export function highInFor(food: CatalogFood): HighIn[] {
  if (!isProcessed(food)) return [];
  const { energyKcal: kcal, sodium, saturatedFat } = food.values;
  const result: HighIn[] = [];
  if (sodium != null && (sodium >= 300 || (kcal != null && kcal > 0 && sodium / kcal >= 1))) result.push("SODIUM");
  if (saturatedFat != null && kcal != null && kcal > 0 && (saturatedFat * 9) / kcal >= 0.1) result.push("SATURATED_FAT");
  return result;
}

export function needsReview(food: CatalogFood): boolean {
  return allergensFor(food).length > 0 || ["R", "S"].includes(groupLetter(food));
}
