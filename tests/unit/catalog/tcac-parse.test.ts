import { describe, expect, it } from "vitest";
import type { HeaderBox, OcrBox, OcrPage } from "@/core/catalog/ocr-types";
import {
  PROXIMAL_COLUMNS,
  calibrateColumns,
  calibrateRightColumns,
  mergeFragments,
  parseCode,
  parseNumber,
  parseSpread,
} from "@/core/catalog/tcac-parse";

function box(text: string, centerX: number, centerY: number, w = 0.02): OcrBox {
  return { text, conf: 1, x: centerX - w / 2, y: centerY - 0.0065, w, h: 0.013 };
}

function header(text: string, centerX: number): HeaderBox {
  return { text, conf: 1, x: centerX - 0.01, w: 0.02 };
}

const RIGHT_HEADER = [
  header("Calcio (mg)", 0.091),
  header("Hierro (mg)", 0.132),
  header("Sodio (mg)", 0.172),
  header("MINERALES", 0.233),
  header("Fósforo (mg)", 0.213),
  header("Grasa Saturada (g)", 0.704),
  header("Monoin saturada (g)", 0.753),
  header("Polinsaturada (g)", 0.794),
  header("Parte Comestible (%)", 0.868),
  header("Código", 0.912),
];

function leftRow(y: number, code: string | null, name: string, values: (string | null)[]): OcrBox[] {
  const boxes = [box(name, 0.2, y, 0.2)];
  if (code) boxes.push(box(code, 0.089, y));
  PROXIMAL_COLUMNS.forEach((column, i) => {
    const value = values[i];
    if (value !== null && value !== undefined) boxes.push(box(value, column.x, y));
  });
  return boxes;
}

function spread(left: OcrBox[], right: OcrBox[], headerBoxes = RIGHT_HEADER): [OcrPage, OcrPage] {
  return [
    { page: 81, width: 623.25, height: 623.25, boxes: left },
    { page: 82, width: 623.25, height: 623.25, boxes: right, headerBoxes },
  ];
}

describe("parseNumber", () => {
  it("acepta coma o punto decimal y enteros", () => {
    expect(parseNumber("96,8")).toBe(96.8);
    expect(parseNumber("0.1")).toBe(0.1);
    expect(parseNumber("1533")).toBe(1533);
  });

  it("vacío es celda vacía, basura es inválida (nunca se adivina)", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("0.т")).toBe("INVALID");
    expect(parseNumber("10.T")).toBe("INVALID");
    expect(parseNumber("1,₴")).toBe("INVALID");
  });
});

describe("parseCode y mergeFragments", () => {
  it("corrige confusiones 0/O y 8/B sólo dentro del formato de código", () => {
    expect(parseCode("COB1")).toBe("C081");
    expect(parseCode("8092")).toBe("B092");
    expect(parseCode("A028")).toBe("A028");
    expect(parseCode("T00")).toBeNull();
    expect(parseCode("Z001")).toBeNull();
  });

  it("la O en una celda numérica es cero", () => {
    expect(parseNumber("O,5")).toBe(0.5);
  });

  it("une cifras partidas en dos cajas pegadas y deja separadas las que no lo están", () => {
    const merged = mergeFragments([box(",4", 0.712, 0.3, 0.008), box("2,", 0.704, 0.3, 0.008), box("15", 0.8, 0.3)]);
    expect(merged.map((b) => b.text)).toEqual(["2,4", "15"]);
  });
});

describe("calibrateRightColumns", () => {
  it("ubica sodio, grasa saturada, parte comestible y código desde el encabezado", () => {
    const columns = calibrateRightColumns(RIGHT_HEADER);
    const byField = Object.fromEntries(columns.filter((c) => c.field).map((c) => [c.field, c.x]));
    expect(byField.sodium).toBeCloseTo(0.172, 3);
    expect(byField.saturatedFat).toBeCloseTo(0.704, 3);
    expect(byField.edibleFraction).toBeCloseTo(0.868, 3);
    expect(columns.some((c) => c.label === "MINERALES")).toBe(false);
    expect(columns.filter((c) => c.field === "saturatedFat")).toHaveLength(1);
  });

  it("funciona con otra disposición y sin grasa saturada", () => {
    const columns = calibrateRightColumns([
      header("odio (mg)", 0.198),
      header("alcio (mg)", 0.096),
      header("arte Comestible (%)", 0.859),
      header("ódigo", 0.911),
    ]);
    const fields = columns.map((c) => c.field).filter(Boolean);
    expect(fields).toEqual(expect.arrayContaining(["sodium", "edibleFraction"]));
    expect(fields).not.toContain("saturatedFat");
  });
});

describe("calibrateColumns", () => {
  it("centra encabezados de dos líneas y reconoce la página proximal sin carbohidratos disponibles", () => {
    const columns = calibrateColumns(
      [
        header("Humedad (g)", 0.591),
        header("Energía (Kcal)", 0.636),
        header("Energía (kJ)", 0.682),
        header("ANALISIS PROXIMAL", 0.749),
        header("Proteína (g)", 0.728),
        header("Lípidos (g)", 0.773),
        header("Carbohidratos", 0.81),
        header("Totales (g)", 0.826),
        header("Fibra Distaria (g)", 0.864),
        header("Cenizas (g)", 0.91),
      ],
      0.56
    );
    expect(columns.map((c) => c.field)).toEqual(["moisture", "energyKcal", "energyKj", "protein", "fat", "carbsTotal", "fiber", "ash"]);
    expect(columns.find((c) => c.field === "carbsTotal")?.x).toBeCloseTo(0.818, 3);
  });

  it("intercala una columna sin nombre cuando falta un encabezado", () => {
    const columns = calibrateColumns([
      header("Calcio (mg)", 0.09),
      header("Hierro (mg)", 0.13),
      header("Sodio (mg)", 0.17),
      header("Fósforo (mg)", 0.21),
      header("Magnesio (mg)", 0.29),
    ]);
    expect(columns.map((c) => c.label)).toEqual(["Calcio (mg)", "Hierro (mg)", "Sodio (mg)", "Fósforo (mg)", "?", "Magnesio (mg)"]);
  });
});

describe("parseSpread", () => {
  it("une izquierda y derecha por altura y toma el código del lado que lo tenga", () => {
    const left = [
      ...leftRow(0.3, "H003", "Bebida de avena en hojuelas, en agua, sin azúcar", ["86,5", "59", "249", "1,9", "1,0", "9,8", "8,2", "1,6", "0,8"]),
      ...leftRow(0.322, null, "Bebida de harina de avena", ["84,8", "69", "289", "2,9", "1,4", "10,3", "8,5", "1,8", "0,7"]),
    ];
    const right = [
      box("5", 0.172, 0.3), box("100", 0.868, 0.3), box("H003", 0.912, 0.3),
      box("3", 0.172, 0.3221), box("100", 0.868, 0.3221), box("H004", 0.912, 0.3221),
    ];
    const rows = parseSpread(...spread(left, right));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "H003", values: { energyKcal: 59, sodium: 5, edibleFraction: 100, carbsAvailable: 8.2 } });
    expect(rows[1]).toMatchObject({ code: "H004", leftCode: null, rightCode: "H004", name: "Bebida de harina de avena" });
  });

  it("une nombres partidos en dos líneas y conserva celdas vacías reales", () => {
    const y = 0.4;
    const left = [
      box("T011", 0.089, y),
      box("Fríjol cargamanto rojo,", 0.2, y - 0.0065, 0.2),
      box("crudo", 0.2, y + 0.0065, 0.1),
      box("Semilla", 0.5, y, 0.05),
      box("12,0", PROXIMAL_COLUMNS[0].x, y),
      box("361", PROXIMAL_COLUMNS[1].x, y),
    ];
    const [row] = parseSpread(...spread(left, [box("T011", 0.912, y)]));
    expect(row.name).toBe("Fríjol cargamanto rojo, crudo");
    expect(row.part).toBe("Semilla");
    expect(row.values.moisture).toBe(12);
    expect(row.values.ash).toBeNull();
  });

  it("reparte una caja con dos celdas pegadas cuando cubre exactamente dos columnas", () => {
    const y = 0.5;
    const [kcal, kj] = [PROXIMAL_COLUMNS[1].x, PROXIMAL_COLUMNS[2].x];
    const merged: OcrBox = { text: "6 30", conf: 1, x: kcal - 0.008, y: y - 0.0065, w: kj - kcal + 0.016, h: 0.013 };
    const [row] = parseSpread(...spread([box("H006", 0.089, y), box("Cerveza", 0.2, y, 0.1), merged], [box("H006", 0.912, y)]));
    expect(row.values.energyKcal).toBe(6);
    expect(row.values.energyKj).toBe(30);
    expect(row.problems).toEqual([]);
  });

  it("marca celdas inválidas y conflictos en lugar de adivinar", () => {
    const y = 0.6;
    const left = [
      box("H009", 0.089, y),
      box("Guarapo", 0.2, y, 0.1),
      box("0.т", PROXIMAL_COLUMNS[3].x, y),
      box("1", PROXIMAL_COLUMNS[4].x - 0.004, y),
      box("2", PROXIMAL_COLUMNS[4].x + 0.004, y),
    ];
    const [row] = parseSpread(...spread(left, [box("H009", 0.912, y)]));
    expect(row.values.protein).toBe("INVALID");
    expect(row.values.fat).toBe("INVALID");
    expect(row.problems).toEqual(expect.arrayContaining(["INVALID_CELL:protein", "CONFLICT:fat"]));
  });

  it("señala códigos distintos entre izquierda y derecha", () => {
    const y = 0.7;
    const [row] = parseSpread(...spread([box("H005", 0.089, y), box("Cerveza", 0.2, y, 0.1)], [box("H006", 0.912, y)]));
    expect(row.code).toBe("H006");
    expect(row.problems).toContain("CODE_MISMATCH:H005/H006");
  });
});
