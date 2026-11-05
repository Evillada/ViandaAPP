/**
 * Construye data/catalog/gaba-exchanges.csv desde el texto del documento técnico de las GABA 2015
 * (data/sources/gaba_tecnico_2015.txt, no versionado) y verifica que las constantes de
 * src/core/catalog/gaba.ts coincidan con la fuente.
 *
 * Uso: pnpm tsx scripts/catalog/build-gaba.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DAILY_EXCHANGES, DAILY_GROUPS, EXCHANGE_AVERAGES, GABA_SUBGROUPS, type DailyColumn } from "../../src/core/catalog/gaba";
import { parseExchangeTables } from "../../src/core/catalog/gaba-parse";

const ROOT = join(__dirname, "..", "..");
const SOURCE = join(ROOT, "data", "sources", "gaba_tecnico_2015.txt");
const OUTPUT = join(ROOT, "data", "catalog", "gaba-exchanges.csv");

const text = readFileSync(SOURCE, "utf8");
const tables = parseExchangeTables(text);
const errors: string[] = [];

for (const subgroup of GABA_SUBGROUPS) {
  const table = tables.find((t) => t.table === subgroup.table);
  if (!table) {
    errors.push(`tabla ${subgroup.table}: no encontrada`);
    continue;
  }
  if (table.group !== subgroup.sourceGroup || table.subgroup !== subgroup.sourceSubgroup) {
    errors.push(`tabla ${subgroup.table}: es ${table.group}/${table.subgroup}, se esperaba ${subgroup.sourceGroup}/${subgroup.sourceSubgroup}`);
  }
  if (!table.average) {
    errors.push(`tabla ${subgroup.table}: sin aporte promedio`);
    continue;
  }
  const expected = EXCHANGE_AVERAGES[subgroup.key];
  for (const field of Object.keys(expected) as (keyof typeof expected)[]) {
    if (table.average[field] !== expected[field]) {
      errors.push(`tabla ${subgroup.table} ${field}: fuente ${table.average[field]}, gaba.ts ${expected[field]}`);
    }
  }
}

// Tabla 56: las seis filas de grupo terminan en las ocho cifras de las columnas de edad y sexo.
const COLUMNS: DailyColumn[] = ["2-5", "6-9", "10-13", "14-17:M", "14-17:F", "18-59:M", "18-59:F", "60+"];
const table56 = text.slice(text.lastIndexOf("Tabla 56. Resumen"));
const dailyRows = table56
  .split(/\r?\n/)
  .map((line) => line.trim().match(/(\d+,\d)(?:\s+(\d+,\d)){7}$/)?.[0])
  .filter((match): match is string => Boolean(match))
  .slice(0, DAILY_GROUPS.length)
  .map((match) => match.split(/\s+/).map((v) => Number(v.replace(",", "."))));
if (dailyRows.length !== DAILY_GROUPS.length) errors.push(`tabla 56: ${dailyRows.length} filas leídas`);
dailyRows.forEach((values, row) =>
  values.forEach((value, col) => {
    const expected = DAILY_EXCHANGES[COLUMNS[col]][DAILY_GROUPS[row]];
    if (value !== expected) errors.push(`tabla 56 ${DAILY_GROUPS[row]} ${COLUMNS[col]}: fuente ${value}, gaba.ts ${expected}`);
  })
);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const lines = GABA_SUBGROUPS.flatMap((subgroup) => {
  const table = tables.find((t) => t.table === subgroup.table)!;
  return table.foods.map((food) =>
    [subgroup.table, subgroup.group, subgroup.key, table.subgroupName, food.name, food.grams, food.measure].map(csvCell).join(",")
  );
});
mkdirSync(join(ROOT, "data", "catalog"), { recursive: true });
writeFileSync(OUTPUT, ["table,gaba_group,gaba_subgroup,subgroup_name,food,grams,measure", ...lines].join("\n") + "\n");
console.log(`${tables.length} tablas · ${lines.length} alimentos de intercambio · aporte y tabla 56 coinciden con gaba.ts`);
