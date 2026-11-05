import { ALL_FIELDS, parseNumber, type CellValue, type Column, type SpreadRow, type TcacField } from "./tcac-parse";

export interface MergedRow extends SpreadRow {
  /** Valores distintos que leyeron los dos lectores de página, para desempatar con la lectura de celda. */
  candidates: Partial<Record<TcacField, number[]>>;
  notes: string[];
}

export interface CellRequest {
  id: string;
  page: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const ROW_MATCH = 0.006;
const CELL_HALF_HEIGHT = 0.0095;
const RIGHT_FIELDS: TcacField[] = ["sodium", "saturatedFat", "edibleFraction"];

export const cellId = (page: number, y: number, field: TcacField) => `${page}:${y.toFixed(4)}:${field}`;

function fieldProblems(values: Record<TcacField, CellValue>, candidates: MergedRow["candidates"]): string[] {
  return ALL_FIELDS.filter((f) => values[f] === "INVALID").map((f) => (candidates[f] ? `DISAGREE:${f}` : `INVALID_CELL:${f}`));
}

/**
 * Combina la lectura de la página original con la lectura en gris. Las cajas sin columna se descartan:
 * si eran datos de una columna que importa, esa celda queda vacía y se relee sola después.
 */
export function mergeReadings(primary: SpreadRow[], secondary: SpreadRow[]): MergedRow[] {
  return primary.map((a) => {
    const b = secondary.find((s) => s.page === a.page && Math.abs(s.y - a.y) < ROW_MATCH);
    const values = { ...a.values };
    const candidates: MergedRow["candidates"] = {};
    for (const field of ALL_FIELDS) {
      const [x, y] = [a.values[field], b?.values[field] ?? null];
      if (typeof x === "number" && typeof y === "number") {
        if (x === y) values[field] = x;
        else {
          values[field] = "INVALID";
          candidates[field] = [x, y];
        }
      } else if (typeof x === "number") values[field] = x;
      else if (typeof y === "number") values[field] = y;
      else values[field] = x === "INVALID" || y === "INVALID" ? "INVALID" : null;
    }
    const leftCode = a.leftCode ?? b?.leftCode ?? null;
    const rightCode = a.rightCode ?? b?.rightCode ?? null;
    const codeProblems =
      leftCode && rightCode && leftCode !== rightCode ? [`CODE_MISMATCH:${leftCode}/${rightCode}`] : [];
    return {
      ...a,
      leftCode,
      rightCode,
      code: rightCode ?? leftCode,
      name: a.name ?? b?.name ?? null,
      part: a.part ?? b?.part ?? null,
      values,
      candidates,
      problems: [...codeProblems, ...fieldProblems(values, candidates)],
      notes: [],
    };
  });
}

function bounds(columns: Column[], field: TcacField): [number, number] | null {
  const sorted = [...columns].sort((a, b) => a.x - b.x);
  const index = sorted.findIndex((c) => c.field === field);
  if (index < 0) return null;
  const x = sorted[index].x;
  const gaps = [sorted[index - 1], sorted[index + 1]].filter(Boolean).map((c) => Math.abs(c.x - x));
  const half = ((gaps.length ? Math.min(...gaps) : 0.04) / 2) * 0.95;
  return [x - half, x + half];
}

export function cellRequests(
  rows: MergedRow[],
  columnsByPage: Map<number, { left: Column[]; right: Column[] }>,
  everyCell = false
): CellRequest[] {
  const requests: CellRequest[] = [];
  for (const row of rows) {
    const columns = columnsByPage.get(row.page);
    if (!columns) continue;
    for (const field of ALL_FIELDS) {
      if (!everyCell && row.values[field] !== null && row.values[field] !== "INVALID") continue;
      const isRight = RIGHT_FIELDS.includes(field);
      const range = bounds(isRight ? columns.right : columns.left, field);
      if (!range) continue;
      requests.push({
        id: cellId(row.page, row.y, field),
        page: isRight ? row.page + 1 : row.page,
        x0: range[0],
        x1: range[1],
        y0: row.y - CELL_HALF_HEIGHT,
        y1: row.y + CELL_HALF_HEIGHT,
      });
    }
  }
  return requests;
}

/** Con los carbohidratos calculados por diferencia, el redondeo de 5 valores a un decimal no supera 0,25 g. */
const SUM_TOLERANCE = 0.25;
const CARBS_TOLERANCE = 0.15;
const KJ_TOLERANCE = 0.03;
const MAX_COMBINATIONS = 256;

type Values = Record<TcacField, CellValue>;

interface Check {
  fields: TcacField[];
  passes: (v: Record<TcacField, number>) => boolean;
}

const CHECKS: Check[] = [
  {
    fields: ["moisture", "protein", "fat", "carbsTotal", "ash"],
    passes: (v) => Math.abs(v.moisture + v.protein + v.fat + v.carbsTotal + v.ash - 100) <= SUM_TOLERANCE,
  },
  {
    fields: ["carbsTotal", "carbsAvailable", "fiber"],
    passes: (v) => Math.abs(v.carbsTotal - v.carbsAvailable - v.fiber) <= CARBS_TOLERANCE,
  },
  {
    fields: ["energyKcal", "energyKj"],
    passes: (v) => Math.abs(v.energyKj - v.energyKcal * 4.184) <= v.energyKcal * 4.184 * KJ_TOLERANCE,
  },
];

function combinations(options: [TcacField, number[]][]): Partial<Record<TcacField, number>>[] {
  return options.reduce<Partial<Record<TcacField, number>>[]>(
    (acc, [field, values]) => acc.flatMap((combo) => values.map((value) => ({ ...combo, [field]: value }))),
    [{}]
  );
}

/**
 * Resuelve desacuerdos entre lectores (típicamente 5/6) probando todas las combinaciones contra las
 * sumas de control de la fila. Un campo se fija sólo si participa en una comprobación calculable y
 * todas las combinaciones que la cumplen coinciden en su valor.
 */
export function resolveByChecksums(rows: MergedRow[], reads: Record<string, string>): MergedRow[] {
  return rows.map((row) => {
    const disputed = (Object.keys(row.candidates) as TcacField[]).filter((f) => row.values[f] === "INVALID");
    if (!disputed.length) return row;
    const options: [TcacField, number[]][] = disputed.map((field) => {
      const read = parseNumber(reads[cellId(row.page, row.y, field)] ?? "");
      const values = new Set(row.candidates[field]);
      if (typeof read === "number") values.add(read);
      return [field, [...values]];
    });
    const combos = combinations(options);
    if (combos.length > MAX_COMBINATIONS) return row;

    const relevant = CHECKS.filter(
      (check) =>
        check.fields.some((f) => disputed.includes(f)) &&
        check.fields.every((f) => disputed.includes(f) || typeof row.values[f] === "number")
    );
    if (!relevant.length) return row;

    const feasible = combos.filter((combo) => {
      const values = { ...row.values, ...combo } as Record<TcacField, number>;
      return relevant.every((check) => check.passes(values));
    });
    if (!feasible.length) return row;

    const values: Values = { ...row.values };
    const notes = [...row.notes];
    for (const field of disputed) {
      if (!relevant.some((check) => check.fields.includes(field))) continue;
      const decided = new Set(feasible.map((combo) => combo[field]));
      if (decided.size === 1) {
        values[field] = [...decided][0]!;
        notes.push(`CHECKSUM:${field}`);
      }
    }
    const codeProblems = row.problems.filter((p) => p.startsWith("CODE_"));
    return { ...row, values, notes, problems: [...codeProblems, ...fieldProblems(values, row.candidates)] };
  });
}

/** La lectura de celda completa vacíos y desempata; nunca reemplaza un valor en el que coincidieron los dos lectores. */
/** Marca que escribe `ocr_tcac.py --cells` cuando la celda tiene tinta pero Vision no devolvió texto. */
export const INK_UNREAD = "<tinta>";

export function applyCellReads(rows: MergedRow[], reads: Record<string, string>): MergedRow[] {
  return rows.map((row) => {
    const values = { ...row.values };
    const notes = [...row.notes];
    for (const field of ALL_FIELDS) {
      const read = reads[cellId(row.page, row.y, field)];
      if (read === undefined) continue;
      const value = parseNumber(read);
      const current = values[field];
      if (typeof value !== "number") {
        if (current === null && read.trim()) values[field] = "INVALID";
        continue;
      }
      const options = row.candidates[field];
      if (current === null || (current === "INVALID" && (!options || options.includes(value)))) {
        values[field] = value;
        notes.push(`CELL_READ:${field}`);
      }
    }
    const codeProblems = row.problems.filter((p) => p.startsWith("CODE_"));
    return { ...row, values, notes, problems: [...codeProblems, ...fieldProblems(values, row.candidates)] };
  });
}
