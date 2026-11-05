/**
 * Lee las listas de intercambio (tablas 26–45) del texto del documento técnico de las GABA Colombia 2015.
 * El texto viene de la extracción del PDF: cada tabla repite su encabezado en cada página y algunas medidas
 * caseras quedan partidas alrededor de la línea del alimento.
 */

export interface ExchangeFood {
  name: string;
  grams: number;
  measure: string;
}

/** Aporte promedio de un intercambio, en el orden de columnas del documento. */
export interface ExchangeAverage {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  calcium: number;
  iron: number;
  zinc: number;
  vitaminA: number;
  vitaminC: number;
}

export interface ExchangeTable {
  table: number;
  /** Número romano del grupo ("I" … "VI"). */
  group: string;
  /** Código del subgrupo tal como lo publica el documento ("I", "I-A", "II-B"). */
  subgroup: string;
  subgroupName: string;
  foods: ExchangeFood[];
  average: ExchangeAverage | null;
}

const TABLE_START = /^Tabla (\d+)\. Listado de alimentos que representan un intercambio/;
const ANY_TABLE = /^Tabla \d+\./;
const GROUP = /^Grupo\s+([IVX]+)\s+\S/;
const SUBGROUP = /^Subgrupo\s+([IVX]+(?:\s*-\s*[AB])?)\s*\.\s*(.+)$/;
const FOOD = /^(\p{L}.*?)\s+(\d+)\s+(\d.*)$/u;
const FOOD_WITHOUT_MEASURE = /^(\p{L}.*?)\s+(\d+)$/u;
const MEASURE_START = /^\d+(?:\/\d+)?\s+\p{L}/u;
const AVERAGE_FIELDS: (keyof ExchangeAverage)[] = ["kcal", "protein", "fat", "carbs", "fiber", "calcium", "iron", "zinc", "vitaminA", "vitaminC"];

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const toNumber = (raw: string) => Number(raw.replace(",", "."));

function parseAverage(line: string): ExchangeAverage | null {
  const tokens = clean(line).split(" ");
  if (tokens.length !== AVERAGE_FIELDS.length || !tokens.every((t) => /^\d+(?:[.,]\d+)?$/.test(t))) return null;
  return Object.fromEntries(AVERAGE_FIELDS.map((field, i) => [field, toNumber(tokens[i])])) as unknown as ExchangeAverage;
}

function parseBlock(table: number, lines: string[]): ExchangeTable | null {
  let group = "";
  let subgroup = "";
  let subgroupName = "";
  const foods: ExchangeFood[] = [];
  let average: ExchangeAverage | null = null;
  let inAverage = false;
  let measurePrefix: string | null = null;
  let openMeasure: ExchangeFood | null = null;

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;
    if (inAverage) {
      average ??= parseAverage(line);
      continue;
    }
    if (line.startsWith("Aporte nutricional promedio")) {
      inAverage = true;
      continue;
    }
    const groupMatch = GROUP.exec(line);
    if (groupMatch) {
      group = groupMatch[1];
      continue;
    }
    const subgroupMatch = SUBGROUP.exec(line);
    if (subgroupMatch) {
      subgroup = subgroupMatch[1].replace(/\s+/g, "");
      subgroupName = clean(subgroupMatch[2]);
      continue;
    }

    // Una medida que quedó sin terminar continúa en la línea siguiente ("… o 2/3 de" / "pocillo").
    if (openMeasure && /^\p{Ll}/u.test(line)) {
      openMeasure.measure = clean(`${openMeasure.measure} ${line}`);
      openMeasure = null;
      continue;
    }
    openMeasure = null;

    const food = FOOD.exec(line);
    if (food) {
      foods.push({ name: clean(food[1].replace(/\*+/g, "")), grams: Number(food[2]), measure: clean(food[3]) });
      measurePrefix = null;
      continue;
    }
    const bare = FOOD_WITHOUT_MEASURE.exec(line);
    if (bare && measurePrefix) {
      const entry = { name: clean(bare[1].replace(/\*+/g, "")), grams: Number(bare[2]), measure: measurePrefix };
      foods.push(entry);
      openMeasure = entry;
      measurePrefix = null;
      continue;
    }
    measurePrefix = MEASURE_START.test(line) ? line : null;
  }

  if (!foods.length || !group || !subgroup) return null;
  return { table, group, subgroup, subgroupName, foods, average };
}

export function parseExchangeTables(text: string): ExchangeTable[] {
  const lines = text.split(/\r?\n/);
  const byTable = new Map<number, ExchangeTable>();
  for (let i = 0; i < lines.length; i++) {
    const start = TABLE_START.exec(lines[i].trim());
    if (!start) continue;
    let end = i + 1;
    while (end < lines.length && !ANY_TABLE.test(lines[end].trim())) end++;
    const parsed = parseBlock(Number(start[1]), lines.slice(i + 1, end));
    if (parsed) byTable.set(parsed.table, parsed);
    i = end - 1;
  }
  return [...byTable.values()].sort((a, b) => a.table - b.table);
}
