import type { HeaderBox, OcrBox, OcrPage } from "./ocr-types";

export type ProximalField =
  | "moisture"
  | "energyKcal"
  | "energyKj"
  | "protein"
  | "fat"
  | "carbsTotal"
  | "carbsAvailable"
  | "fiber"
  | "ash";
export type RightField = "sodium" | "saturatedFat" | "edibleFraction";
export type TcacField = ProximalField | RightField;
export type CellValue = number | null | "INVALID";

export interface Column {
  x: number;
  label: string;
  field?: TcacField;
}

export interface SpreadRow {
  page: number;
  y: number;
  code: string | null;
  leftCode: string | null;
  rightCode: string | null;
  name: string | null;
  part: string | null;
  values: Record<TcacField, CellValue>;
  problems: string[];
}

/** Centros medidos en las páginas 45 y 81; la página proximal tiene la misma disposición en toda la tabla. */
export const PROXIMAL_COLUMNS: Column[] = [
  { x: 0.586, label: "Humedad", field: "moisture" },
  { x: 0.63, label: "Energía kcal", field: "energyKcal" },
  { x: 0.668, label: "Energía kJ", field: "energyKj" },
  { x: 0.71, label: "Proteína", field: "protein" },
  { x: 0.752, label: "Lípidos", field: "fat" },
  { x: 0.792, label: "Carbohidratos totales", field: "carbsTotal" },
  { x: 0.833, label: "Carbohidratos disponibles", field: "carbsAvailable" },
  { x: 0.873, label: "Fibra", field: "fiber" },
  { x: 0.916, label: "Cenizas", field: "ash" },
];

export const ALL_FIELDS: TcacField[] = [
  ...PROXIMAL_COLUMNS.map((c) => c.field as ProximalField),
  "sodium",
  "saturatedFat",
  "edibleFraction",
];

const GROUP_LETTERS = "ABCDEFGHJKLNPRST";
const CODE_DIGIT_FIXES: Record<string, string> = { O: "0", o: "0", "О": "0", Q: "0", D: "0", B: "8", T: "1", I: "1", l: "1", S: "5" };
const NUMBER_PATTERN = /^\d+([.,]\d+)?$/;
const LEFT_CODE_MAX_X = 0.11;
const NAME_MAX_X = 0.45;
const PART_MAX_X = 0.56;
const RIGHT_CODE_MIN_X = 0.89;
const CODE_MERGE = 0.006;
const NAME_ANCHOR_GAP = 0.012;
const NAME_MERGE = 0.016;
const ROW_TOLERANCE = 0.0105;

const center = (b: { x: number; w: number }) => b.x + b.w / 2;
const middle = (b: OcrBox) => b.y + b.h / 2;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Códigos TCAC: letra de grupo + 3 dígitos. En la columna de código el OCR confunde 0/O y 8/B
 * ("COB1" = C081, "8092" = B092); el resultado se contrasta luego con la otra página y con el orden.
 */
export function parseCode(raw: string): string | null {
  const text = raw.trim();
  if (text.length !== 4) return null;
  const letter = text[0] === "8" ? "B" : text[0] === "5" ? "S" : text[0].toUpperCase();
  const digits = [...text.slice(1)].map((c) => CODE_DIGIT_FIXES[c] ?? c).join("");
  const code = `${letter}${digits}`;
  return GROUP_LETTERS.includes(letter) && /^\d{3}$/.test(digits) ? code : null;
}

/** La "O" es indistinguible del cero en estas tablas; cualquier otro carácter se rechaza y va a revisión. */
export function parseNumber(raw: string): CellValue {
  const text = raw.trim().replace(/[OoО]/g, "0");
  if (text === "") return null;
  if (!NUMBER_PATTERN.test(text)) return "INVALID";
  return Number(text.replace(",", "."));
}

function fieldFor(label: string): TcacField | undefined {
  const text = normalize(label).replace(/\s+/g, "");
  if (text.includes("humedad")) return "moisture";
  if (text.includes("kcal")) return "energyKcal";
  if (/k\.?j/.test(text)) return "energyKj";
  if (text.includes("prote")) return "protein";
  if (text.includes("lipido")) return "fat";
  if (text.includes("totales")) return "carbsTotal";
  if (text.includes("disponibles")) return "carbsAvailable";
  if (text.includes("fibra")) return "fiber";
  if (text.includes("cenizas")) return "ash";
  if (text.includes("odio")) return "sodium";
  if (text.includes("saturada") && !/mono|poli|insat/.test(text)) return "saturatedFat";
  if (text.includes("comestible")) return "edibleFraction";
  return undefined;
}

const isTitle = (text: string) => text === text.toUpperCase() && /[A-Z]{4}/.test(text);
const hasUnit = (text: string) => /\(.*\)/.test(text);

/** Si el OCR no leyó el encabezado de una columna, se intercalan columnas sin nombre en el hueco. */
function fillGaps(columns: Column[]): Column[] {
  if (columns.length < 3) return columns;
  const gaps = columns.slice(1).map((c, i) => c.x - columns[i].x).sort((a, b) => a - b);
  const typical = gaps[Math.floor(gaps.length / 2)];
  const result: Column[] = [columns[0]];
  for (const column of columns.slice(1)) {
    const previous = result[result.length - 1];
    const missing = Math.round((column.x - previous.x) / typical) - 1;
    for (let i = 1; i <= missing; i++) {
      result.push({ x: previous.x + ((column.x - previous.x) * i) / (missing + 1), label: "?" });
    }
    result.push(column);
  }
  return result;
}

/**
 * El encabezado vertical rotado trae una caja por columna. Las columnas de datos son las que llevan
 * unidad; un encabezado de dos líneas ("Carbohidratos" / "Totales (g)") se centra entre ambas.
 */
export function calibrateColumns(headerBoxes: HeaderBox[], minX = 0): Column[] {
  const boxes = headerBoxes.filter((b) => center(b) >= minX && !isTitle(b.text.trim()));
  const columns: Column[] = [];
  for (const b of boxes) {
    const text = b.text.trim();
    const isCode = normalize(text).includes("digo");
    if (!isCode && !hasUnit(text)) continue;
    const fragment = boxes.find(
      (f) => !hasUnit(f.text) && center(f) < center(b) && center(b) - center(f) <= 0.025 && !normalize(f.text).includes("digo")
    );
    const x = fragment ? (center(fragment) + center(b)) / 2 : center(b);
    columns.push({ x, label: isCode ? "Código" : fragment ? `${fragment.text.trim()} ${text}` : text, field: isCode ? undefined : fieldFor(text) });
  }
  return fillGaps(columns.sort((a, b) => a.x - b.x));
}

export const calibrateRightColumns = (headerBoxes: HeaderBox[]) => calibrateColumns(headerBoxes);

function columnFor(x: number, columns: Column[]): Column | null {
  let best: Column | null = null;
  let bestDistance = Infinity;
  for (const column of columns) {
    const distance = Math.abs(column.x - x);
    if (distance < bestDistance) {
      best = column;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  const neighbors = columns.filter((c) => c !== best).map((c) => Math.abs(c.x - best.x));
  const limit = neighbors.length ? Math.min(...neighbors) / 2 : 0.02;
  return bestDistance <= limit ? best : null;
}

function clusterYs(values: number[], gap: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const value of sorted) {
    const last = clusters.at(-1);
    if (last && value - last[last.length - 1] <= gap) last.push(value);
    else clusters.push([value]);
  }
  return clusters.map((c) => c.reduce((s, v) => s + v, 0) / c.length);
}

interface Placed {
  column: Column;
  value: CellValue;
}

/** Una caja con varias cifras separadas por espacio se reparte sólo si cubre exactamente ese número de columnas. */
function splitBox(b: OcrBox, columns: Column[]): Placed[] | null {
  const tokens = b.text.trim().split(/\s+/);
  if (tokens.length === 1) {
    const column = columnFor(center(b), columns);
    return column ? [{ column, value: parseNumber(tokens[0]) }] : null;
  }
  const covered = columns.filter((c) => c.x >= b.x - 0.004 && c.x <= b.x + b.w + 0.004);
  if (covered.length !== tokens.length) return null;
  return covered.map((column, i) => ({ column, value: parseNumber(tokens[i]) }));
}

/** Une cifras que el OCR partió en dos cajas pegadas ("2," + ",4"). */
export function mergeFragments(boxes: OcrBox[]): OcrBox[] {
  const sorted = [...boxes].sort((a, b) => a.x - b.x);
  const merged: OcrBox[] = [];
  for (const b of sorted) {
    const last = merged.at(-1);
    const gap = last ? b.x - (last.x + last.w) : Infinity;
    if (last && gap < 0.012 && (/[.,]$/.test(last.text.trim()) || /^[.,]/.test(b.text.trim()))) {
      const text = `${last.text.trim()}${b.text.trim()}`.replace(/([.,])[.,]/, "$1");
      merged[merged.length - 1] = { ...last, text, w: b.x + b.w - last.x, conf: Math.min(last.conf, b.conf) };
    } else {
      merged.push(b);
    }
  }
  return merged;
}

function emptyValues(): Record<TcacField, CellValue> {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f, null])) as Record<TcacField, CellValue>;
}

export function spreadColumns(left: OcrPage, right: OcrPage): { left: Column[]; right: Column[] } {
  return {
    left: left.headerBoxes?.length ? calibrateColumns(left.headerBoxes, PART_MAX_X) : PROXIMAL_COLUMNS,
    right: calibrateColumns(right.headerBoxes ?? []).filter((c) => c.label !== "Código"),
  };
}

/** Interpreta un par de páginas enfrentadas: cada fila está a la misma altura en ambas. */
export function parseSpread(left: OcrPage, right: OcrPage): SpreadRow[] {
  const { left: leftColumns, right: rightColumns } = spreadColumns(left, right);
  const isLeftCode = (b: OcrBox) => center(b) < LEFT_CODE_MAX_X && parseCode(b.text) !== null;
  const isRightCode = (b: OcrBox) => center(b) > RIGHT_CODE_MIN_X && parseCode(b.text) !== null;

  const codeYs = [...left.boxes.filter(isLeftCode), ...right.boxes.filter(isRightCode)].map(middle);
  const anchors = clusterYs(codeYs, CODE_MERGE);
  if (anchors.length) {
    const [top, bottom] = [Math.min(...anchors) - 0.03, Math.max(...anchors) + 0.03];
    const nameOnly = left.boxes
      .filter((b) => center(b) >= LEFT_CODE_MAX_X && center(b) < NAME_MAX_X)
      .map(middle)
      .filter((y) => y >= top && y <= bottom && anchors.every((a) => Math.abs(a - y) > NAME_ANCHOR_GAP));
    anchors.push(...clusterYs(nameOnly, NAME_MERGE));
    anchors.sort((a, b) => a - b);
  }

  const rows: SpreadRow[] = anchors.map((y) => ({
    page: left.page,
    y,
    code: null,
    leftCode: null,
    rightCode: null,
    name: null,
    part: null,
    values: emptyValues(),
    problems: [],
  }));
  const filled = rows.map(() => new Set<TcacField>());
  const names = rows.map(() => [] as OcrBox[]);

  const rowFor = (b: OcrBox): number => {
    let best = -1;
    let bestDistance = Infinity;
    rows.forEach((row, i) => {
      const distance = Math.abs(row.y - middle(b));
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    return bestDistance <= ROW_TOLERANCE ? best : -1;
  };

  const place = (index: number, b: OcrBox, columns: Column[]) => {
    const row = rows[index];
    const placed = splitBox(b, columns);
    if (!placed) {
      row.problems.push(`UNASSIGNED:${b.text.trim()}`);
      return;
    }
    for (const { column, value } of placed) {
      if (!column.field) continue;
      if (filled[index].has(column.field)) {
        row.values[column.field] = "INVALID";
        row.problems.push(`CONFLICT:${column.field}`);
        continue;
      }
      filled[index].add(column.field);
      row.values[column.field] = value;
      if (value === "INVALID") row.problems.push(`INVALID_CELL:${column.field}`);
    }
  };

  const leftNumbers = rows.map(() => [] as OcrBox[]);
  const rightNumbers = rows.map(() => [] as OcrBox[]);

  for (const b of left.boxes) {
    const index = rowFor(b);
    if (index < 0) continue;
    const x = center(b);
    if (isLeftCode(b)) rows[index].leftCode = parseCode(b.text);
    else if (x < NAME_MAX_X && x >= LEFT_CODE_MAX_X) names[index].push(b);
    else if (x < PART_MAX_X && x >= NAME_MAX_X) rows[index].part = b.text.trim();
    else if (x >= PART_MAX_X) leftNumbers[index].push(b);
  }

  for (const b of right.boxes) {
    const index = rowFor(b);
    if (index < 0) continue;
    if (isRightCode(b)) rows[index].rightCode = parseCode(b.text);
    else rightNumbers[index].push(b);
  }

  rows.forEach((_, i) => {
    for (const b of mergeFragments(leftNumbers[i])) place(i, b, leftColumns);
    for (const b of mergeFragments(rightNumbers[i])) place(i, b, rightColumns);
  });

  rows.forEach((row, i) => {
    row.name = names[i].length ? names[i].sort((a, b) => a.y - b.y).map((b) => b.text.trim()).join(" ") : null;
    row.code = row.rightCode ?? row.leftCode;
    if (row.leftCode && row.rightCode && row.leftCode !== row.rightCode) {
      row.problems.push(`CODE_MISMATCH:${row.leftCode}/${row.rightCode}`);
    }
  });

  return rows;
}
