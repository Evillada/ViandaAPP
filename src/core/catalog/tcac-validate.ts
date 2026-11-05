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
    const [code, detail] = problem.split(/:(.*)/s);
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

  const sumCheckable = [moisture, protein, fat, carbsTotal, ash].every((x) => x !== null);
  if (sumCheckable) {
    const sum = moisture! + protein! + fat! + carbsTotal! + ash!;
    if (Math.abs(sum - 100) > PROXIMATE_SUM_TOLERANCE) {
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

/** Cuando izquierda y derecha leen códigos distintos, gana el único que respeta el orden con sus vecinos. */
export function resolveCodes(rows: TcacRow[]): TcacRow[] {
  const isMismatch = (r: TcacRow) => r.problems.some((p) => p.startsWith("CODE_MISMATCH"));
  return rows.map((row, i) => {
    if (!isMismatch(row) || !row.leftCode || !row.rightCode) return row;
    const previous = rows.slice(0, i).reverse().find((r) => !isMismatch(r) && r.code)?.code ?? "";
    const next = rows.slice(i + 1).find((r) => !isMismatch(r) && r.code)?.code ?? "\uffff";
    const fits = [row.leftCode, row.rightCode].filter((c) => c > previous && c < next);
    if (fits.length !== 1) return row;
    return {
      ...row,
      code: fits[0],
      problems: row.problems.filter((p) => !p.startsWith("CODE_MISMATCH")),
      notes: [...(row.notes ?? []), `CODE_RESOLVED:${fits[0]}`],
    };
  });
}

export function validateCatalog(rows: TcacRow[]): ValidatedRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.code) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
  let previous = "";
  return rows.map((row) => {
    const issues = validateRow(row);
    if (row.code && (counts.get(row.code) ?? 0) > 1) issues.push({ code: "DUPLICATE_CODE", blocking: true });
    if (row.code && row.code <= previous && counts.get(row.code) === 1) issues.push({ code: "CODE_ORDER", blocking: true, detail: `después de ${previous}` });
    if (row.code && row.code > previous) previous = row.code;
    return { row, issues };
  });
}
