import { describe, expect, it } from "vitest";
import type { CellValue, Column, SpreadRow, TcacField } from "@/core/catalog/tcac-parse";
import { ALL_FIELDS } from "@/core/catalog/tcac-parse";
import { INK_UNREAD, applyCellReads, cellId, cellRequests, mergeReadings, resolveByChecksums } from "@/core/catalog/tcac-merge";

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

describe("resolveByChecksums", () => {
  // A028 Harina de arroz, cruda (p. 45): 12,0 · 361 · 1533 · 6,0 · 1,4 · 80,0 · 77,6 · 2,4 · 0,6
  const A028 = { moisture: 12, energyKcal: 361, energyKj: 1533, protein: 6, fat: 1.4, carbsTotal: 80, carbsAvailable: 77.6, fiber: 2.4, ash: 0.6 };

  it("la única combinación que suma 100 g y cuadra kJ decide la confusión 5/6", () => {
    const [merged] = mergeReadings([row({ ...A028, energyKcal: 351, fat: 1.4 })], [row({ ...A028, energyKcal: 361, fat: 1.4 })]);
    const [fixed] = resolveByChecksums([merged], {});
    expect(fixed.values.energyKcal).toBe(361);
    expect(fixed.problems).toEqual([]);
    expect(fixed.notes).toContain("CHECKSUM:energyKcal");
  });

  it("carbohidratos disponibles + fibra = totales decide entre lecturas", () => {
    const [merged] = mergeReadings([row({ ...A028, carbsAvailable: 77.6 })], [row({ ...A028, carbsAvailable: 71.6 })]);
    expect(resolveByChecksums([merged], {})[0].values.carbsAvailable).toBe(77.6);
  });

  it("incluye la lectura de celda como opción", () => {
    const [merged] = mergeReadings([row({ ...A028, protein: 5 })], [row({ ...A028, protein: 8 })]);
    const [fixed] = resolveByChecksums([merged], { [cellId(51, 0.4, "protein")]: "6,0" });
    expect(fixed.values.protein).toBe(6);
  });

  it("no decide si dos combinaciones cumplen o si no hay comprobación que involucre el campo", () => {
    const [ambiguous] = mergeReadings([row({ ...A028, sodium: 5 })], [row({ ...A028, sodium: 6 })]);
    expect(resolveByChecksums([ambiguous], {})[0].values.sodium).toBe("INVALID");
    const [both] = mergeReadings([row({ ...A028, moisture: 12, ash: 0.6 })], [row({ ...A028, moisture: 12.1, ash: 0.5 })]);
    expect(resolveByChecksums([both], {})[0].values.moisture).toBe("INVALID");
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

  it("una celda vacía con tinta que no se pudo leer queda marcada en vez de vacía", () => {
    const [merged] = mergeReadings([row({ energyKcal: 38, sodium: null, fiber: null })], []);
    const [fixed] = applyCellReads([merged], { [cellId(51, 0.4, "sodium")]: INK_UNREAD, [cellId(51, 0.4, "fiber")]: "O." });
    expect(fixed.values).toMatchObject({ sodium: "INVALID", fiber: "INVALID" });
    expect(fixed.problems).toEqual(expect.arrayContaining(["INVALID_CELL:sodium", "INVALID_CELL:fiber"]));
  });

  it("si la tercera lectura no coincide con ninguno de los dos, el desacuerdo sigue abierto", () => {
    const [merged] = mergeReadings([row({ energyKcal: 36 })], [row({ energyKcal: 38 })]);
    const [fixed] = applyCellReads([merged], { [cellId(51, 0.4, "energyKcal")]: "56" });
    expect(fixed.values.energyKcal).toBe("INVALID");
    expect(fixed.problems).toContain("DISAGREE:energyKcal");
  });
});
