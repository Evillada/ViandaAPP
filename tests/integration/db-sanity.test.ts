import { describe, expect, it } from "vitest";
import { prisma } from "../support/db";

describe("entorno de integración", () => {
  it("usa el esquema test", async () => {
    const [row] = await prisma.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
    expect(row?.schema).toBe("test");
  });
});
