/**
 * Propone las coincidencias entre la lista de intercambios GABA y la TCAC (data/catalog/gaba-matches.csv,
 * se confirman a mano en la columna confirmed y las confirmaciones se conservan al regenerar) y escribe
 * la hoja de alérgenos para la nutricionista (data/catalog/allergen-review.csv).
 *
 * Uso: pnpm tsx scripts/catalog/build-enrich.ts [--summary]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../../src/core/catalog/corrections";
import { allergensFor, confirmedMatches, exchangeFor, gabaSubgroupFor, highInFor, isProcessed, needsReview, type CatalogFood } from "../../src/core/catalog/enrich";
import { normalizeSearch } from "../../src/core/catalog/names";
import { ALL_FIELDS } from "../../src/core/catalog/tcac-parse";

const ROOT = join(__dirname, "..", "..");
const CATALOG = join(ROOT, "data", "catalog");
const MATCHES = join(CATALOG, "gaba-matches.csv");

function readTable(path: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8"));
  return rows.filter((row) => row.length === header.length).map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvLine = (cells: (string | number)[]) => cells.map(csvCell).join(",");

const foods: CatalogFood[] = readTable(join(CATALOG, "tcac-2018.csv")).map((row) => ({
  code: row.code,
  name: row.name,
  part: row.part || null,
  values: Object.fromEntries(ALL_FIELDS.map((field) => [field, row[field] === "" ? null : Number(row[field])])),
}));
const exchanges = readTable(join(CATALOG, "gaba-exchanges.csv"));

const STOPWORDS = new Set(["de", "del", "con", "sin", "la", "el", "los", "las", "en", "y", "o", "a", "al", "tipo", "por"]);
const stem = (word: string) => word.replace(/(es|s)$/, "").replace(/[ao]$/, "");
const tokens = (text: string) => normalizeSearch(text).split(/[^a-zñ]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w)).map(stem);
const state = (text: string) => {
  const t = normalizeSearch(text);
  if (/cocid|hervid|sudad|guisad/.test(t)) return "cocido";
  if (/frit/.test(t)) return "frito";
  if (/asad|horne|tostad/.test(t)) return "asado";
  return "crudo";
};

interface Proposal {
  code: string;
  name: string;
  score: number;
}

function propose(gabaFood: string): Proposal[] {
  const gabaTokens = tokens(gabaFood);
  const gabaState = state(gabaFood);
  return foods
    .map((food) => {
      const foodTokens = tokens(food.name);
      if (!foodTokens.includes(gabaTokens[0]) || state(food.name) !== gabaState) return null;
      const shared = gabaTokens.filter((t) => foodTokens.includes(t)).length;
      const score = shared / Math.max(gabaTokens.length, foodTokens.length - 1);
      return { code: food.code, name: food.name, score: Math.round(score * 100) / 100 };
    })
    .filter((p): p is Proposal => p !== null)
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length)
    .slice(0, 3);
}

const previous = existsSync(MATCHES) ? readTable(MATCHES) : [];
const confirmedKey = (food: string, code: string) => `${food}|${code}`;
const confirmed = new Map(previous.map((row) => [confirmedKey(row.gaba_food, row.tcac_code), row.confirmed]));

const foodsByCode = new Map(foods.map((food) => [food.code, food]));
const matchLines = exchanges.flatMap((exchange) => {
  const proposals = propose(exchange.food);
  const proposed = new Set(proposals.map((p) => p.code));
  const manual = previous
    .filter((row) => row.gaba_food === exchange.food && row.confirmed === "1" && !proposed.has(row.tcac_code) && foodsByCode.has(row.tcac_code))
    .map((row) => ({ code: row.tcac_code, name: foodsByCode.get(row.tcac_code)!.name, score: "manual" }));
  const rows = [...manual, ...proposals];
  const base = [exchange.table, exchange.gaba_subgroup, exchange.food, exchange.grams, exchange.measure];
  if (rows.length === 0) return [csvLine([...base, "", "", "", ""])];
  return rows.map((p) => csvLine([...base, p.code, p.name, p.score, confirmed.get(confirmedKey(exchange.food, p.code)) ?? ""]));
});
writeFileSync(MATCHES, ["table,gaba_subgroup,gaba_food,grams,measure,tcac_code,tcac_name,score,confirmed", ...matchLines].join("\n") + "\n");

const reviewLines = foods
  .filter(needsReview)
  .map((food) => csvLine([food.code, food.name, allergensFor(food).join(" "), ""]));
writeFileSync(join(CATALOG, "allergen-review.csv"), ["code,name,proposed_allergens,confirmed_allergens", ...reviewLines].join("\n") + "\n");

const withoutProposal = matchLines.filter((line) => line.endsWith(",,,,")).length;
const matches = confirmedMatches(readFileSync(MATCHES, "utf8"));
const portions = foods.map((food) => exchangeFor(food, matches));
console.log(
  [
    `${exchanges.length} alimentos GABA · ${withoutProposal} sin propuesta · ${matches.size} coincidencias confirmadas`,
    `${foods.filter((food) => gabaSubgroupFor(food, matches)).length}/${foods.length} alimentos TCAC con subgrupo GABA · ` +
      `${portions.filter((p) => p && !p.estimated).length} con porción de la lista · ${portions.filter((p) => p?.estimated).length} con porción estimada`,
    `${reviewLines.length} alimentos TCAC en la hoja de alérgenos`,
  ].join("\n")
);

if (process.argv.includes("--summary")) {
  foods.forEach((food, i) => {
    const flags = [isProcessed(food) ? "PROC" : "", ...highInFor(food)].filter(Boolean).join(" ");
    const portion = portions[i] ? `${portions[i]!.grams} g${portions[i]!.estimated ? " est" : ""}` : "-";
    console.log([food.code, gabaSubgroupFor(food, matches) ?? "-", allergensFor(food).join(" ") || "-", flags || "-", portion, food.name].join("\t"));
  });
}
