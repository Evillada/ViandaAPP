/**
 * Construye data/catalog/tcac-2018.csv desde el OCR de la TCAC.
 *
 * 1. pnpm tsx scripts/catalog/build-tcac.ts            → escribe data/sources/ocr/recheck.json
 * 2. data/sources/.venv/bin/python scripts/catalog/ocr_tcac.py --cells
 * 3. pnpm tsx scripts/catalog/build-tcac.ts            → aplica las lecturas de celda y las correcciones
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OcrPage } from "../../src/core/catalog/ocr-types";
import { ALL_FIELDS, parseNumber, parseSpread, spreadColumns, type Column } from "../../src/core/catalog/tcac-parse";
import {
  applyCellReads,
  cellId,
  cellRequests,
  mergeReadings,
  resolveByChecksums,
  type MergedRow,
} from "../../src/core/catalog/tcac-merge";
import { resolveCodes, validateCatalog } from "../../src/core/catalog/tcac-validate";
import { applyCorrections, parseCorrections } from "../../src/core/catalog/corrections";

const ROOT = join(__dirname, "..", "..");
const OCR_DIR = join(ROOT, "data", "sources", "ocr");
const CATALOG_DIR = join(ROOT, "data", "catalog");
const CORRECTIONS = join(CATALOG_DIR, "tcac-2018-corrections.csv");

const loadPage = (page: number): OcrPage =>
  JSON.parse(readFileSync(join(OCR_DIR, `page-${String(page).padStart(3, "0")}.json`), "utf8"));
const withGray = (page: OcrPage): OcrPage => ({ ...page, boxes: page.boxesGray ?? [] });
const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

let merged: MergedRow[] = [];
const columnsByPage = new Map<number, { left: Column[]; right: Column[] }>();
for (let page = 43; page <= 107; page += 2) {
  const [left, right] = [loadPage(page), loadPage(page + 1)];
  columnsByPage.set(page, spreadColumns(left, right));
  merged.push(...mergeReadings(parseSpread(left, right), parseSpread(withGray(left), withGray(right))));
}

writeFileSync(join(OCR_DIR, "recheck.json"), JSON.stringify(cellRequests(merged, columnsByPage)));
writeFileSync(join(OCR_DIR, "recheck-all.json"), JSON.stringify(cellRequests(merged, columnsByPage, true)));

const readsPath = join(OCR_DIR, "cell-reads.json");
const reads: Record<string, string> = existsSync(readsPath) ? JSON.parse(readFileSync(readsPath, "utf8")) : {};
merged = applyCellReads(resolveByChecksums(merged, reads), reads);

const corrections = existsSync(CORRECTIONS) ? parseCorrections(readFileSync(CORRECTIONS, "utf8")) : [];
const rows = applyCorrections(resolveCodes(merged) as MergedRow[], corrections);
const validated = validateCatalog(rows);

/** Tercer lector sobre todas las celdas: mide los errores que ninguna suma detecta (p. ej. 5↔6 dentro de tolerancia). */
const allReadsPath = join(OCR_DIR, "cell-reads-all.json");
const allReads: Record<string, string> = existsSync(allReadsPath) ? JSON.parse(readFileSync(allReadsPath, "utf8")) : {};
const third = { compared: 0, agree: 0, unread: 0, disagree: [] as { code: string | null; page: number; y: number; field: string; value: unknown; read: number; corrected: boolean }[] };
for (const row of rows) {
  for (const field of ALL_FIELDS) {
    const read = allReads[cellId(row.page, row.y, field)];
    if (read === undefined) continue;
    const parsed = parseNumber(read);
    const value = row.values[field];
    if (typeof parsed !== "number") {
      if (value !== null) third.unread++;
      continue;
    }
    third.compared++;
    if (parsed === value) third.agree++;
    else third.disagree.push({ code: row.code, page: row.page, y: row.y, field, value, read: parsed, corrected: row.notes.includes(`CORRECTED:${field}`) });
  }
}
writeFileSync(join(OCR_DIR, "third-reader.json"), JSON.stringify(third.disagree, null, 1));

mkdirSync(CATALOG_DIR, { recursive: true });
const header = ["code", "name", "tcac_group", "part", ...ALL_FIELDS, "needs_review", "issues", "source_page"];
const lines = validated.map(({ row, issues }) =>
  [
    row.code,
    row.name,
    row.code?.[0],
    row.part,
    ...ALL_FIELDS.map((f) => (typeof row.values[f] === "number" ? row.values[f] : "")),
    issues.some((i) => i.blocking),
    issues.map((i) => `${i.code}${i.detail ? `(${i.detail})` : ""}`).join(" "),
    row.page,
  ].map(csvCell).join(",")
);
writeFileSync(join(CATALOG_DIR, "tcac-2018.csv"), [header.join(","), ...lines].join("\n") + "\n");

const blocking = validated.filter((v) => v.issues.some((i) => i.blocking));

const fieldX = (columns: Column[], field: string) => columns.find((c) => c.field === field)?.x ?? null;
const reviewItems = (items: typeof validated) =>
  JSON.stringify(
    items.map(({ row, issues }) => {
      const columns = columnsByPage.get(row.page)!;
      return {
        code: row.code,
        name: row.name,
        page: row.page,
        y: row.y,
        issues: issues.filter((i) => i.blocking).map((i) => `${i.code}${i.detail ? ` ${i.detail}` : ""}`),
        values: row.values,
        rightX: { sodium: fieldX(columns.right, "sodium"), saturatedFat: fieldX(columns.right, "saturatedFat"), edibleFraction: fieldX(columns.right, "edibleFraction") },
      };
    }),
    null,
    1
  );
writeFileSync(join(OCR_DIR, "review.json"), reviewItems(blocking));

/** Muestra de control reproducible: compara contra la imagen los campos que ninguna suma verifica. */
const SAMPLE_SEED = 20261105;
const SAMPLE_SIZE = 30;
let state = SAMPLE_SEED;
const random = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pool = [...validated];
const sample = Array.from({ length: SAMPLE_SIZE }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]).sort(
  (a, b) => (a.row.code ?? "").localeCompare(b.row.code ?? "")
);
writeFileSync(join(OCR_DIR, "sample.json"), reviewItems(sample));
const byCode: Record<string, number> = {};
for (const v of validated) for (const i of v.issues) {
  const key = i.blocking ? i.code : `${i.code} (aviso)`;
  byCode[key] = (byCode[key] ?? 0) + 1;
}
const notes: Record<string, number> = {};
for (const r of rows) for (const n of r.notes) notes[n.split(":")[0]] = (notes[n.split(":")[0]] ?? 0) + 1;

const report = [
  "# TCAC 2018 — reporte de extracción",
  "",
  "Generado por `scripts/catalog/build-tcac.ts`. Fuente: TCAC 2018 (ICBF, Universidad Nacional), páginas 43–108, OCR de Vision (macOS) con dos lecturas por página y relectura de celdas.",
  "",
  `- Filas: ${validated.length} (códigos únicos: ${new Set(rows.map((r) => r.code)).size})`,
  `- Sin problemas que bloqueen: ${validated.length - blocking.length} (${(((validated.length - blocking.length) / validated.length) * 100).toFixed(1)} %)`,
  `- Por revisar (\`needs_review\`): ${blocking.length}`,
  `- Correcciones manuales aplicadas: ${corrections.length}`,
  "",
  "## Problemas por tipo",
  "",
  "| Tipo | Filas |",
  "|---|---|",
  ...Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Ajustes automáticos",
  "",
  "| Tipo | Celdas o filas |",
  "|---|---|",
  ...Object.entries(notes).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Calidad medida",
  "",
  "Las sumas sólo detectan errores que las descuadran. Para medir lo que se les escapa:",
  "",
  `- **Muestra de control** (semilla ${SAMPLE_SEED}, ${SAMPLE_SIZE} filas, revisada a mano contra la imagen el 2026-11-05): 5 celdas erradas de ~360. Tres eran sodio o grasa saturada vacíos con una cifra aislada que el OCR no detecta (\"2\", \"0\"); dos eran 6 leídos como 5 dentro de tolerancia (70,6 → 70,5 g; 1064 → 1054 kJ). Las cinco quedaron corregidas y los dos patrones se atacaron en todo el catálogo.`,
  "- **Celdas vacías**: cada celda vacía se relee sola y se mide si tiene tinta. Una celda con tinta que no se pudo leer bloquea la fila hasta revisarla. Por eso un vacío en el CSV es un vacío de la fuente (nutriente no analizado) o una columna que ese grupo no publica (p. ej. grasa saturada en verduras y frutas).",
  `- **Tercer lector** (cada celda recortada y releída sola): ${third.compared} celdas comparables, ${third.agree} coinciden (${((third.agree / Math.max(third.compared, 1)) * 100).toFixed(1)} %). Las diferencias de un solo dígito se revisaron en la imagen ampliada: 39 eran errores de los dos lectores principales (casi todos 6 → 5) y se corrigieron. El resto son fallas del tercer lector (pierde la coma o una cifra). ${third.unread} celdas no tuvieron lectura comparable.`,
  `- **Error residual estimado** (supuesto, no medido): entre las celdas comparables, el tercer lector destapó 39 errores en ${third.compared} (≈0,7 %). Si las ${third.unread} celdas sin lectura comparable tienen la misma tasa, quedan del orden de ${Math.round(third.unread * 0.0073)} celdas con un dígito confundido (5/6, 6/8) que no descuadra ninguna suma. Se concentran en la p. 107, cuya imagen es de baja resolución. Impacto típico: ±0,1 g o ±10 kJ.`,
  "",
  "| Campo | Celdas vacías |",
  "|---|---|",
  ...ALL_FIELDS.map((field) => `| ${field} | ${rows.filter((r) => r.values[field] === null).length} |`),
  "",
  "Los avisos no bloquean: `ENERGY_MISMATCH` refleja que la TCAC calcula energía con factores distintos a 4/9/4 en algunos alimentos, y `PROXIMATE_SUM` aceptado marca filas cuya composición impresa suma más de 100 g con energía coherente (anotadas en el archivo de correcciones).",
  "",
  "## Filas por revisar",
  "",
  "| Ref | Código | Alimento | Problemas |",
  "|---|---|---|---|",
  ...blocking.map(({ row, issues }) =>
    `| p${row.page}@${row.y.toFixed(4)} | ${row.code ?? ""} | ${row.name ?? ""} | ${issues.filter((i) => i.blocking).map((i) => `${i.code}${i.detail ? ` ${i.detail}` : ""}`).join("; ")} |`
  ),
  "",
].join("\n");
writeFileSync(join(CATALOG_DIR, "tcac-2018-report.md"), report);

console.log(`filas ${validated.length} · limpias ${validated.length - blocking.length} · por revisar ${blocking.length}`);
console.log(`tercer lector: ${third.compared} comparadas · ${third.agree} coinciden · ${third.disagree.length} difieren (${third.disagree.filter((d) => d.corrected).length} corregidas a mano) · ${third.unread} sin lectura`);
console.log(byCode);
