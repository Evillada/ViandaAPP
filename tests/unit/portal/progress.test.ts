import { describe, expect, it } from "vitest";
import { PROGRESS_METRICS, availableMetrics, describeChange, formatMeasure } from "@/core/portal/progress";

describe("progreso del portal", () => {
  it("la cintura va primero y el peso no es la medida por defecto", () => {
    expect(PROGRESS_METRICS.map((m) => m.key)).toEqual(["waistCm", "weightKg", "bmi", "bodyFatPercent"]);
  });

  it("formatea con coma decimal y máximo un decimal", () => {
    expect(formatMeasure(82.25)).toBe("82,3");
    expect(formatMeasure(80)).toBe("80");
  });

  it("describe el cambio sin juicio", () => {
    expect(describeChange(82, 85, "cm")).toBe("3 cm menos que la valoración anterior");
    expect(describeChange(73.7, 73.2, "kg")).toBe("0,5 kg más que la valoración anterior");
    expect(describeChange(80.04, 80, "cm")).toBe("Igual que la valoración anterior");
  });

  it("sin valor actual o anterior no hay cambio que describir", () => {
    expect(describeChange(null, 80, "cm")).toBeNull();
    expect(describeChange(80, null, "cm")).toBeNull();
  });

  it("sólo ofrece medidas con al menos un valor, en orden", () => {
    const points = [
      { waistCm: null, weightKg: 70, bmi: 25.7, bodyFatPercent: null },
      { waistCm: null, weightKg: 69, bmi: 25.3, bodyFatPercent: null },
    ];
    expect(availableMetrics(points).map((m) => m.key)).toEqual(["weightKg", "bmi"]);
  });
});
