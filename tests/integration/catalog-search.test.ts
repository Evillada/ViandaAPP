import { describe, expect, it } from "vitest";
import { searchFoods } from "@/features/catalog/search";
import { prisma } from "../support/db";

async function seed() {
  const category = await prisma.foodCategory.create({ data: { name: "A. Cereales y derivados", slug: "tcac-a" } });
  const energy = await prisma.nutrient.create({ data: { name: "Energía", unit: "kcal", category: "ENERGY" } });
  const food = (name: string, searchName: string, gabaGroup: "CEREALS_TUBERS" | "FRUITS" | null, kcal: number, grams?: number) =>
    prisma.food.create({
      data: {
        name,
        searchName,
        gabaGroup,
        categoryId: category.id,
        nutrients: { create: { nutrientId: energy.id, amountPer100g: kcal } },
        portions: grams ? { create: { name: "1 intercambio", grams, isDefault: true } } : undefined,
      },
    });
  await food("Arroz blanco, pulido, cocido, sin sal", "arroz blanco, pulido, cocido, sin sal", "CEREALS_TUBERS", 130, 80);
  await food("Harina de arroz, cruda", "harina de arroz, cruda", "CEREALS_TUBERS", 360, 25);
  await food("Fríjol rojo cocido", "frijol rojo cocido", null, 127);
  await food("Manzana común, cruda", "manzana comun, cruda", "FRUITS", 57, 112);
}

describe("buscador de alimentos", () => {
  it("encuentra por palabras en cualquier orden, sin tildes, y pone primero lo que empieza por la búsqueda", async () => {
    await seed();
    expect((await searchFoods({ query: "arroz" })).map((f) => f.name)).toEqual(["Arroz blanco, pulido, cocido, sin sal", "Harina de arroz, cruda"]);
    expect((await searchFoods({ query: "cocido arroz" })).map((f) => f.name)).toEqual(["Arroz blanco, pulido, cocido, sin sal"]);
    expect((await searchFoods({ query: "Fríjol" })).map((f) => f.name)).toEqual(["Fríjol rojo cocido"]);
  });

  it("filtra por grupo GABA, respeta el límite y devuelve porción y energía", async () => {
    await seed();
    const cereals = await searchFoods({ query: "", gabaGroup: "CEREALS_TUBERS", limit: 1 });
    expect(cereals).toHaveLength(1);
    expect(cereals[0]).toMatchObject({ gabaGroup: "CEREALS_TUBERS", portion: { name: "1 intercambio", grams: 80 }, per100g: { kcal: 130 } });
    expect(await searchFoods({ query: "arroz", gabaGroup: "FRUITS" })).toEqual([]);
  });

  it("sin búsqueda ni grupo no devuelve nada, y sin porción usa 100 g", async () => {
    await seed();
    expect(await searchFoods({ query: "   " })).toEqual([]);
    expect((await searchFoods({ query: "frijol" }))[0].portion).toEqual({ name: "100 g", grams: 100 });
  });
});
