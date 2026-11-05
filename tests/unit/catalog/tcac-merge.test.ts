import { describe, expect, it } from "vitest";
import type { CellValue, Column, SpreadRow, TcacField } from "@/core/catalog/tcac-parse";
import { ALL_FIELDS } from "@/core/catalog/tcac-parse";
import { applyCellReads, cellId, cellRequests, mergeReadings } from "@/core/catalog/tcac-merge";

function row(values: Partial<Record<TcacField, CellValue>>, extra: Partial<SpreadRow> = {}): SpreadRow {
  const base = Object.fromEntries(ALL_FIELDS.map((f) => [f, null])) as Record<TcacField, CellValue>;
  return { page: 51, y: 0.4, code: "B039", leftCode: "B039", rightCode: "B039", name: "Coliflor, crudo", part: "Flor", values: { ...base, ...values }, problems: [], ...extra };
}

describe("mergeReadings", () => {
  it("acepta coincidencias, completa con el lector que sí leyó y marca desacuerdos", () => {
    const [merged] = mergeReadings(
      [row({ moisture: 91.7, energyKcal: 36, protein: null, fat: "INVALID" }, { problems: ["INVALID_CELL:fat", "UNASSIGNED:- 7"] })],
      [row({ moisture: 91.7, energyKcal: 38, protein: 1.9, fat: 0.1 }, { y: 0.401 })]
    );
    expect(merged.values).toMatchObject({ moisture: 91.7, protein: 1.9, fat: 0.1, energyKcal: "INVALID" });
    expect(merged.candidates.energyKcal).toEqual([36, 38]);
    expect(merged.problems).toEqual(["DISAGREE:energyKcal"]);
  });

  it("conserva filas que sólo vio un lector", () => {
    const merged = mergeReadings([row({ moisture: 91.7 })], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].values.moisture).toBe(91.7);
  });
});

describe("cellRequests y applyCellReads", () => {
  const columns: Column[] = [
    { x: 0.586, label: "Humedad", field: "moisture" },
    { x: 0.63, label: "kcal", field: "energyKcal" },
    { x: 0.71, label: "Proteína", field: "protein" },
  ];

  it("pide releer sólo celdas vacías o inválidas de columnas que existen en la página", () => {
    const [merged] = mergeReadings([row({ moisture: 91.7, energyKcal: "INVALID" })], []);
    const requests = cellRequests([merged], new Map([[51, { left: columns, right: [] }]]));
    expect(requests.map((r) => r.id)).toEqual([cellId(51, 0.4, "energyKcal"), cellId(51, 0.4, "protein")]);
    const kcal = requests[0];
    expect(kcal.x0).toBeLessThan(0.63);
    expect(kcal.x1).toBeGreaterThan(0.63);
    expect(kcal.x1 - kcal.x0).toBeLessThan(0.05);
  });

  it("la tercera lectura desempata, completa o confirma que la celda está vacía", () => {
    const [merged] = mergeReadings(
      [row({ energyKcal: 36, protein: null, fat: null })],
      [row({ energyKcal: 38, protein: null, fat: null })]
    );
    const [fixed] = applyCellReads([merged], {
      [cellId(51, 0.4, "energyKcal")]: "36",
      [cellId(51, 0.4, "protein")]: "1,9",
      [cellId(51, 0.4, "fat")]: "",
    });
    expect(fixed.values).toMatchObject({ energyKcal: 36, protein: 1.9, fat: null });
    expect(fixed.problems).toEqual([]);
    expect(fixed.notes).toEqual(expect.arrayContaining(["CELL_READ:energyKcal", "CELL_READ:protein"]));
  });

  it("si la tercera lectura no coincide con ninguno de los dos, el desacuerdo sigue abierto", () => {
    const [merged] = mergeReadings([row({ energyKcal: 36 })], [row({ energyKcal: 38 })]);
    const [fixed] = applyCellReads([merged], { [cellId(51, 0.4, "energyKcal")]: "56" });
    expect(fixed.values.energyKcal).toBe("INVALID");
    expect(fixed.problems).toContain("DISAGREE:energyKcal");
  });
});
