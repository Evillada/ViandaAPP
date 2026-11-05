import { describe, expect, it } from "vitest";
import { DAILY_EXCHANGES, DAILY_GROUPS, EXCHANGE_AVERAGES, GABA_SUBGROUPS, dailyExchangesFor } from "@/core/catalog/gaba";

describe("GABA: subgrupos y aporte por intercambio", () => {
  it("cubre las 20 tablas de intercambio (26–45) con aporte para cada subgrupo", () => {
    expect(GABA_SUBGROUPS.map((s) => s.table)).toEqual(Array.from({ length: 20 }, (_, i) => 26 + i));
    for (const s of GABA_SUBGROUPS) expect(EXCHANGE_AVERAGES[s.key]).toBeDefined();
  });

  it("raíces, tubérculos y plátanos cuentan como cereales; frutas y verduras se separan para el plato", () => {
    const groupOf = (key: string) => GABA_SUBGROUPS.find((s) => s.key === key)?.group;
    expect(groupOf("PLANTAINS")).toBe("CEREALS_TUBERS");
    expect(groupOf("FRUITS")).toBe("FRUITS");
    expect(groupOf("VEGETABLES")).toBe("VEGETABLES");
    expect(EXCHANGE_AVERAGES.CEREALS).toMatchObject({ kcal: 88, protein: 2.2, fat: 1.5, carbs: 16.7 });
  });
});

describe("GABA: intercambios diarios (tabla 56)", () => {
  it("está completa: 8 columnas de edad y sexo × 6 grupos", () => {
    expect(Object.keys(DAILY_EXCHANGES)).toHaveLength(8);
    for (const column of Object.values(DAILY_EXCHANGES)) expect(Object.keys(column).sort()).toEqual([...DAILY_GROUPS].sort());
  });

  it("elige la columna por edad y sexo", () => {
    expect(dailyExchangesFor(30, "MALE")?.CEREALS_TUBERS).toBe(8);
    expect(dailyExchangesFor(30, "FEMALE")?.PROTEINS).toBe(6.5);
    expect(dailyExchangesFor(15, "FEMALE")?.CEREALS_TUBERS).toBe(6);
    expect(dailyExchangesFor(8, "MALE")?.SUGARS).toBe(2);
    expect(dailyExchangesFor(70, "FEMALE")?.FATS).toBe(5);
    expect(dailyExchangesFor(1, "MALE")).toBeNull();
  });

  it("sin sexo binario sólo responde en las edades donde la tabla no distingue sexo", () => {
    expect(dailyExchangesFor(8, null)?.CEREALS_TUBERS).toBe(4);
    expect(dailyExchangesFor(65, "OTHER")?.CEREALS_TUBERS).toBe(5.5);
    expect(dailyExchangesFor(30, "OTHER")).toBeNull();
    expect(dailyExchangesFor(16, null)).toBeNull();
  });
});
