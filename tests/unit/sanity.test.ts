import { describe, expect, it } from "vitest";
import { calculateBmi } from "@/core/nutrition/nutrition-calculator";

describe("entorno unitario", () => {
  it("resuelve el alias @ y ejecuta core", () => {
    expect(calculateBmi(70, 170)).toBe(24.2);
  });
});
