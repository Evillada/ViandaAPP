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

export function cellRequests(rows: MergedRow[], columnsByPage: Map<number, { left: Column[]; right: Column[] }>): CellRequest[] {
  const requests: CellRequest[] = [];
  for (const row of rows) {
    const columns = columnsByPage.get(row.page);
    if (!columns) continue;
    for (const field of ALL_FIELDS) {
      if (row.values[field] !== null && row.values[field] !== "INVALID") continue;
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

/** La lectura de celda completa vacíos y desempata; nunca reemplaza un valor en el que coincidieron los dos lectores. */
export function applyCellReads(rows: MergedRow[], reads: Record<string, string>): MergedRow[] {
  return rows.map((row) => {
    const values = { ...row.values };
    const notes = [...row.notes];
    for (const field of ALL_FIELDS) {
      const read = reads[cellId(row.page, row.y, field)];
      if (read === undefined) continue;
      const value = parseNumber(read);
      if (typeof value !== "number") continue;
      const current = values[field];
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
