import { describe, expect, it } from "vitest";
import { allergensFor, confirmedMatches, exchangeFor, gabaGroupFor, gabaSubgroupFor, highInFor, isProcessed, needsReview, type CatalogFood } from "@/core/catalog/enrich";

function food(code: string, name: string, values: Partial<CatalogFood["values"]> = {}): CatalogFood {
  return { code, name, part: null, values: { energyKcal: 100, fat: 1, sodium: null, saturatedFat: null, ...values } };
}

describe("grupo y subgrupo GABA", () => {
  it("mapea por grupo TCAC con las excepciones de las GABA", () => {
    expect(gabaGroupFor(food("A040", "Harina de trigo, fortificada, todo propósito, cruda"))).toBe("CEREALS_TUBERS");
    expect(gabaSubgroupFor(food("B091", "Plátano hartón, verde, crudo"))).toBe("PLANTAINS");
    expect(gabaSubgroupFor(food("B068", "Papa, variedad cerosa, sabanera, sin cáscara, cruda"))).toBe("TUBERS");
    expect(gabaGroupFor(food("B003", "Acelga, hojas, cruda"))).toBe("VEGETABLES");
    expect(gabaSubgroupFor(food("C001", "Aguacate Hass, crudo"))).toBe("FATS_MONOUNSATURATED");
    expect(gabaSubgroupFor(food("C003", "Almendra, seca", { moisture: 4 }))).toBe("NUTS_SEEDS");
    expect(gabaSubgroupFor(food("C058", "Marañón, seco", { moisture: 87 }))).toBe("FRUITS");
    expect(gabaSubgroupFor(food("T026", "Maní, con piel, crudo"))).toBe("NUTS_SEEDS");
    expect(gabaSubgroupFor(food("G012", "Leche de vaca, entera, líquida, pasteurizada"))).toBe("MILK_WHOLE");
    expect(gabaSubgroupFor(food("G007", "Leche de vaca, descremada, líquida, pasteurizada"))).toBe("MILK_REDUCED_FAT");
    expect(gabaSubgroupFor(food("G002", "Kumis, entero, con azúcar"))).toBe("DAIRY_WHOLE");
    expect(gabaSubgroupFor(food("G014", "Queso crema, amarillo"))).toBe("FATS_SATURATED");
    expect(gabaSubgroupFor(food("K029", "Panela"))).toBe("SUGARS_SIMPLE");
    expect(gabaSubgroupFor(food("K019", "Gelatina con azúcar, líquida"))).toBe("SWEETS");
  });

  it("vísceras, mariscos de las GABA y carnes con ≥ 10 g de grasa van a altos en grasa saturada y colesterol", () => {
    expect(gabaSubgroupFor(food("F109", "Res, hígado, crudo", { fat: 3.6 }))).toBe("HIGH_FAT_MEATS");
    expect(gabaSubgroupFor(food("E018", "Camarón, crudo", { fat: 1 }))).toBe("HIGH_FAT_MEATS");
    expect(gabaSubgroupFor(food("F034", "Chorizo de cerdo y res, crudo", { fat: 28 }))).toBe("HIGH_FAT_MEATS");
    expect(gabaSubgroupFor(food("F086", "Pollo, pechuga sin piel, cruda", { fat: 1.5 }))).toBe("LEAN_MEATS");
    expect(gabaSubgroupFor(food("E038", "Salmón, filete, crudo", { fat: 12 }))).toBe("LEAN_MEATS");
    expect(gabaSubgroupFor(food("E040", "Sardinas, enlatadas en salsa de tomate", { fat: 10 }))).toBe("HIGH_FAT_MEATS");
  });

  it("tubérculos andinos y productos 'bajos en' encuentran su subgrupo", () => {
    expect(gabaSubgroupFor(food("P077", "Olloco o chugua, con cáscara, cruda"))).toBe("TUBERS");
    expect(gabaSubgroupFor(food("P063", "Majua o cubio, con cáscara, crudo"))).toBe("TUBERS");
    expect(gabaSubgroupFor(food("N005", "Yogurt, bebible, descremado, sin azúcar"))).toBe("DAIRY_REDUCED_FAT");
    expect(gabaSubgroupFor(food("N002", "Mayonesa, baja en grasa"))).toBe("FATS_POLYUNSATURATED");
  });

  it("una coincidencia GABA confirmada manda sobre la regla", () => {
    const jamon = food("F051", "Jamón de cerdo y res, tipo sanduche, precocido", { fat: 14 });
    expect(gabaSubgroupFor(jamon)).toBe("HIGH_FAT_MEATS");
    expect(gabaSubgroupFor(jamon, new Map([["F051", { subgroup: "LEAN_MEATS" as const, grams: 84, measure: "4 tajadas" }]]))).toBe("LEAN_MEATS");
  });

  it("bebidas, preparaciones y manufacturados quedan sin grupo", () => {
    expect(gabaGroupFor(food("S001", "Ajiaco santafereño"))).toBeNull();
    expect(gabaGroupFor(food("H006", "Cerveza, regular, 4% de alcohol"))).toBeNull();
  });
});

describe("porción de intercambio", () => {
  it("usa los gramos y la medida casera de la lista GABA confirmada", () => {
    const matches = new Map([["A010", { subgroup: "CEREALS" as const, grams: 80, measure: "6 cucharadas soperas colmadas" }]]);
    expect(exchangeFor(food("A010", "Arroz blanco, pulido, cocido, sin sal", { energyKcal: 130 }), matches)).toEqual({
      grams: 80,
      measure: "6 cucharadas soperas colmadas",
      estimated: false,
    });
  });

  it("sin coincidencia, calcula los gramos con el aporte del subgrupo y lo marca como estimado", () => {
    // Cereales: 88 kcal por intercambio; 352 kcal/100 g → 25 g.
    expect(exchangeFor(food("A001", "Almidón de maíz, crudo", { energyKcal: 352 }), new Map())).toEqual({ grams: 25, measure: null, estimated: true });
    expect(exchangeFor(food("S001", "Ajiaco santafereño"), new Map())).toBeNull();
    expect(exchangeFor(food("A999", "Cereal sin energía", { energyKcal: 0 }), new Map())).toBeNull();
  });
});

describe("coincidencias confirmadas", () => {
  it("sólo usa las filas con confirmed = 1", () => {
    const csv = [
      "table,gaba_subgroup,gaba_food,grams,measure,tcac_code,tcac_name,score,confirmed",
      '26,CEREALS,"Arroz blanco, cocido",80,6 cucharadas soperas colmadas,A009,"Arroz blanco, pulido, cocido, sin sal",0.75,1',
      '26,CEREALS,"Arroz blanco, cocido",80,6 cucharadas soperas colmadas,A011,"Arroz integral, cocido, sin sal",0.67,',
    ].join("\n");
    expect([...confirmedMatches(csv)]).toEqual([["A009", { subgroup: "CEREALS", grams: 80, measure: "6 cucharadas soperas colmadas" }]]);
  });
});

describe("alérgenos", () => {
  it("por grupo y por palabra", () => {
    expect(allergensFor(food("A040", "Harina de trigo, fortificada, todo propósito, cruda"))).toEqual(["GLUTEN"]);
    expect(allergensFor(food("G012", "Leche de vaca, entera, líquida, pasteurizada"))).toEqual(["MILK"]);
    expect(allergensFor(food("J004", "Huevo de gallina, entero, crudo"))).toEqual(["EGG"]);
    expect(allergensFor(food("E045", "Tilapia o mojarra, recortes, crudos"))).toEqual(["FISH"]);
    expect(allergensFor(food("E018", "Camarón, crudo"))).toEqual(["SHELLFISH"]);
    expect(allergensFor(food("T026", "Maní, con piel, crudo"))).toEqual(["PEANUT"]);
    expect(allergensFor(food("D012", "Mantequilla de maní"))).toEqual(["PEANUT"]);
    expect(allergensFor(food("T030", "Tofu, crudo"))).toEqual(["SOY"]);
    expect(allergensFor(food("C003", "Almendra, seca"))).toEqual(["TREE_NUTS"]);
    expect(allergensFor(food("T001", "Ajonjolí o sésamo, crudo"))).toEqual(["SESAME"]);
    expect(allergensFor(food("S032", "Sancocho de bagre"))).toEqual(["FISH"]);
  });

  it("no confunde palabras parecidas", () => {
    expect(allergensFor(food("C054", "Manzana común, cruda"))).toEqual([]);
    expect(allergensFor(food("B003", "Acelga, hojas, cruda"))).toEqual([]);
    expect(allergensFor(food("F110", "Res, hígado, dorado, sin sal"))).toEqual([]);
    expect(allergensFor(food("P009", "Árbol del pan, crudo"))).toEqual([]);
    expect(allergensFor(food("T031", "Soya, tostada"))).toEqual(["SOY"]);
    expect(allergensFor(food("B032", "Cebolla, pasta escaldada"))).toEqual([]);
    expect(allergensFor(food("A067", "Pan de yuca, horneado"))).toEqual(["MILK"]);
  });

  it("todo alimento con alérgeno o preparado/manufacturado queda por revisar", () => {
    expect(needsReview(food("C003", "Almendra, seca"))).toBe(true);
    expect(needsReview(food("S001", "Ajiaco santafereño"))).toBe(true);
    expect(needsReview(food("B003", "Acelga, hojas, cruda"))).toBe(false);
  });
});

describe("ALTO EN (Res. 2492 de 2022)", () => {
  it("sólo aplica a procesados", () => {
    expect(isProcessed(food("H010", "Néctar de albaricoque, con azúcar"))).toBe(true);
    expect(isProcessed(food("C054", "Manzana común, cruda"))).toBe(false);
    expect(isProcessed(food("J006", "Huevo de gallina, entero, frito, sin sal"))).toBe(false);
    expect(isProcessed(food("B045", "Frijol verde, cocido, con sal"))).toBe(false);
    expect(isProcessed(food("S001", "Ajiaco santafereño"))).toBe(false);
    expect(highInFor(food("C054", "Manzana común, cruda", { sodium: 900, saturatedFat: 50 }))).toEqual([]);
  });

  it("sodio ≥ 300 mg/100 g o ≥ 1 mg/kcal; grasa saturada ≥ 10 % de la energía", () => {
    expect(highInFor(food("F125", "Salchicha de cerdo y res, precocida", { energyKcal: 250, sodium: 900, saturatedFat: 8 }))).toEqual(["SODIUM", "SATURATED_FAT"]);
    expect(highInFor(food("A026", "Galletas saladas, tipo cracker", { energyKcal: 420, sodium: 280, saturatedFat: 2 }))).toEqual([]);
    expect(highInFor(food("N005", "Yogurt, bebible, descremado, sin azúcar", { energyKcal: 50, sodium: 60, saturatedFat: 0.2 }))).toEqual(["SODIUM"]);
  });

  it("sin dato de sodio o grasa saturada no marca nada (sin dato no es cero)", () => {
    expect(highInFor(food("F125", "Salchicha de cerdo y res, precocida", { energyKcal: 250 }))).toEqual([]);
  });
});
