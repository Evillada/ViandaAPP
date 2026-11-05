import { describe, expect, it } from "vitest";
import { parseExchangeTables } from "@/core/catalog/gaba-parse";

// Fragmentos reales del texto del documento técnico GABA 2015 (tablas 26 y 39), con sus saltos de página.
const TABLE_26 = `Tabla 26. Listado de alimentos que representan un intercambio por grupos de alimentos 
en peso y medida casera. Grupo I/Subgrupo I.
Intercambio estandarizado
Grupo I Cereales, raíces, tubérculos y plátanos
Subgrupo I . Cereales
Peso (g) 
Alimento Medida casera
Porción
Almojábana 31 1 unidad grande
Arroz blanco, cocido 80 6 cucharadas soperas colmadas
8 cucharadas soperas colmadas o 2/3 de 
Arroz integral, cocido 81
pocillo
Crispetas - Maíz pira 27 1 1/2 pocillo
Harina de arroz blanco 25 2 cucharadas soperas colmadas
117
2 3
2
Intercambio estandarizado
Grupo I Cereales, raíces, tubérculos y plátanos
Subgrupo I . Cereales
Peso (g) 
Alimento Medida casera
Porción
Pan blanco 22 1 tajada delgada
Aporte nutricional promedio del intercambio
Grasa Fibra 
Energía Proteína Carbohidratos Calcio Hierro Zinc Vitamina A Vitamina C 
total Dietaria 
(Kcal) (g) (g) (mg) (mg) (mg) (ER) (mg)
(g) (g)
88 2,2 1,5 16,7 1,1 21,2 1,1 0,5 35,0 1,6
Fuente: Equipo Académico del CTNGA, ICBF y FAO, con base en la Lista de intercambio de alimentos  de la Universidad 
de Antioquia.
118`;

const TABLE_39 = `Tabla 39. Listado de alimentos que representan un intercambio por grupos de alimentos 
en peso y medida casera. Grupo IV/Subgrupo III.
Intercambio estandarizado
Grupo IV Carnes, huevos, leguminosas secas, frutos secos y semillas
Subgrupo III. Leguminosas secas cocidas y mezclas vegetales cocidas
Peso (g) 
Preparación Medida casera
Porción
Frijol bola roja con plátano verde* 65 1/2 cucharón 
Lenteja con guiso** 70 1/2 cucharón 
Aporte nutricional promedio del intercambio
82 4,9 1,0 13,3 3,9 27,0 1,8 0,61 6,0 2,0`;

const INDEX = `Tabla 26. Listado de alimentos que representan un intercambio por grupos de  
alimentos en peso y medida casera. Grupo I/Subgrupo I..........................117
Tabla 39. Listado de alimentos que representan un intercambio por grupos de  `;

describe("parseExchangeTables", () => {
  const tables = parseExchangeTables([INDEX, TABLE_26, TABLE_39].join("\n"));

  it("ignora el índice y lee cada tabla una vez con su grupo y subgrupo", () => {
    expect(tables.map((t) => [t.table, t.group, t.subgroup])).toEqual([
      [26, "I", "I"],
      [39, "IV", "III"],
    ]);
    expect(tables[0].subgroupName).toBe("Cereales");
  });

  it("lee alimento, gramos y medida casera, sin encabezados repetidos ni números de página", () => {
    expect(tables[0].foods.map((f) => f.name)).toEqual([
      "Almojábana",
      "Arroz blanco, cocido",
      "Arroz integral, cocido",
      "Crispetas - Maíz pira",
      "Harina de arroz blanco",
      "Pan blanco",
    ]);
    expect(tables[0].foods[1]).toEqual({ name: "Arroz blanco, cocido", grams: 80, measure: "6 cucharadas soperas colmadas" });
    expect(tables[0].foods[3].measure).toBe("1 1/2 pocillo");
  });

  it("une la medida casera partida antes y después del alimento", () => {
    expect(tables[0].foods[2]).toEqual({ name: "Arroz integral, cocido", grams: 81, measure: "8 cucharadas soperas colmadas o 2/3 de pocillo" });
  });

  it("quita las marcas de nota al pie y lee el aporte promedio del intercambio", () => {
    expect(tables[1].foods[0]).toEqual({ name: "Frijol bola roja con plátano verde", grams: 65, measure: "1/2 cucharón" });
    expect(tables[0].average).toEqual({ kcal: 88, protein: 2.2, fat: 1.5, carbs: 16.7, fiber: 1.1, calcium: 21.2, iron: 1.1, zinc: 0.5, vitaminA: 35, vitaminC: 1.6 });
    expect(tables[1].average?.zinc).toBe(0.61);
  });
});
