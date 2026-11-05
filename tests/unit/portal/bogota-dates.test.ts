import { describe, expect, it } from "vitest";
import { endOfDayBogota, startOfDayBogota } from "@/core/portal/bogota-dates";

describe("bogota-dates", () => {
  it("inicio del día en Bogotá es 05:00 UTC", () => {
    expect(startOfDayBogota("2026-11-01")?.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("fin del día en Bogotá es 04:59:59.999 UTC del día siguiente", () => {
    expect(endOfDayBogota("2026-11-30")?.toISOString()).toBe("2026-12-01T04:59:59.999Z");
    expect(endOfDayBogota("2026-12-31")?.toISOString()).toBe("2027-01-01T04:59:59.999Z");
  });

  it("rechaza formatos y fechas inexistentes", () => {
    for (const bad of ["", "30/11/2026", "2026-1-1", "2026-02-31", "2026-13-01"]) {
      expect(startOfDayBogota(bad)).toBeNull();
      expect(endOfDayBogota(bad)).toBeNull();
    }
  });
});
