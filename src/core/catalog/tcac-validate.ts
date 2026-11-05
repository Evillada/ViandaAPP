import type { CellValue, SpreadRow } from "./tcac-parse";

export type IssueCode =
  | "INVALID_CELL"
  | "CONFLICT"
  | "UNASSIGNED"
  | "CODE_MISMATCH"
  | "MISSING_CORE"
  | "PROXIMATE_SUM"
  | "KJ_MISMATCH"
  | "ENERGY_MISMATCH"
  | "OUT_OF_RANGE"
  | "DUPLICATE_CODE"
  | "CODE_ORDER";

export interface Issue {
  code: IssueCode;
  blocking: boolean;
  detail?: string;
}

export type TcacRow = SpreadRow & { notes?: string[] };

export interface ValidatedRow {
  row: TcacRow;
  issues: Issue[];
}

/** Tolerancias medidas sobre la TCAC completa (2026-11-05), no supuestas. */
const PROXIMATE_SUM_TOLERANCE = 1;
const KJ_RELATIVE_TOLERANCE = 0.03;
const KJ_ABSOLUTE_TOLERANCE = 4;
const ENERGY_RELATIVE_TOLERANCE = 0.1;
const ENERGY_ABSOLUTE_TOLERANCE = 10;
const MAX_SODIUM_MG = 40000;

const num = (value: CellValue): number | null => (typeof value === "number" ? value : null);

function ocrIssues(row: TcacRow): Issue[] {
  return row.problems.map((problem) => {
    const separator = problem.indexOf(":");
    const code = separator < 0 ? problem : problem.slice(0, separator);
    const detail = separator < 0 ? undefined : problem.slice(separator + 1);
    return { code: code as IssueCode, blocking: true, detail };
  });
}

export function validateRow(row: TcacRow): Issue[] {
  const issues = ocrIssues(row);
  const v = row.values;
  const [moisture, kcal, kj, protein, fat, carbsTotal, carbsAvailable, fiber, ash] = [
    v.moisture, v.energyKcal, v.energyKj, v.protein, v.fat, v.carbsTotal, v.carbsAvailable, v.fiber, v.ash,
  ].map(num);

  const missing = (["energyKcal", "protein", "fat", "carbsTotal"] as const).filter((f) => v[f] === null);
  if (missing.length) issues.push({ code: "MISSING_CORE", blocking: true, detail: missing.join(",") });

  // El etanol no tiene columna: la composición de una bebida suma 100 g menos su % de alcohol.
  const alcohol = Number(/(\d+(?:[.,]\d+)?)\s*% de alcohol/i.exec(row.name ?? "")?.[1].replace(",", ".") ?? 0);
  const sumCheckable = [moisture, protein, fat, carbsTotal, ash].every((x) => x !== null);
  if (sumCheckable) {
    const sum = moisture! + protein! + fat! + carbsTotal! + ash!;
    if (Math.abs(sum + alcohol - 100) > PROXIMATE_SUM_TOLERANCE) {
      issues.push({ code: "PROXIMATE_SUM", blocking: true, detail: sum.toFixed(1) });
    }
  }

  if (kcal !== null && kj !== null) {
    const expected = kcal * 4.184;
    if (Math.abs(kj - expected) > Math.max(KJ_ABSOLUTE_TOLERANCE, expected * KJ_RELATIVE_TOLERANCE)) {
      issues.push({ code: "KJ_MISMATCH", blocking: true, detail: `${kj} vs ${expected.toFixed(0)}` });
    }
  }

  // El etanol aporta 7 kcal/g y la tabla no lo declara como macronutriente.
  const isAlcoholic = /alcohol/i.test(row.name ?? "");
  if (!isAlcoholic && kcal !== null && protein !== null && fat !== null && carbsTotal !== null) {
    const estimates = [4 * protein + 9 * fat + 4 * carbsTotal];
    if (carbsAvailable !== null) estimates.push(4 * protein + 9 * fat + 4 * carbsAvailable + 2 * (fiber ?? 0));
    const deviation = Math.min(...estimates.map((e) => Math.abs(kcal - e)));
    if (deviation > ENERGY_ABSOLUTE_TOLERANCE && deviation > kcal * ENERGY_RELATIVE_TOLERANCE) {
      issues.push({ code: "ENERGY_MISMATCH", blocking: !sumCheckable, detail: `${kcal} vs ${estimates[0].toFixed(0)}` });
    }
  }

  const sodium = num(v.sodium);
  const saturated = num(v.saturatedFat);
  const edible = num(v.edibleFraction);
  if (sodium !== null && sodium > MAX_SODIUM_MG) issues.push({ code: "OUT_OF_RANGE", blocking: true, detail: "sodium" });
  if (saturated !== null && fat !== null && saturated > fat) issues.push({ code: "OUT_OF_RANGE", blocking: true, detail: "saturatedFat" });
  if (edible !== null && (edible < 1 || edible > 100)) issues.push({ code: "OUT_OF_RANGE", blocking: true, detail: "edibleFraction" });

  return issues;
}

/** Dígitos que esta tipografía confunde en el OCR. */
const DIGIT_CONFUSIONS: Record<string, string[]> = { "5": ["6"], "6": ["5"], "0": ["8"], "8": ["0", "3"], "3": ["8"], "1": ["7"], "7": ["1"] };

function confusedVariants(code: string): string[] {
  const variants: string[] = [];
  for (let i = 1; i < code.length; i++) {
    for (const swap of DIGIT_CONFUSIONS[code[i]] ?? []) variants.push(code.slice(0, i) + swap + code.slice(i + 1));
  }
  return variants;
}

/**
 * Los códigos de la tabla son estrictamente crecientes. Se recorre en orden: si izquierda y derecha
 * difieren gana el único que encaja entre el anterior y el siguiente; si el código no supera al
 * anterior, se prueba la menor variante por dígitos confundibles que restablezca el orden.
 */
export function resolveCodes(rows: TcacRow[]): TcacRow[] {
  const result: TcacRow[] = [];
  let previous = "";
  rows.forEach((row, i) => {
    const candidates = [...new Set([row.leftCode, row.rightCode, row.code].filter((c): c is string => Boolean(c)))];
    const nextCandidates = [rows[i + 1]?.leftCode, rows[i + 1]?.rightCode].filter((c): c is string => Boolean(c));
    const next = nextCandidates.length ? nextCandidates.reduce((a, b) => (a > b ? a : b)) : "\uffff";
    const notes = [...(row.notes ?? [])];

    let fits = candidates.filter((c) => c > previous);
    if (fits.length > 1) fits = fits.filter((c) => c < next);
    let chosen: string | undefined = fits.length === 1 ? fits[0] : undefined;

    if (!chosen && !candidates.some((c) => c > previous)) {
      const repaired = candidates.flatMap(confusedVariants).filter((c) => c > previous).sort()[0];
      if (repaired) {
        chosen = repaired;
        notes.push(`CODE_REPAIRED:${row.code}>${repaired}`);
      }
    }

    if (!chosen) {
      result.push(row);
      if (row.code && row.code > previous) previous = row.code;
      return;
    }
    const hadMismatch = row.problems.some((p) => p.startsWith("CODE_MISMATCH"));
    if (hadMismatch) notes.push(`CODE_RESOLVED:${chosen}`);
    result.push({ ...row, code: chosen, problems: row.problems.filter((p) => !p.startsWith("CODE_MISMATCH")), notes });
    previous = chosen;
  });
  return result;
}

export function validateCatalog(rows: TcacRow[]): ValidatedRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.code) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
  let previous = "";
  return rows.map((row) => {
    const accepted = new Set((row.notes ?? []).filter((n) => n.startsWith("ACCEPTED:")).map((n) => n.slice(9)));
    const issues = validateRow(row).map((i) => (accepted.has(i.code) ? { ...i, blocking: false } : i));
    if (row.code && (counts.get(row.code) ?? 0) > 1) issues.push({ code: "DUPLICATE_CODE", blocking: true });
    if (row.code && row.code <= previous && counts.get(row.code) === 1) issues.push({ code: "CODE_ORDER", blocking: true, detail: `después de ${previous}` });
    if (row.code && row.code > previous) previous = row.code;
    return { row, issues };
  });
}
