import { describe, expect, it } from "vitest";
import { loadFoodsForGenerator } from "@/features/nutrition/generator-foods";
import { prisma } from "../support/db";

describe("alimentos del generador actual", () => {
  it("sólo usa los alimentos MANUAL hasta que llegue el generador nuevo", async () => {
    const category = await prisma.foodCategory.create({ data: { name: "Cereales y tubérculos", slug: "cereales" } });
    await prisma.food.create({ data: { name: "Arroz manual", categoryId: category.id } });
    await prisma.food.create({ data: { name: "Arroz TCAC", code: "A009", catalogSource: "TCAC_2018", categoryId: category.id } });

    expect((await loadFoodsForGenerator()).map((f) => f.name)).toEqual(["Arroz manual"]);
  });
});
