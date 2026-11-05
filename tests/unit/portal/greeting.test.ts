import { describe, expect, it } from "vitest";
import { buildGreeting, goalDirection, type GreetingInput } from "@/core/portal/greeting";
import { DAILY_PHRASES } from "@/core/portal/daily-phrases";

const base = (overrides: Partial<GreetingInput> = {}): GreetingInput => ({
  now: new Date("2026-11-04T13:00:00Z"), // 8:00 en Bogotá
  firstName: "María",
  userId: "u1",
  nextAppointmentAt: null,
  planActivatedAt: null,
  progress: { enabled: true, bmiCategory: null, latest: null, previous: null },
  professionalMessage: null,
  ...overrides,
});

describe("saludo", () => {
  it("saluda según la hora de Bogotá", () => {
    expect(buildGreeting(base()).salutation).toBe("Buenos días, María");
    expect(buildGreeting(base({ now: new Date("2026-11-04T19:00:00Z") })).salutation).toBe("Buenas tardes, María");
    expect(buildGreeting(base({ now: new Date("2026-11-05T01:30:00Z") })).salutation).toBe("Buenas noches, María");
  });

  it("indica el momento del día y el tipo de dato para la tarjeta", () => {
    expect(buildGreeting(base()).period).toBe("MORNING");
    expect(buildGreeting(base({ now: new Date("2026-11-04T19:00:00Z") })).period).toBe("AFTERNOON");
    expect(buildGreeting(base({ now: new Date("2026-11-05T01:30:00Z") })).period).toBe("NIGHT");
    expect(buildGreeting(base()).factKind).toBeNull();
    expect(buildGreeting(base({ planActivatedAt: new Date("2026-11-01T15:00:00Z") })).factKind).toBe("PLAN");
    expect(buildGreeting(base({ nextAppointmentAt: new Date("2026-11-06T15:00:00Z") })).factKind).toBe("APPOINTMENT");
  });

  it("prioriza la cita de los próximos 7 días", () => {
    const g = buildGreeting(base({ nextAppointmentAt: new Date("2026-11-06T15:00:00Z"), planActivatedAt: new Date("2026-11-01T15:00:00Z") }));
    expect(g.fact).toMatch(/^Tu próxima cita es el viernes 6 de noviembre/);
  });

  it("ignora citas a más de 7 días y usa los días con el plan", () => {
    const g = buildGreeting(base({ nextAppointmentAt: new Date("2026-11-20T15:00:00Z"), planActivatedAt: new Date("2026-11-01T15:00:00Z") }));
    expect(g.fact).toBe("Llevas 3 días con tu plan");
  });

  it("el día de activación dice que hoy empieza", () => {
    expect(buildGreeting(base({ planActivatedAt: new Date("2026-11-04T12:00:00Z") })).fact).toBe("Hoy empiezas tu plan");
  });

  it("celebra la cintura sólo si baja con objetivo de reducir", () => {
    const progress = { enabled: true, bmiCategory: "OVERWEIGHT", latest: { weightKg: 70, waistCm: 82 }, previous: { weightKg: 70.1, waistCm: 84 } };
    expect(buildGreeting(base({ progress })).fact).toBe("Tu cintura bajó 2 cm desde tu última valoración");
  });

  it("con objetivo de aumentar celebra subir de peso", () => {
    const progress = { enabled: true, bmiCategory: "UNDERWEIGHT", latest: { weightKg: 50.5, waistCm: null }, previous: { weightKg: 49.7, waistCm: null } };
    expect(buildGreeting(base({ progress })).fact).toBe("Subiste 0,8 kg desde tu última valoración, en la dirección de tu objetivo");
  });

  it("no celebra cambios en sentido contrario ni con mensajes de progreso apagados", () => {
    const wrongWay = { enabled: true, bmiCategory: "OBESE_I", latest: { weightKg: 90, waistCm: 100 }, previous: { weightKg: 89, waistCm: 99 } };
    expect(buildGreeting(base({ progress: wrongWay })).fact).toBeNull();
    const off = { enabled: false, bmiCategory: "OVERWEIGHT", latest: { weightKg: 70, waistCm: 80 }, previous: { weightKg: 72, waistCm: 84 } };
    expect(buildGreeting(base({ progress: off })).fact).toBeNull();
  });

  it("con IMC normal nunca celebra cambios de peso", () => {
    const progress = { enabled: true, bmiCategory: "NORMAL", latest: { weightKg: 60, waistCm: null }, previous: { weightKg: 62, waistCm: null } };
    expect(buildGreeting(base({ progress })).fact).toBeNull();
  });

  it("usa la frase del día si no hay mensaje vigente del profesional", () => {
    const g = buildGreeting(base());
    expect(DAILY_PHRASES).toContain(g.message.text);
    expect(g.message.author).toBeNull();
  });

  it("el mensaje vigente del profesional reemplaza la frase; vencido no", () => {
    const vigente = buildGreeting(base({ professionalMessage: { text: "Esta semana, agua primero", until: new Date("2026-11-10T00:00:00Z"), professionalName: "Dra. Ruiz" } }));
    expect(vigente.message).toEqual({ text: "Esta semana, agua primero", author: "Dra. Ruiz" });
    const sinFecha = buildGreeting(base({ professionalMessage: { text: "Hola", until: null, professionalName: "Dra. Ruiz" } }));
    expect(sinFecha.message.author).toBe("Dra. Ruiz");
    const vencido = buildGreeting(base({ professionalMessage: { text: "Viejo", until: new Date("2026-11-01T00:00:00Z"), professionalName: "Dra. Ruiz" } }));
    expect(vencido.message.author).toBeNull();
  });
});

describe("goalDirection", () => {
  it("deriva el objetivo del IMC", () => {
    expect(goalDirection("UNDERWEIGHT")).toBe("INCREASE");
    expect(goalDirection("NORMAL")).toBe("MAINTAIN");
    expect(goalDirection("OBESE_II")).toBe("DECREASE");
    expect(goalDirection(null)).toBe("MAINTAIN");
  });
});
