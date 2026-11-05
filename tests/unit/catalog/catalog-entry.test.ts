import { describe, expect, it } from "vitest";
import { catalogEntry, parseTcacCsv } from "@/core/catalog/catalog-entry";

const CSV = [
  "code,name,tcac_group,part,moisture,energyKcal,energyKj,protein,fat,carbsTotal,carbsAvailable,fiber,ash,sodium,saturatedFat,edibleFraction,needs_review,issues,source_page",
  'A009,"Arroz blanco, pulido, cocido, sin sal",A,,68.4,130,544,2.4,0.2,28.6,28.2,0.4,0.4,1,0.1,100,false,,43',
  'S001,Ajiaco santafereño,S,,82,85,356,4.1,2.6,11.3,,,0.9,190,,100,false,,107',
].join("\n");

describe("entrada de catálogo", () => {
  const [arroz, ajiaco] = parseTcacCsv(CSV);
  const matches = new Map([["A009", { subgroup: "CEREALS" as const, grams: 80, measure: "6 cucharadas soperas colmadas" }]]);

  it("lee el CSV con celdas vacías como sin dato", () => {
    expect(arroz.values.energyKcal).toBe(130);
    expect(ajiaco.values.carbsAvailable).toBeNull();
    expect(ajiaco.sourcePage).toBe(107);
  });

  it("arma el alimento con porción de intercambio y medida casera", () => {
    const entry = catalogEntry(arroz, matches);
    expect(entry).toMatchObject({
      code: "A009",
      groupLetter: "A",
      sourceRef: "TCAC 2018, p. 43",
      searchName: "arroz blanco, pulido, cocido, sin sal",
      gabaGroup: "CEREALS_TUBERS",
      gabaSubgroup: "CEREALS",
      exchangeGrams: 80,
      exchangeEstimated: false,
      needsReview: false,
    });
    expect(entry.portions).toEqual([
      { name: "1 intercambio · 6 cucharadas soperas colmadas", grams: 80, isDefault: true },
      { name: "100 g", grams: 100, isDefault: false },
    ]);
    expect(entry.nutrients).toContainEqual({ name: "Carbohidratos", amountPer100g: 28.6 });
  });

  it("aplica la fe de erratas de la fuente al nombre y lo deja documentado", () => {
    const [row] = parseTcacCsv(CSV.replace("A009,\"Arroz blanco, pulido, cocido, sin sal\"", "A011,\"Arroz integral, cocido, sin sal\""));
    const entry = catalogEntry(row, new Map());
    expect(entry.name).toBe("Arroz integral, crudo");
    expect(entry.searchName).toBe("arroz integral, crudo");
    expect(entry.sourceRef).toContain("fe de erratas");
  });

  it("sin dato no se guarda nutriente, y sin grupo la porción por defecto es 100 g", () => {
    const entry = catalogEntry(ajiaco, matches);
    expect(entry.nutrients.map((n) => n.name)).not.toContain("Carbohidratos disponibles");
    expect(entry.nutrients.map((n) => n.name)).not.toContain("Grasas saturadas");
    expect(entry.portions).toEqual([{ name: "100 g", grams: 100, isDefault: true }]);
    expect(entry.needsReview).toBe(true);
  });
});
