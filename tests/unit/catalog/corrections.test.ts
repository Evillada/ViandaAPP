import { describe, expect, it } from "vitest";
import type { CellValue, TcacField } from "@/core/catalog/tcac-parse";
import { ALL_FIELDS } from "@/core/catalog/tcac-parse";
import type { MergedRow } from "@/core/catalog/tcac-merge";
import { applyCorrections, parseCorrections, parseCsv } from "@/core/catalog/corrections";

function row(code: string, values: Partial<Record<TcacField, CellValue>> = {}, extra: Partial<MergedRow> = {}): MergedRow {
  const base = Object.fromEntries(ALL_FIELDS.map((f) => [f, null])) as Record<TcacField, CellValue>;
  return {
    page: 51, y: 0.4012, code, leftCode: code, rightCode: code, name: "Coliflor, crudo", part: null,
    values: { ...base, ...values }, problems: [], candidates: {}, notes: [], ...extra,
  };
}

describe("parseCsv", () => {
  it("respeta comillas y comas dentro de campos", () => {
    expect(parseCsv('a,b,c\n1,"x, y",3\n')).toEqual([["a", "b", "c"], ["1", "x, y", "3"]]);
  });
});

describe("applyCorrections", () => {
  const csv = [
    "ref,field,value,note",
    "B039,fat,0.1,leído en la imagen",
    "B040,ash,,celda vacía en el original",
    "p51@0.4500,code,B041,código ilegible",
    'B039,name,"Coliflor, cruda",nombre',
  ].join("\n");

  it("corrige celdas, vacía celdas, fija códigos por posición y renombra", () => {
    const rows = [
      row("B039", { fat: "INVALID" }, { problems: ["INVALID_CELL:fat"] }),
      row("B040", { ash: 3 }, { y: 0.423 }),
      row("B040", {}, { y: 0.45, problems: ["CODE_MISMATCH:B040/B041"] }),
    ];
    const fixed = applyCorrections(rows, parseCorrections(csv));
    expect(fixed[0].values.fat).toBe(0.1);
    expect(fixed[0].name).toBe("Coliflor, cruda");
    expect(fixed[0].problems).toEqual([]);
    expect(fixed[1].values.ash).toBeNull();
    expect(fixed[2].code).toBe("B041");
    expect(fixed[2].problems).toEqual([]);
    expect(fixed[0].notes).toContain("CORRECTED:fat");
  });

  it("una corrección que no aplica a ninguna fila es un error", () => {
    expect(() => applyCorrections([row("B039")], parseCorrections("ref,field,value,note\nZ999,fat,1,x"))).toThrow(/Z999/);
    expect(() => applyCorrections([row("B039")], parseCorrections("ref,field,value,note\nB039,grasa,1,x"))).toThrow(/grasa/);
  });
});
