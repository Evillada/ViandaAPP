import { describe, expect, it } from "vitest";
import { catalogEntry, parseTcacCsv } from "@/core/catalog/catalog-entry";
import { loadCatalog } from "@/features/catalog/load";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

const CSV = [
  "code,name,tcac_group,part,moisture,energyKcal,energyKj,protein,fat,carbsTotal,carbsAvailable,fiber,ash,sodium,saturatedFat,edibleFraction,needs_review,issues,source_page",
  'A009,"Arroz blanco, pulido, cocido, sin sal",A,,68.4,130,544,2.4,0.2,28.6,28.2,0.4,0.4,1,0.1,100,false,,43',
  'C054,"Manzana común, cruda",C,,85.6,57,238,0.3,0.2,13.6,11.5,2.1,0.3,1,0,90,false,,51',
  'G012,"Leche de vaca, entera, líquida, pasteurizada",G,,88,63,264,3.1,3.4,4.8,4.8,0,0.7,44,2.1,100,false,,79',
].join("\n");
const matches = new Map([["A009", { subgroup: "CEREALS" as const, grams: 80, measure: "6 cucharadas soperas colmadas" }]]);
const entries = () => parseTcacCsv(CSV).map((row) => catalogEntry(row, matches));

async function manualFood(name: string) {
  const category = await prisma.foodCategory.upsert({ where: { slug: "cereales" }, update: {}, create: { name: "Cereales y tubérculos", slug: "cereales" } });
  return prisma.food.create({ data: { name, categoryId: category.id } });
}

describe("carga del catálogo TCAC", () => {
  it("es idempotente: dos cargas dejan tres alimentos con sus nutrientes y porciones", async () => {
    expect(await loadCatalog(entries(), prisma)).toMatchObject({ created: 3, updated: 0 });
    expect(await loadCatalog(entries(), prisma)).toMatchObject({ created: 0, updated: 3 });

    expect(await prisma.food.count({ where: { catalogSource: "TCAC_2018" } })).toBe(3);
    const arroz = await prisma.food.findUniqueOrThrow({
      where: { code: "A009" },
      include: { nutrients: { include: { nutrient: true } }, portions: true, category: true },
    });
    expect(arroz).toMatchObject({ gabaGroup: "CEREALS_TUBERS", gabaSubgroup: "CEREALS", exchangeGrams: 80, exchangeEstimated: false, searchName: "arroz blanco, pulido, cocido, sin sal" });
    expect(arroz.category.name).toBe("A. Cereales y derivados");
    expect(arroz.nutrients).toHaveLength(10);
    expect(arroz.nutrients.every((n) => n.source === "TCAC_2018")).toBe(true);
    expect(arroz.portions.filter((p) => p.isDefault)).toEqual([expect.objectContaining({ name: "1 intercambio · 6 cucharadas soperas colmadas", grams: 80 })]);
    expect(arroz.portions).toHaveLength(2);

    const leche = await prisma.food.findUniqueOrThrow({ where: { code: "G012" } });
    expect(leche).toMatchObject({ gabaGroup: "DAIRY", allergens: ["MILK"], needsReview: true, exchangeEstimated: true });
  });

  it("no toca los datos de los alimentos manuales; sólo les calcula el nombre de búsqueda", async () => {
    const manual = await manualFood("Fríjol Rojo cocido");
    await loadCatalog(entries(), prisma);
    const after = await prisma.food.findUniqueOrThrow({ where: { id: manual.id } });
    expect(after).toMatchObject({ name: "Fríjol Rojo cocido", catalogSource: "MANUAL", code: null, searchName: "frijol rojo cocido", categoryId: manual.categoryId });
  });

  it("nunca borra un alimento usado en un plan aunque desaparezca del CSV", async () => {
    await loadCatalog(entries(), prisma);
    const arroz = await prisma.food.findUniqueOrThrow({ where: { code: "A009" } });
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await prisma.mealPlan.create({
      data: {
        name: "Plan", patientId: patient.id, professionalId: pro.id,
        days: { create: { name: "Día 1", orderNum: 1, meals: { create: { type: "LUNCH", orderNum: 1, items: { create: { foodId: arroz.id, portionGrams: 80 } } } } } },
      },
    });

    await loadCatalog(entries().filter((e) => e.code !== "A009"), prisma);
    expect(await prisma.food.findUnique({ where: { code: "A009" } })).not.toBeNull();
    expect(await prisma.mealItem.count({ where: { foodId: arroz.id } })).toBe(1);
  });
});
