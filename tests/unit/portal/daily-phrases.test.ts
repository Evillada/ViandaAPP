import { describe, expect, it } from "vitest";
import { DAILY_PHRASES, FORBIDDEN_PHRASE_TERMS, phraseOfTheDay } from "@/core/portal/daily-phrases";

describe("frases del día", () => {
  it("hay al menos 60 frases sin repetir", () => {
    expect(DAILY_PHRASES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(DAILY_PHRASES).size).toBe(DAILY_PHRASES.length);
  });

  it("ninguna frase menciona peso, dieta, cuerpo ni promete resultados", () => {
    for (const phrase of DAILY_PHRASES) {
      const lower = phrase.toLowerCase();
      for (const term of FORBIDDEN_PHRASE_TERMS) expect(lower, phrase).not.toContain(term);
    }
  });

  it("es la misma durante el día y cambia entre días o pacientes", () => {
    expect(phraseOfTheDay("2026-11-04", "u1")).toBe(phraseOfTheDay("2026-11-04", "u1"));
    const days = new Set(["01", "02", "03", "04", "05", "06", "07"].map((d) => phraseOfTheDay(`2026-11-${d}`, "u1")));
    expect(days.size).toBeGreaterThan(1);
    const users = new Set(["a", "b", "c", "d", "e"].map((u) => phraseOfTheDay("2026-11-04", u)));
    expect(users.size).toBeGreaterThan(1);
  });
});
