import { describe, expect, it } from "vitest";
import { cycleDayIndex, daysBetweenKeys, keyToNoonUtc, localDateKey, weekDateKeys } from "@/core/portal/plan-cycle";

describe("localDateKey", () => {
  it("usa la fecha de Bogotá, no la UTC", () => {
    expect(localDateKey(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-04");
    expect(localDateKey(new Date("2026-11-05T05:00:00Z"))).toBe("2026-11-05");
  });
});

describe("daysBetweenKeys", () => {
  it("cuenta días entre fechas, incluso cruzando mes", () => {
    expect(daysBetweenKeys("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetweenKeys("2026-11-02", "2026-11-02")).toBe(0);
    expect(daysBetweenKeys("2026-11-02", "2026-11-01")).toBe(-1);
  });
});

describe("cycleDayIndex", () => {
  const activatedAt = new Date("2026-11-02T15:00:00Z");
  it("el día de activación es el día 0", () => {
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-11-02T23:00:00Z"), dayCount: 7 })).toBe(0);
  });
  it("el ciclo se repite", () => {
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-11-09T15:00:00Z"), dayCount: 7 })).toBe(0);
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-11-04T15:00:00Z"), dayCount: 3 })).toBe(2);
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-11-05T15:00:00Z"), dayCount: 3 })).toBe(0);
  });
  it("un plan de un día siempre es el día 0", () => {
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-12-25T15:00:00Z"), dayCount: 1 })).toBe(0);
  });
  it("antes de la activación o sin días devuelve null", () => {
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-11-01T15:00:00Z"), dayCount: 7 })).toBeNull();
    expect(cycleDayIndex({ activatedAt, date: new Date("2026-11-03T15:00:00Z"), dayCount: 0 })).toBeNull();
  });
});

describe("weekDateKeys", () => {
  it("devuelve lunes a domingo de la semana de la fecha", () => {
    expect(weekDateKeys(new Date("2026-11-04T15:00:00Z"))).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
  });
  it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(weekDateKeys(new Date("2026-11-08T15:00:00Z"))[0]).toBe("2026-11-02");
  });
  it("permite desplazarse por semanas", () => {
    expect(weekDateKeys(new Date("2026-11-04T15:00:00Z"), 1)[0]).toBe("2026-11-09");
    expect(weekDateKeys(new Date("2026-11-04T15:00:00Z"), -1)[6]).toBe("2026-11-01");
  });
});

describe("keyToNoonUtc", () => {
  it("convierte la clave en un instante estable de ese día", () => {
    expect(keyToNoonUtc("2026-11-04").toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });
});
