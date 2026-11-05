import { ALL_FIELDS, parseNumber, type TcacField } from "./tcac-parse";
import type { MergedRow } from "./tcac-merge";

export interface Correction {
  ref: string;
  /** "accept" registra que el valor viene así de la fuente: el problema (value) queda como aviso. */
  field: TcacField | "code" | "name" | "accept";
  value: string;
  note: string;
}

const POSITION_REF = /^p(\d+)@(\d+(?:\.\d+)?)$/;
const POSITION_TOLERANCE = 0.003;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export function parseCorrections(csv: string): Correction[] {
  const [, ...lines] = parseCsv(csv);
  return lines.map(([ref, field, value = "", note = ""]) => ({ ref, field: field as Correction["field"], value, note }));
}

function matches(row: MergedRow, ref: string): boolean {
  const position = POSITION_REF.exec(ref);
  if (position) return row.page === Number(position[1]) && Math.abs(row.y - Number(position[2])) <= POSITION_TOLERANCE;
  return row.code === ref;
}

/**
 * Aplica las correcciones manuales (versionadas en data/catalog). Las referencias por posición
 * ("p51@0.4500") van primero porque sirven para arreglar códigos repetidos o ilegibles.
 */
export function applyCorrections(rows: MergedRow[], corrections: Correction[]): MergedRow[] {
  const result = rows.map((r) => ({ ...r, values: { ...r.values }, problems: [...r.problems], notes: [...r.notes] }));
  const ordered = [...corrections].sort((a, b) => Number(!POSITION_REF.test(a.ref)) - Number(!POSITION_REF.test(b.ref)));
  for (const correction of ordered) {
    const { ref, field, value } = correction;
    if (field !== "code" && field !== "name" && field !== "accept" && !ALL_FIELDS.includes(field)) {
      throw new Error(`Corrección con campo desconocido "${field}" (${ref})`);
    }
    const targets = result.filter((r) => matches(r, ref));
    if (targets.length !== 1) {
      throw new Error(`La corrección ${ref}/${field} aplica a ${targets.length} filas; debe aplicar a exactamente una`);
    }
    const row = targets[0];
    if (field === "accept") {
      row.notes.push(`ACCEPTED:${value}`);
      continue;
    }
    if (field === "code") {
      row.code = value;
      row.problems = row.problems.filter((p) => !p.startsWith("CODE_"));
    } else if (field === "name") {
      row.name = value;
    } else {
      const parsed = parseNumber(value);
      if (parsed === "INVALID") throw new Error(`Valor inválido "${value}" en la corrección ${ref}/${field}`);
      row.values[field] = parsed;
      row.problems = row.problems.filter((p) => p.split(":")[1] !== field);
    }
    row.notes.push(`CORRECTED:${field}`);
  }
  return result;
}
