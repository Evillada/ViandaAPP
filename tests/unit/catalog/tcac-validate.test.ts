import { describe, expect, it } from "vitest";
import type { CellValue, TcacField } from "@/core/catalog/tcac-parse";
import { resolveCodes, validateCatalog, validateRow, type TcacRow } from "@/core/catalog/tcac-validate";

const FIELDS: TcacField[] = [
  "moisture", "energyKcal", "energyKj", "protein", "fat", "carbsTotal", "carbsAvailable", "fiber", "ash", "sodium", "saturatedFat", "edibleFraction",
];

function row(code: string, name: string, values: Partial<Record<TcacField, CellValue>>, extra: Partial<TcacRow> = {}): TcacRow {
  const base = Object.fromEntries(FIELDS.map((f) => [f, null])) as Record<TcacField, CellValue>;
  return { page: 81, y: 0.3, code, leftCode: code, rightCode: code, name, part: null, values: { ...base, ...values }, problems: [], ...extra };
}

// Página 81 de la TCAC: H003 tal como aparece impresa.
const H003 = { moisture: 86.5, energyKcal: 59, energyKj: 249, protein: 1.9, fat: 1.0, carbsTotal: 9.8, carbsAvailable: 8.2, fiber: 1.6, ash: 0.8, sodium: 5, edibleFraction: 100 };

const blocking = (issues: { code: string; blocking: boolean }[]) => issues.filter((i) => i.blocking).map((i) => i.code);

describe("validateRow", () => {
  it("una fila impresa correctamente no tiene problemas que bloqueen", () => {
    expect(blocking(validateRow(row("H003", "Bebida de avena", H003)))).toEqual([]);
  });

  it("un dígito mal leído en las kcal (62 → 52) se detecta por los kJ", () => {
    const issues = validateRow(row("H010", "Néctar de albaricoque, con azúcar", { moisture: 84.6, energyKcal: 52, energyKj: 261, protein: 0.4, fat: 0, carbsTotal: 14.7, ash: 0.3 }));
    expect(blocking(issues)).toContain("KJ_MISMATCH");
  });

  it("la composición que no suma 100 g bloquea", () => {
    expect(blocking(validateRow(row("H003", "Bebida de avena", { ...H003, protein: 7.9 })))).toContain("PROXIMATE_SUM");
  });

  it("la energía inconsistente sólo advierte cuando la suma de 100 g sí se pudo verificar", () => {
    const issues = validateRow(row("P085", "Sacha inchi, cruda", { moisture: 15.8, energyKcal: 657, energyKj: 2749, protein: 15.8, fat: 50.2, carbsTotal: 15.5, ash: 2.7 }));
    expect(issues.find((i) => i.code === "ENERGY_MISMATCH")).toMatchObject({ blocking: false });
    const withoutAsh = validateRow(row("P085", "Sacha inchi, cruda", { moisture: 15.8, energyKcal: 657, energyKj: 2749, protein: 15.8, fat: 50.2, carbsTotal: 15.5 }));
    expect(withoutAsh.find((i) => i.code === "ENERGY_MISMATCH")).toMatchObject({ blocking: true });
  });

  it("las bebidas alcohólicas quedan exentas del chequeo de energía", () => {
    const issues = validateRow(row("H006", "Cerveza, regular, 4% de alcohol", { moisture: 93.3, energyKcal: 38, energyKj: 158, protein: 0.4, fat: 0, carbsTotal: 2.1 }));
    expect(issues.map((i) => i.code)).not.toContain("ENERGY_MISMATCH");
  });

  it("en bebidas alcohólicas la suma de 100 g descuenta el porcentaje de alcohol", () => {
    const beer = { moisture: 93.3, energyKcal: 38, energyKj: 158, protein: 0.4, fat: 0, carbsTotal: 2.1, ash: 0.2 };
    expect(blocking(validateRow(row("H006", "Cerveza, regular, 4% de alcohol", beer)))).toEqual([]);
    expect(blocking(validateRow(row("H006", "Cerveza, regular, 4% de alcohol", { ...beer, moisture: 83.3 })))).toContain("PROXIMATE_SUM");
  });

  it("faltan datos básicos o hay celdas del OCR con problemas", () => {
    expect(blocking(validateRow(row("A001", "Almidón", { energyKcal: 350 })))).toContain("MISSING_CORE");
    const ocr = validateRow(row("H009", "Guarapo", { ...H003, protein: "INVALID" }, { problems: ["INVALID_CELL:protein", "UNASSIGNED:- 7"] }));
    expect(blocking(ocr)).toEqual(expect.arrayContaining(["INVALID_CELL", "UNASSIGNED"]));
  });

  it("rangos imposibles bloquean", () => {
    expect(blocking(validateRow(row("H003", "Bebida de avena", { ...H003, saturatedFat: 3 })))).toContain("OUT_OF_RANGE");
    expect(blocking(validateRow(row("H003", "Bebida de avena", { ...H003, edibleFraction: 140 })))).toContain("OUT_OF_RANGE");
  });
});

describe("resolveCodes", () => {
  it("elige el código que respeta el orden con las filas vecinas", () => {
    const rows = [
      row("A050", "a", {}),
      row("A061", "b", {}, { leftCode: "A051", rightCode: "A061", problems: ["CODE_MISMATCH:A051/A061"] }),
      row("A052", "c", {}),
    ];
    const [, fixed] = resolveCodes(rows);
    expect(fixed.code).toBe("A051");
    expect(fixed.problems).not.toContain("CODE_MISMATCH:A051/A061");
    expect(fixed.notes).toContain("CODE_RESOLVED:A051");
  });

  it("repara una racha de códigos con 6 leído como 5 en ambas páginas", () => {
    const rows = [row("A059", "a", {}), row("A050", "b", {}), row("A051", "c", {}), row("A067", "d", {}, { leftCode: "A057", rightCode: "A067", problems: ["CODE_MISMATCH:A057/A067"] })];
    const fixed = resolveCodes(rows);
    expect(fixed.map((r) => r.code)).toEqual(["A059", "A060", "A061", "A067"]);
    expect(fixed[1].notes).toContain("CODE_REPAIRED:A050>A060");
    expect(fixed[3].problems).toEqual([]);
  });

  it("deja el conflicto abierto si el orden no decide", () => {
    const rows = [row("A050", "a", {}), row("A061", "b", {}, { leftCode: "A055", rightCode: "A056", problems: ["CODE_MISMATCH:A055/A056"] }), row("A070", "c", {})];
    expect(resolveCodes(rows)[1].problems).toContain("CODE_MISMATCH:A055/A056");
  });
});

describe("validateCatalog — aceptados", () => {
  it("un problema aceptado por venir así de la fuente queda como aviso", () => {
    const E011 = { moisture: 78.8, energyKcal: 126, energyKj: 526, protein: 17, fat: 6.4, carbsTotal: 0, fiber: 0, ash: 1.1 };
    const [plain] = validateCatalog([row("E011", "Bocachico", E011)]);
    expect(plain.issues.find((i) => i.code === "PROXIMATE_SUM")?.blocking).toBe(true);
    const [accepted] = validateCatalog([row("E011", "Bocachico", E011, { notes: ["ACCEPTED:PROXIMATE_SUM"] })]);
    expect(accepted.issues.find((i) => i.code === "PROXIMATE_SUM")?.blocking).toBe(false);
  });
});

describe("validateCatalog", () => {
  it("detecta códigos duplicados y fuera de orden", () => {
    const result = validateCatalog([row("H004", "a", H003), row("H004", "b", H003), row("H002", "c", H003)]);
    expect(result.find((r) => r.row.name === "b")?.issues.map((i) => i.code)).toContain("DUPLICATE_CODE");
    expect(result.find((r) => r.row.name === "c")?.issues.map((i) => i.code)).toContain("CODE_ORDER");
  });
});
