# Portal del paciente — Entrega 1 (Hoy, Plan y Citas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el paciente vea al entrar un saludo motivador, qué comer hoy, su plan alimentario (semana con fechas reales y plan completo) y sus citas; y que el profesional pueda armar planes de varios días, escribir indicaciones para el paciente y dejarle un mensaje personal.

**Architecture:** Lógica pura y testeable en `src/core/portal/` (ciclo del plan, saludo, frases). Lecturas del portal en módulos no-"use server" de `src/features/portal/` con `select` explícito (nunca `notes`), expuestas sólo a través de server actions que exigen actor PATIENT y verifican `canViewPatientRecord`. Páginas server components bajo `src/app/(portal)/portal/`.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 6 + Postgres (Supabase), NextAuth v5, Tailwind, lucide-react, Vitest (unit + integration con esquema `test`), Playwright (E2E móvil).

**Spec:** `docs/superpowers/specs/2026-11-04-portal-paciente-design.md` (§3.1, §3.2, §3.3, §4, §5 parcial, §7 parcial, §8, §9).

## Global Constraints

- Siempre `pnpm`; prohibido `npm`/`npx`.
- Antes de cualquier comando Prisma o de pruebas: `unset DATABASE_URL DIRECT_URL`.
- Nunca imprimir ni commitear valores de `.env`. Nunca `git add -A`; nunca commitear `.claude/` ni `.superpowers/`.
- Mobile-first: diseñar y verificar primero a 390×844; targets táctiles ≥ 44 px (`min-h-11`); iconos lucide; **sin emojis** en la UI nueva.
- Zona horaria del portal: `America/Bogota`.
- Los campos `notes`, `anthropometryNotes` y `DietaryRecall.notes` **nunca** se seleccionan en código del portal. Sólo planes con `status: "ACTIVE"`.
- Toda función exportada de un archivo `"use server"` exige actor (guardián `tests/unit/guardian/actions-require-actor.test.ts`). Las páginas no importan prisma.
- Cambios de esquema: sólo agregados. Aplicar con `pnpm exec prisma db push` (nunca `--force-reset`, nunca `--accept-data-loss`).
- Frases del saludo: hábitos/autocuidado; prohibido mencionar peso, kilos, dieta, cuerpo, ni prometer resultados.

---

### Task 1: Esquema — campos del portal

**Files:**
- Modify: `prisma/schema.prisma` (modelos `MealPlan`, `Patient`)

**Interfaces:**
- Produces: `MealPlan.activatedAt: DateTime?`, `MealPlan.patientInstructions: String?`, `Patient.portalMessage: String?`, `Patient.portalMessageUntil: DateTime?`, `Patient.progressMessagesEnabled: Boolean @default(true)`.

- [ ] **Step 1: Editar `prisma/schema.prisma`**

En `model MealPlan`, después de `version Int @default(1)`:

```prisma
  activatedAt         DateTime?
  patientInstructions String?
```

En `model Patient`, después de `status PatientStatus @default(ACTIVE)`:

```prisma
  portalMessage           String?
  portalMessageUntil      DateTime?
  progressMessagesEnabled Boolean   @default(true)
```

- [ ] **Step 2: Aplicar al esquema `test` y regenerar el cliente**

```bash
unset DATABASE_URL DIRECT_URL
pnpm exec prisma generate
pnpm test:int
```

Expected: el global setup recrea el esquema `test` con las columnas nuevas; todas las pruebas de integración pasan (59).

- [ ] **Step 3: Aplicar al esquema `public` (columnas nuevas, sin pérdida de datos)**

```bash
unset DATABASE_URL DIRECT_URL
pnpm exec prisma db push --skip-generate
```

Expected: "Your database is now in sync with your Prisma schema." Si Prisma advierte pérdida de datos, **detenerse y reportar BLOCKED** (no debe ocurrir: sólo se agregan columnas nulas o con default).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): campos del portal (activación e indicaciones del plan, mensaje del profesional)"
```

---

### Task 2: Ciclo del plan y semana (lógica pura)

**Files:**
- Create: `src/core/portal/plan-cycle.ts`
- Test: `tests/unit/portal/plan-cycle.test.ts`

**Interfaces:**
- Produces:
  - `PORTAL_TIME_ZONE = "America/Bogota"`
  - `localDateKey(date: Date, timeZone?: string): string` → `"YYYY-MM-DD"`
  - `daysBetweenKeys(fromKey: string, toKey: string): number`
  - `cycleDayIndex(input: { activatedAt: Date; date: Date; dayCount: number }): number | null`
  - `weekDateKeys(date: Date, weekOffset?: number): string[]` (7 claves, lunes→domingo)
  - `keyToNoonUtc(key: string): Date`

- [ ] **Step 1: Escribir la prueba**

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test:unit -- tests/unit/portal/plan-cycle.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/core/portal/plan-cycle.ts`**

```ts
export const PORTAL_TIME_ZONE = "America/Bogota";

const DAY_MS = 86_400_000;

export function localDateKey(date: Date, timeZone: string = PORTAL_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function keyToUtcMidnight(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcMidnight(toKey) - keyToUtcMidnight(fromKey)) / DAY_MS);
}

export function cycleDayIndex(input: { activatedAt: Date; date: Date; dayCount: number }): number | null {
  if (input.dayCount < 1) return null;
  const diff = daysBetweenKeys(localDateKey(input.activatedAt), localDateKey(input.date));
  if (diff < 0) return null;
  return diff % input.dayCount;
}

export function keyToNoonUtc(key: string): Date {
  return new Date(keyToUtcMidnight(key) + DAY_MS / 2);
}

export function weekDateKeys(date: Date, weekOffset = 0): string[] {
  const base = keyToUtcMidnight(localDateKey(date));
  const weekday = new Date(base).getUTCDay(); // 0 = domingo
  const monday = base - ((weekday + 6) % 7) * DAY_MS + weekOffset * 7 * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * DAY_MS).toISOString().slice(0, 10));
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test:unit -- tests/unit/portal/plan-cycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/portal/plan-cycle.ts tests/unit/portal/plan-cycle.test.ts
git commit -m "feat(portal): ciclo del plan y semana en zona horaria de Bogotá"
```

---

### Task 3: Saludo de entrada y frases del día (lógica pura)

**Files:**
- Create: `src/core/portal/daily-phrases.ts`
- Create: `src/core/portal/greeting.ts`
- Test: `tests/unit/portal/daily-phrases.test.ts`, `tests/unit/portal/greeting.test.ts`

**Interfaces:**
- Consumes: `localDateKey`, `daysBetweenKeys`, `PORTAL_TIME_ZONE` (Task 2).
- Produces:
  - `DAILY_PHRASES: readonly string[]`, `FORBIDDEN_PHRASE_TERMS: readonly string[]`, `phraseOfTheDay(dateKey: string, userId: string): string`
  - `type GoalDirection = "DECREASE" | "INCREASE" | "MAINTAIN"`, `goalDirection(bmiCategory: string | null): GoalDirection`
  - `interface MeasurementPoint { weightKg: number; waistCm: number | null }`
  - `interface GreetingInput { now: Date; firstName: string; userId: string; nextAppointmentAt: Date | null; planActivatedAt: Date | null; progress: { enabled: boolean; bmiCategory: string | null; latest: MeasurementPoint | null; previous: MeasurementPoint | null }; professionalMessage: { text: string; until: Date | null; professionalName: string } | null }`
  - `interface Greeting { salutation: string; fact: string | null; message: { text: string; author: string | null } }`
  - `buildGreeting(input: GreetingInput): Greeting`

- [ ] **Step 1: Escribir `tests/unit/portal/daily-phrases.test.ts`**

```ts
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
```

- [ ] **Step 2: Escribir `tests/unit/portal/greeting.test.ts`**

```ts
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
```

- [ ] **Step 3: Ejecutar y verificar que fallan**

Run: `pnpm test:unit -- tests/unit/portal`
Expected: FAIL (módulos no existen).

- [ ] **Step 4: Implementar `src/core/portal/daily-phrases.ts`**

```ts
/** Frases curadas: hábitos, constancia y autocuidado. Nunca peso, dieta, cuerpo ni promesas de resultados. */
export const DAILY_PHRASES = [
  "Cada comida es una nueva oportunidad para cuidarte.",
  "La constancia vale más que la perfección.",
  "Un vaso de agua al despertar es un buen comienzo.",
  "Escucha a tu cuerpo: come con calma y sin distracciones.",
  "Hoy basta con dar un paso pequeño en la dirección correcta.",
  "Preparar tus comidas con anticipación es un regalo para tu yo de mañana.",
  "Comer despacio te ayuda a disfrutar y a reconocer cuándo es suficiente.",
  "Agrega un color más a tu plato hoy.",
  "Dormir bien también es parte de alimentarte bien.",
  "No necesitas hacerlo perfecto, sólo seguir intentándolo.",
  "Tu bienestar se construye con decisiones sencillas repetidas cada día.",
  "Elige alimentos que te den energía para lo que quieres hacer hoy.",
  "Moverte un poco más hoy cuenta, aunque sea una caminata corta.",
  "Si un día no salió como esperabas, la siguiente comida es un nuevo comienzo.",
  "Ten a la mano fruta lavada: lo fácil se vuelve hábito.",
  "Hidratarte es una forma simple de cuidarte durante todo el día.",
  "Celebra lo que sí lograste esta semana.",
  "Comer en compañía también nutre.",
  "Planear tus compras te ayuda a elegir mejor.",
  "La paciencia contigo es parte del proceso.",
  "Hoy puedes probar una receta nueva y sencilla.",
  "Tu plan es una guía para acompañarte, no una obligación rígida.",
  "Respira hondo antes de comer y date un momento para ti.",
  "Las verduras en el almuerzo son una gran aliada de tu energía.",
  "Cuidarte hoy es invertir en cómo te sentirás mañana.",
  "Un desayuno tranquilo prepara un mejor día.",
  "Escribe una cosa por la que te sientas agradecido hoy.",
  "Pequeños cambios sostenidos hacen grandes diferencias.",
  "Pide ayuda cuando la necesites: no estás solo en esto.",
  "Tu esfuerzo de hoy merece reconocimiento.",
  "Lleva una botella de agua contigo y ve sumando sorbos.",
  "Cocinar en casa te permite conocer mejor lo que comes.",
  "Disfruta los sabores: comer también es placer.",
  "Cada día es una oportunidad para practicar un buen hábito.",
  "Organiza tu semana pensando en tus comidas principales.",
  "Prioriza el descanso: tu cuerpo lo agradece.",
  "Las legumbres son una gran opción para variar tus comidas.",
  "Hoy elige una merienda que te haga sentir bien.",
  "Un paseo después de comer te ayuda a sentirte más ligero.",
  "Lo importante es la dirección, no la velocidad.",
  "Tu historia con la comida es tuya; trátala con amabilidad.",
  "Revisa tu plan de hoy y prepárate para cumplirlo con calma.",
  "La variedad en tu plato es variedad de nutrientes.",
  "Haz una pausa activa: estírate unos minutos.",
  "Prepara tu almuerzo de mañana esta noche.",
  "Reconoce tus señales de hambre y saciedad.",
  "Elegir agua en lugar de bebidas azucaradas es un gran hábito.",
  "Cada hábito nuevo empieza con una primera vez.",
  "Comparte con tu profesional cómo te has sentido esta semana.",
  "La fruta entera es una merienda práctica y deliciosa.",
  "Sonríe: cuidarte también es disfrutar el camino.",
  "Hoy puedes elegir con intención, sin culpa.",
  "Mantener horarios regulares de comida ayuda a tu energía.",
  "Agradece a tu cuerpo todo lo que hace por ti cada día.",
  "Un buen hábito repetido se vuelve parte de ti.",
  "Las especias y hierbas dan sabor y alegría a tus comidas.",
  "Escoge una meta pequeña para hoy y cúmplela.",
  "Tu constancia de hoy es la base de tu bienestar.",
  "Sal a tomar un poco de sol y aire fresco.",
  "Cuidarte es un acto de cariño contigo.",
  "Haz de tus comidas un momento tranquilo.",
  "Recuerda: avanzar un poco cada día también es avanzar.",
] as const;

/** Términos prohibidos (minúsculas). Un test verifica que ninguna frase los contiene. */
export const FORBIDDEN_PHRASE_TERMS = [
  "peso", "kilo", " kg", "dieta", "adelgaz", "gord", "flac", "cuerpo ideal", "bajar de", "quemar", "garantiz", "resultado",
] as const;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function phraseOfTheDay(dateKey: string, userId: string): string {
  return DAILY_PHRASES[hash(`${dateKey}:${userId}`) % DAILY_PHRASES.length]!;
}
```

- [ ] **Step 5: Implementar `src/core/portal/greeting.ts`**

```ts
import { phraseOfTheDay } from "./daily-phrases";
import { PORTAL_TIME_ZONE, daysBetweenKeys, localDateKey } from "./plan-cycle";

export type GoalDirection = "DECREASE" | "INCREASE" | "MAINTAIN";

export interface MeasurementPoint {
  weightKg: number;
  waistCm: number | null;
}

export interface GreetingInput {
  now: Date;
  firstName: string;
  userId: string;
  nextAppointmentAt: Date | null;
  planActivatedAt: Date | null;
  progress: { enabled: boolean; bmiCategory: string | null; latest: MeasurementPoint | null; previous: MeasurementPoint | null };
  professionalMessage: { text: string; until: Date | null; professionalName: string } | null;
}

export interface Greeting {
  salutation: string;
  fact: string | null;
  message: { text: string; author: string | null };
}

const WEIGHT_STEP_KG = 0.3;
const WAIST_STEP_CM = 0.5;

export function goalDirection(bmiCategory: string | null): GoalDirection {
  if (bmiCategory === "UNDERWEIGHT") return "INCREASE";
  if (bmiCategory && ["OVERWEIGHT", "OBESE_I", "OBESE_II", "OBESE_III"].includes(bmiCategory)) return "DECREASE";
  return "MAINTAIN";
}

function hourInBogota(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: PORTAL_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now));
}

function salutation(now: Date, firstName: string): string {
  const hour = hourInBogota(now);
  const part = hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 19 ? "Buenas tardes" : "Buenas noches";
  return `${part}, ${firstName}`;
}

const formatNumber = (value: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value);

function appointmentFact(now: Date, at: Date | null): string | null {
  if (!at) return null;
  const days = daysBetweenKeys(localDateKey(now), localDateKey(at));
  if (days < 0 || days > 7) return null;
  const label = new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(at);
  const time = new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(at);
  return `Tu próxima cita es el ${label.replace(",", "")} a las ${time}`;
}

function planFact(now: Date, activatedAt: Date | null): string | null {
  if (!activatedAt) return null;
  const days = daysBetweenKeys(localDateKey(activatedAt), localDateKey(now));
  if (days < 0) return null;
  return days === 0 ? "Hoy empiezas tu plan" : `Llevas ${days} días con tu plan`;
}

function progressFact(progress: GreetingInput["progress"]): string | null {
  const { enabled, latest, previous, bmiCategory } = progress;
  if (!enabled || !latest || !previous) return null;
  const direction = goalDirection(bmiCategory);
  if (direction !== "INCREASE" && latest.waistCm !== null && previous.waistCm !== null) {
    const drop = previous.waistCm - latest.waistCm;
    if (drop >= WAIST_STEP_CM) return `Tu cintura bajó ${formatNumber(drop)} cm desde tu última valoración`;
  }
  const delta = latest.weightKg - previous.weightKg;
  if (direction === "DECREASE" && -delta >= WEIGHT_STEP_KG) {
    return `Bajaste ${formatNumber(-delta)} kg desde tu última valoración, en la dirección de tu objetivo`;
  }
  if (direction === "INCREASE" && delta >= WEIGHT_STEP_KG) {
    return `Subiste ${formatNumber(delta)} kg desde tu última valoración, en la dirección de tu objetivo`;
  }
  return null;
}

export function buildGreeting(input: GreetingInput): Greeting {
  const fact =
    appointmentFact(input.now, input.nextAppointmentAt) ?? planFact(input.now, input.planActivatedAt) ?? progressFact(input.progress);
  const pm = input.professionalMessage;
  const message =
    pm && pm.text.trim() && (pm.until === null || pm.until.getTime() >= input.now.getTime())
      ? { text: pm.text.trim(), author: pm.professionalName }
      : { text: phraseOfTheDay(localDateKey(input.now), input.userId), author: null };
  return { salutation: salutation(input.now, input.firstName), fact, message };
}
```

Nota: el formato de Intl `es-CO` para `weekday: "long", day: "numeric", month: "long"` produce `"viernes, 6 de noviembre"`; el `replace(",", "")` lo deja como `"viernes 6 de noviembre"`. Si la prueba de la cita falla por formato de hora (`10:00 a. m.` con espacio duro), ajustar sólo la aserción a `toMatch(/^Tu próxima cita es el viernes 6 de noviembre/)` (ya es así).

- [ ] **Step 6: Ejecutar y verificar que pasan**

Run: `pnpm test:unit -- tests/unit/portal`
Expected: PASS (todas).

- [ ] **Step 7: Commit**

```bash
git add src/core/portal/daily-phrases.ts src/core/portal/greeting.ts tests/unit/portal/daily-phrases.test.ts tests/unit/portal/greeting.test.ts
git commit -m "feat(portal): saludo de entrada con dato real y frase del día curada"
```

---

### Task 4: Lecturas del portal (datos del paciente)

**Files:**
- Create: `src/features/portal/portal-data.ts`
- Test: `tests/integration/portal-data.test.ts`

**Interfaces:**
- Consumes: `computePlanTotals` (`src/features/nutrition/plan-totals.ts`), `calculateItemNutrients` (`src/core/nutrition/nutrition-calculator.ts`), `NutritionTotals`.
- Produces (todas reciben ids ya autorizados; la autorización la hace Task 6):
  - `interface PortalRecord { patientId: string; firstName: string; professionalName: string; portalMessage: string | null; portalMessageUntil: Date | null; progressMessagesEnabled: boolean }`
  - `getPortalRecords(userId: string): Promise<PortalRecord[]>` — fichas vinculadas al usuario **con autorización vigente**, la de consentimiento más reciente primero.
  - `pickRecord(records: PortalRecord[], requested?: string | null): PortalRecord | null`
  - `interface PortalItem { id: string; foodName: string; grams: number; kcal: number }`
  - `interface PortalMeal { id: string; type: string; items: PortalItem[] }`
  - `interface PortalDay { id: string; name: string; meals: PortalMeal[]; totals: NutritionTotals }`
  - `interface PortalPlan { id: string; name: string; patientInstructions: string | null; activatedAt: Date; goal: { targetKcal: number; proteinG: number; carbsG: number; fatG: number } | null; days: PortalDay[] }`
  - `getActivePlan(patientId: string): Promise<PortalPlan | null>` — plan `ACTIVE` más reciente (por `activatedAt`, luego `updatedAt`).
  - `interface PortalAppointment { id: string; date: Date; duration: number; reason: string | null; status: "SCHEDULED" | "COMPLETED" | "CANCELLED" }`
  - `getAppointments(patientId: string, now: Date): Promise<{ upcoming: PortalAppointment[]; past: PortalAppointment[] }>`
  - `getProgressSnapshot(patientId: string): Promise<{ bmiCategory: string | null; latest: MeasurementPoint | null; previous: MeasurementPoint | null }>`

- [ ] **Step 1: Escribir `tests/integration/portal-data.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { getActivePlan, getAppointments, getPortalRecords, getProgressSnapshot, pickRecord } from "@/features/portal/portal-data";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T15:00:00Z");

async function linked(name = "Dra. Ruiz") {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id, firstName: "María" });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  return { pro, account, patient };
}

async function foodId() {
  const category = await prisma.foodCategory.upsert({ where: { slug: "t-cat" }, update: {}, create: { name: "T cat", slug: "t-cat" } });
  const energy = await prisma.nutrient.upsert({ where: { name: "Energía" }, update: {}, create: { name: "Energía", unit: "kcal", category: "ENERGY" } });
  const food = await prisma.food.create({ data: { name: "Arroz T", categoryId: category.id, nutrients: { create: { nutrientId: energy.id, amountPer100g: 130 } } } });
  return food.id;
}

describe("lecturas del portal", () => {
  it("sólo lista fichas propias con autorización vigente", async () => {
    const { account, patient } = await linked();
    const other = await linked("Otro");
    await prisma.patientConsent.updateMany({ where: { patientId: other.patient.id }, data: { revokedAt: now } });
    const records = await getPortalRecords(account.id);
    expect(records.map((r) => r.patientId)).toEqual([patient.id]);
    expect(records[0]).toMatchObject({ firstName: "María", professionalName: "Dra. Ruiz", progressMessagesEnabled: true });
    expect(await getPortalRecords(other.account.id)).toEqual([]);
  });

  it("pickRecord respeta el pedido sólo si está en la lista", async () => {
    const { account, patient } = await linked();
    const records = await getPortalRecords(account.id);
    expect(pickRecord(records, patient.id)?.patientId).toBe(patient.id);
    expect(pickRecord(records, "ajeno")?.patientId).toBe(patient.id);
    expect(pickRecord([], null)).toBeNull();
  });

  it("devuelve sólo el plan activo, con totales por día y sin notas", async () => {
    const { pro, patient } = await linked();
    const food = await foodId();
    await prisma.mealPlan.create({ data: { name: "Borrador", patientId: patient.id, professionalId: pro.id, status: "DRAFT", notes: "privado" } });
    await prisma.mealPlan.create({
      data: {
        name: "Plan activo", patientId: patient.id, professionalId: pro.id, status: "ACTIVE", notes: "nota interna",
        activatedAt: new Date("2026-11-02T15:00:00Z"), patientInstructions: "Toma agua",
        days: {
          create: [
            { name: "Día 1", orderNum: 1, meals: { create: { type: "LUNCH", orderNum: 1, items: { create: { foodId: food, portionGrams: 200, quantity: 1 } } } } },
            { name: "Día 2", orderNum: 2, meals: { create: { type: "DINNER", orderNum: 1 } } },
          ],
        },
      },
    });
    const plan = await getActivePlan(patient.id);
    expect(plan?.name).toBe("Plan activo");
    expect(plan?.patientInstructions).toBe("Toma agua");
    expect(plan?.days.map((d) => d.name)).toEqual(["Día 1", "Día 2"]);
    expect(plan?.days[0]?.totals.energyKcal).toBe(260);
    expect(plan?.days[0]?.meals[0]?.items[0]).toMatchObject({ foodName: "Arroz T", grams: 200, kcal: 260 });
    expect(JSON.stringify(plan)).not.toContain("nota interna");
  });

  it("sin plan activo devuelve null", async () => {
    const { patient } = await linked();
    expect(await getActivePlan(patient.id)).toBeNull();
  });

  it("separa citas próximas e historial", async () => {
    const { pro, patient } = await linked();
    await prisma.appointment.createMany({
      data: [
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-11-06T15:00:00Z"), status: "SCHEDULED" },
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-11-10T15:00:00Z"), status: "SCHEDULED" },
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-10-01T15:00:00Z"), status: "COMPLETED" },
        { patientId: patient.id, professionalId: pro.id, date: new Date("2026-11-08T15:00:00Z"), status: "CANCELLED" },
      ],
    });
    const { upcoming, past } = await getAppointments(patient.id, now);
    expect(upcoming.map((a) => a.date.toISOString())).toEqual(["2026-11-06T15:00:00.000Z", "2026-11-10T15:00:00.000Z"]);
    expect(past.map((a) => a.status)).toEqual(["CANCELLED", "COMPLETED"]);
  });

  it("el resumen de progreso compara las dos últimas valoraciones", async () => {
    const { pro, patient } = await linked();
    for (const [date, weightKg, waistCm] of [["2026-09-01", 80, 95], ["2026-10-01", 78, 92]] as const) {
      await prisma.assessment.create({
        data: {
          patientId: patient.id, professionalId: pro.id, reason: "control", assessmentDate: new Date(date),
          anthropometry: { create: { weightKg, heightCm: 165, waistCm } },
          nutritionalGoal: { create: { bmi: 29, bmiCategory: "OVERWEIGHT", tmbKcal: 1500, targetKcal: 1800, proteinG: 100, carbsG: 200, fatG: 60 } },
        },
      });
    }
    expect(await getProgressSnapshot(patient.id)).toEqual({
      bmiCategory: "OVERWEIGHT",
      latest: { weightKg: 78, waistCm: 92 },
      previous: { weightKg: 80, waistCm: 95 },
    });
  });
});
```


- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `unset DATABASE_URL DIRECT_URL; pnpm test:int -- tests/integration/portal-data.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/features/portal/portal-data.ts`**

```ts
import { calculateItemNutrients, type NutritionTotals } from "@/core/nutrition/nutrition-calculator";
import type { MeasurementPoint } from "@/core/portal/greeting";
import { prisma } from "@/infrastructure/database/prisma";
import { computePlanTotals } from "@/features/nutrition/plan-totals";

export interface PortalRecord {
  patientId: string;
  firstName: string;
  professionalName: string;
  portalMessage: string | null;
  portalMessageUntil: Date | null;
  progressMessagesEnabled: boolean;
}

export interface PortalItem { id: string; foodName: string; grams: number; kcal: number }
export interface PortalMeal { id: string; type: string; items: PortalItem[] }
export interface PortalDay { id: string; name: string; meals: PortalMeal[]; totals: NutritionTotals }
export interface PortalPlan {
  id: string;
  name: string;
  patientInstructions: string | null;
  activatedAt: Date;
  goal: { targetKcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  days: PortalDay[];
}
export interface PortalAppointment {
  id: string;
  date: Date;
  duration: number;
  reason: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export async function getPortalRecords(userId: string): Promise<PortalRecord[]> {
  const records = await prisma.patient.findMany({
    where: { userId, consents: { some: { userId, revokedAt: null } } },
    select: {
      id: true,
      firstName: true,
      portalMessage: true,
      portalMessageUntil: true,
      progressMessagesEnabled: true,
      professional: { select: { name: true } },
      consents: { where: { userId, revokedAt: null }, orderBy: { grantedAt: "desc" }, take: 1, select: { grantedAt: true } },
    },
  });
  return records
    .sort((a, b) => (b.consents[0]?.grantedAt.getTime() ?? 0) - (a.consents[0]?.grantedAt.getTime() ?? 0))
    .map((r) => ({
      patientId: r.id,
      firstName: r.firstName,
      professionalName: r.professional.name ?? "Tu nutricionista",
      portalMessage: r.portalMessage,
      portalMessageUntil: r.portalMessageUntil,
      progressMessagesEnabled: r.progressMessagesEnabled,
    }));
}

export function pickRecord(records: PortalRecord[], requested?: string | null): PortalRecord | null {
  return records.find((r) => r.patientId === requested) ?? records[0] ?? null;
}

const itemSelect = {
  id: true,
  portionGrams: true,
  quantity: true,
  food: { select: { name: true, nutrients: { select: { amountPer100g: true, nutrient: { select: { name: true, unit: true } } } } } },
} as const;

export async function getActivePlan(patientId: string): Promise<PortalPlan | null> {
  const plan = await prisma.mealPlan.findFirst({
    where: { patientId, status: "ACTIVE" },
    orderBy: [{ activatedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      patientInstructions: true,
      activatedAt: true,
      updatedAt: true,
      assessment: { select: { nutritionalGoal: { select: { targetKcal: true, proteinG: true, carbsG: true, fatG: true } } } },
      days: {
        orderBy: { orderNum: "asc" },
        select: {
          id: true,
          name: true,
          meals: { orderBy: { orderNum: "asc" }, select: { id: true, type: true, items: { select: itemSelect } } },
        },
      },
    },
  });
  if (!plan) return null;

  const days: PortalDay[] = plan.days.map((day) => {
    const allItems = day.meals.flatMap((m) => m.items);
    return {
      id: day.id,
      name: day.name,
      totals: computePlanTotals(allItems),
      meals: day.meals.map((meal) => ({
        id: meal.id,
        type: meal.type,
        items: meal.items.map((item) => ({
          id: item.id,
          foodName: item.food.name,
          grams: Math.round(item.portionGrams * item.quantity),
          kcal: Math.round(
            calculateItemNutrients(
              item.food.nutrients.map((n) => ({ nutrientName: n.nutrient.name, unit: n.nutrient.unit, amountPer100g: n.amountPer100g })),
              item.portionGrams,
              item.quantity
            ).energyKcal
          ),
        })),
      })),
    };
  });

  return {
    id: plan.id,
    name: plan.name,
    patientInstructions: plan.patientInstructions,
    activatedAt: plan.activatedAt ?? plan.updatedAt,
    goal: plan.assessment?.nutritionalGoal ?? null,
    days,
  };
}

export async function getAppointments(patientId: string, now: Date): Promise<{ upcoming: PortalAppointment[]; past: PortalAppointment[] }> {
  const select = { id: true, date: true, duration: true, reason: true, status: true } as const;
  const [upcoming, past] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId, status: "SCHEDULED", date: { gte: now } }, orderBy: { date: "asc" }, select }),
    prisma.appointment.findMany({
      where: { patientId, OR: [{ date: { lt: now } }, { status: { not: "SCHEDULED" } }] },
      orderBy: { date: "desc" },
      take: 30,
      select,
    }),
  ]);
  return { upcoming, past };
}

export async function getProgressSnapshot(
  patientId: string
): Promise<{ bmiCategory: string | null; latest: MeasurementPoint | null; previous: MeasurementPoint | null }> {
  const assessments = await prisma.assessment.findMany({
    where: { patientId, anthropometry: { isNot: null } },
    orderBy: { assessmentDate: "desc" },
    take: 2,
    select: {
      anthropometry: { select: { weightKg: true, waistCm: true } },
      nutritionalGoal: { select: { bmiCategory: true } },
    },
  });
  const point = (a: (typeof assessments)[number] | undefined): MeasurementPoint | null =>
    a?.anthropometry ? { weightKg: a.anthropometry.weightKg, waistCm: a.anthropometry.waistCm } : null;
  return {
    bmiCategory: assessments[0]?.nutritionalGoal?.bmiCategory ?? null,
    latest: point(assessments[0]),
    previous: point(assessments[1]),
  };
}
```

Nota: en el caso de prueba de citas, la cancelada del 8-nov es futura pero `CANCELLED`, por eso va al historial; el orden del historial es por fecha descendente (8-nov antes que 1-oct).

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `unset DATABASE_URL DIRECT_URL; pnpm test:int -- tests/integration/portal-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/portal/portal-data.ts tests/integration/portal-data.test.ts
git commit -m "feat(portal): lecturas del paciente (fichas vigentes, plan activo, citas, progreso) sin notas internas"
```

---

### Task 5: Profesional — planes de varios días, indicaciones y fecha de activación

**Files:**
- Create: `src/features/nutrition/plan-days.ts`
- Modify: `src/features/nutrition/actions.ts` (wrappers + `activateMealPlan` fija `activatedAt`)
- Modify: `src/app/(dashboard)/dashboard/meal-plans/[id]/page.tsx` (pestañas de días, totales del día, indicaciones)
- Create: `src/features/nutrition/components/plan-day-tabs.tsx`
- Create: `src/features/nutrition/components/plan-instructions-form.tsx`
- Test: `tests/integration/plan-days.test.ts`

**Interfaces:**
- Produces:
  - `MAX_PLAN_DAYS = 7`
  - `type PlanDayResult = { ok: true; dayId?: string } | { ok: false; error: string }`
  - `addPlanDay(actor: Actor, mealPlanId: string): Promise<PlanDayResult>`
  - `duplicatePlanDay(actor: Actor, mealPlanId: string, dayId: string): Promise<PlanDayResult>`
  - `renamePlanDay(actor: Actor, mealPlanId: string, dayId: string, name: string): Promise<PlanDayResult>`
  - `deletePlanDay(actor: Actor, mealPlanId: string, dayId: string): Promise<PlanDayResult>`
  - `updatePlanInstructions(actor: Actor, mealPlanId: string, text: string): Promise<PlanDayResult>`
  - Server actions (en `actions.ts`): `addPlanDayForm(formData)`, `duplicatePlanDayForm(formData)`, `renamePlanDayForm(formData)`, `deletePlanDayForm(formData)`, `updatePlanInstructionsForm(formData)` — todas `Promise<void>`, leen `mealPlanId`, `dayId`, `name`, `patientInstructions`.

- [ ] **Step 1: Escribir `tests/integration/plan-days.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { MAX_PLAN_DAYS, addPlanDay, deletePlanDay, duplicatePlanDay, renamePlanDay, updatePlanInstructions } from "@/features/nutrition/plan-days";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

async function planWithItem() {
  const pro = await createProfessional();
  const patient = await createPatientRecord(pro.id);
  const category = await prisma.foodCategory.upsert({ where: { slug: "pd-cat" }, update: {}, create: { name: "PD cat", slug: "pd-cat" } });
  const food = await prisma.food.create({ data: { name: "Avena PD", categoryId: category.id } });
  const plan = await prisma.mealPlan.create({
    data: {
      name: "Plan", patientId: patient.id, professionalId: pro.id,
      days: { create: { name: "Día 1", orderNum: 1, meals: { create: { type: "BREAKFAST", orderNum: 1, items: { create: { foodId: food.id, portionGrams: 40, quantity: 1 } } } } } },
    },
    include: { days: true },
  });
  return { pro, plan, dayId: plan.days[0]!.id };
}

describe("días del plan", () => {
  it("agrega un día vacío con las tres comidas base y nombre consecutivo", async () => {
    const { pro, plan } = await planWithItem();
    const result = await addPlanDay(proActor(pro.id), plan.id);
    expect(result.ok).toBe(true);
    const days = await prisma.mealPlanDay.findMany({ where: { mealPlanId: plan.id }, orderBy: { orderNum: "asc" }, include: { meals: true } });
    expect(days.map((d) => d.name)).toEqual(["Día 1", "Día 2"]);
    expect(days[1]!.meals.map((m) => m.type).sort()).toEqual(["BREAKFAST", "DINNER", "LUNCH"]);
  });

  it("duplica un día copiando comidas e ítems", async () => {
    const { pro, plan, dayId } = await planWithItem();
    const result = await duplicatePlanDay(proActor(pro.id), plan.id, dayId);
    expect(result.ok).toBe(true);
    const copy = await prisma.mealPlanDay.findFirstOrThrow({ where: { mealPlanId: plan.id, orderNum: 2 }, include: { meals: { include: { items: true } } } });
    expect(copy.name).toBe("Día 1 (copia)");
    expect(copy.meals[0]!.items[0]!.portionGrams).toBe(40);
  });

  it(`no permite más de ${MAX_PLAN_DAYS} días`, async () => {
    const { pro, plan } = await planWithItem();
    for (let i = 1; i < MAX_PLAN_DAYS; i++) expect((await addPlanDay(proActor(pro.id), plan.id)).ok).toBe(true);
    expect(await addPlanDay(proActor(pro.id), plan.id)).toEqual({ ok: false, error: `Un plan puede tener máximo ${MAX_PLAN_DAYS} días` });
  });

  it("renombra y no deja eliminar el último día", async () => {
    const { pro, plan, dayId } = await planWithItem();
    expect((await renamePlanDay(proActor(pro.id), plan.id, dayId, "  Lunes  ")).ok).toBe(true);
    expect((await prisma.mealPlanDay.findUniqueOrThrow({ where: { id: dayId } })).name).toBe("Lunes");
    expect(await renamePlanDay(proActor(pro.id), plan.id, dayId, "   ")).toEqual({ ok: false, error: "El nombre no puede estar vacío" });
    expect(await deletePlanDay(proActor(pro.id), plan.id, dayId)).toEqual({ ok: false, error: "El plan debe tener al menos un día" });
  });

  it("elimina un día cuando hay más de uno", async () => {
    const { pro, plan, dayId } = await planWithItem();
    await addPlanDay(proActor(pro.id), plan.id);
    expect((await deletePlanDay(proActor(pro.id), plan.id, dayId)).ok).toBe(true);
    expect(await prisma.mealPlanDay.count({ where: { mealPlanId: plan.id } })).toBe(1);
  });

  it("guarda indicaciones para el paciente (recortadas, vacío = null, máx 2000)", async () => {
    const { pro, plan } = await planWithItem();
    expect((await updatePlanInstructions(proActor(pro.id), plan.id, "  Toma agua  ")).ok).toBe(true);
    expect((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).patientInstructions).toBe("Toma agua");
    await updatePlanInstructions(proActor(pro.id), plan.id, "   ");
    expect((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).patientInstructions).toBeNull();
    expect(await updatePlanInstructions(proActor(pro.id), plan.id, "x".repeat(2001))).toEqual({ ok: false, error: "Máximo 2000 caracteres" });
  });

  it("otro profesional no puede tocar el plan", async () => {
    const { plan, dayId } = await planWithItem();
    const intruder = await createProfessional();
    const denied = { ok: false, error: "Plan no encontrado" };
    expect(await addPlanDay(proActor(intruder.id), plan.id)).toEqual(denied);
    expect(await duplicatePlanDay(proActor(intruder.id), plan.id, dayId)).toEqual(denied);
    expect(await renamePlanDay(proActor(intruder.id), plan.id, dayId, "X")).toEqual(denied);
    expect(await updatePlanInstructions(proActor(intruder.id), plan.id, "X")).toEqual(denied);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `unset DATABASE_URL DIRECT_URL; pnpm test:int -- tests/integration/plan-days.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/features/nutrition/plan-days.ts`**

```ts
import type { Actor } from "@/core/access/types";
import { prisma } from "@/infrastructure/database/prisma";

export const MAX_PLAN_DAYS = 7;
const MAX_INSTRUCTIONS = 2000;

export type PlanDayResult = { ok: true; dayId?: string } | { ok: false; error: string };

const NOT_FOUND: PlanDayResult = { ok: false, error: "Plan no encontrado" };
const BASE_MEALS = [
  { type: "BREAKFAST" as const, orderNum: 1 },
  { type: "LUNCH" as const, orderNum: 2 },
  { type: "DINNER" as const, orderNum: 3 },
];

async function ownedPlan(actor: Actor, mealPlanId: string) {
  if (actor.activeArea !== "PROFESSIONAL") return null;
  return prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
    select: { id: true, days: { orderBy: { orderNum: "asc" }, select: { id: true, orderNum: true } } },
  });
}

export async function addPlanDay(actor: Actor, mealPlanId: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  if (plan.days.length >= MAX_PLAN_DAYS) return { ok: false, error: `Un plan puede tener máximo ${MAX_PLAN_DAYS} días` };
  const orderNum = (plan.days.at(-1)?.orderNum ?? 0) + 1;
  const day = await prisma.mealPlanDay.create({
    data: { mealPlanId, name: `Día ${plan.days.length + 1}`, orderNum, meals: { create: BASE_MEALS } },
    select: { id: true },
  });
  return { ok: true, dayId: day.id };
}

export async function duplicatePlanDay(actor: Actor, mealPlanId: string, dayId: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  if (plan.days.length >= MAX_PLAN_DAYS) return { ok: false, error: `Un plan puede tener máximo ${MAX_PLAN_DAYS} días` };
  const source = await prisma.mealPlanDay.findFirst({
    where: { id: dayId, mealPlanId },
    select: { name: true, meals: { select: { type: true, name: true, orderNum: true, items: { select: { foodId: true, portionGrams: true, quantity: true, notes: true } } } } },
  });
  if (!source) return { ok: false, error: "Día no encontrado" };
  const orderNum = (plan.days.at(-1)?.orderNum ?? 0) + 1;
  const day = await prisma.mealPlanDay.create({
    data: {
      mealPlanId,
      name: `${source.name} (copia)`.slice(0, 60),
      orderNum,
      meals: {
        create: source.meals.map((meal) => ({
          type: meal.type,
          name: meal.name,
          orderNum: meal.orderNum,
          items: { create: meal.items.map((item) => ({ foodId: item.foodId, portionGrams: item.portionGrams, quantity: item.quantity, notes: item.notes })) },
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, dayId: day.id };
}

export async function renamePlanDay(actor: Actor, mealPlanId: string, dayId: string, name: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return { ok: false, error: "El nombre no puede estar vacío" };
  const updated = await prisma.mealPlanDay.updateMany({ where: { id: dayId, mealPlanId }, data: { name: trimmed } });
  return updated.count === 1 ? { ok: true, dayId } : { ok: false, error: "Día no encontrado" };
}

export async function deletePlanDay(actor: Actor, mealPlanId: string, dayId: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  if (plan.days.length <= 1) return { ok: false, error: "El plan debe tener al menos un día" };
  const removed = await prisma.mealPlanDay.deleteMany({ where: { id: dayId, mealPlanId } });
  return removed.count === 1 ? { ok: true } : { ok: false, error: "Día no encontrado" };
}

export async function updatePlanInstructions(actor: Actor, mealPlanId: string, text: string): Promise<PlanDayResult> {
  const plan = await ownedPlan(actor, mealPlanId);
  if (!plan) return NOT_FOUND;
  const trimmed = text.trim();
  if (trimmed.length > MAX_INSTRUCTIONS) return { ok: false, error: `Máximo ${MAX_INSTRUCTIONS} caracteres` };
  await prisma.mealPlan.updateMany({
    where: { id: mealPlanId, professionalId: actor.userId },
    data: { patientInstructions: trimmed || null },
  });
  return { ok: true };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `unset DATABASE_URL DIRECT_URL; pnpm test:int -- tests/integration/plan-days.test.ts`
Expected: PASS.

- [ ] **Step 5: Server actions en `src/features/nutrition/actions.ts`**

Agregar el import:

```ts
import { addPlanDay, deletePlanDay, duplicatePlanDay, renamePlanDay, updatePlanInstructions } from "./plan-days";
```

Agregar al final del archivo:

```ts
async function runPlanChange(
  formData: FormData,
  change: string,
  run: (actor: NonNullable<Awaited<ReturnType<typeof getActorFor>>>, mealPlanId: string) => Promise<{ ok: boolean; error?: string; dayId?: string }>
): Promise<void> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) throw new Error("No autorizado");
  const mealPlanId = String(formData.get("mealPlanId") ?? "");
  const result = await run(actor, mealPlanId);
  if (!result.ok) throw new Error(result.error ?? "No se pudo guardar");
  const plan = await prisma.mealPlan.findFirst({ where: { id: mealPlanId, professionalId: actor.userId }, select: { patientId: true } });
  if (plan) await auditMealPlan(actor.userId, mealPlanId, plan.patientId, change);
  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  if (result.dayId) redirect(`/dashboard/meal-plans/${mealPlanId}?day=${result.dayId}`);
}

export async function addPlanDayForm(formData: FormData): Promise<void> {
  await runPlanChange(formData, "day_added", (a, id) => addPlanDay(a, id));
}

export async function duplicatePlanDayForm(formData: FormData): Promise<void> {
  const dayId = String(formData.get("dayId") ?? "");
  await runPlanChange(formData, "day_duplicated", (a, id) => duplicatePlanDay(a, id, dayId));
}

export async function renamePlanDayForm(formData: FormData): Promise<void> {
  const dayId = String(formData.get("dayId") ?? "");
  const name = String(formData.get("name") ?? "");
  await runPlanChange(formData, "day_renamed", (a, id) => renamePlanDay(a, id, dayId, name));
}

export async function deletePlanDayForm(formData: FormData): Promise<void> {
  const dayId = String(formData.get("dayId") ?? "");
  await runPlanChange(formData, "day_deleted", (a, id) => deletePlanDay(a, id, dayId));
}

export async function updatePlanInstructionsForm(formData: FormData): Promise<void> {
  const text = String(formData.get("patientInstructions") ?? "");
  await runPlanChange(formData, "instructions_updated", (a, id) => updatePlanInstructions(a, id, text));
}
```

(El guardián acepta estos exports porque delegan en `runPlanChange`, del mismo archivo, que obtiene el actor antes de tocar prisma.)

En `activateMealPlan`, cambiar `data: { status: "ACTIVE" }` por:

```ts
    data: { status: "ACTIVE", activatedAt: new Date() },
```

- [ ] **Step 6: Componente `src/features/nutrition/components/plan-day-tabs.tsx`**

```tsx
import Link from "next/link";
import { Copy, Plus, Trash2 } from "lucide-react";
import { addPlanDayForm, deletePlanDayForm, duplicatePlanDayForm, renamePlanDayForm } from "../actions";
import { MAX_PLAN_DAYS } from "../plan-days";
import { cn } from "@/shared/lib/utils";

interface Props {
  mealPlanId: string;
  days: { id: string; name: string }[];
  selectedDayId: string;
}

export function PlanDayTabs({ mealPlanId, days, selectedDayId }: Props) {
  const selected = days.find((d) => d.id === selectedDayId) ?? days[0];
  const full = days.length >= MAX_PLAN_DAYS;

  return (
    <div className="space-y-3">
      <nav aria-label="Días del plan" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((day) => (
          <Link
            key={day.id}
            href={`/dashboard/meal-plans/${mealPlanId}?day=${day.id}`}
            aria-current={day.id === selected?.id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium",
              day.id === selected?.id ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-text"
            )}
          >
            {day.name}
          </Link>
        ))}
        <form action={addPlanDayForm}>
          <input type="hidden" name="mealPlanId" value={mealPlanId} />
          <button
            type="submit"
            disabled={full}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-dashed border-border px-4 text-sm text-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Agregar día
          </button>
        </form>
      </nav>

      {selected && (
        <div className="flex flex-wrap items-end gap-2">
          <form action={renamePlanDayForm} className="flex flex-1 items-end gap-2 min-w-[220px]">
            <input type="hidden" name="mealPlanId" value={mealPlanId} />
            <input type="hidden" name="dayId" value={selected.id} />
            <label className="flex-1 text-sm">
              <span className="block text-muted mb-1">Nombre del día</span>
              <input
                name="name"
                defaultValue={selected.name}
                maxLength={60}
                className="w-full min-h-11 rounded-xl border border-border bg-surface px-3"
              />
            </label>
            <button type="submit" className="min-h-11 rounded-xl border border-border px-4 text-sm">Renombrar</button>
          </form>
          <form action={duplicatePlanDayForm}>
            <input type="hidden" name="mealPlanId" value={mealPlanId} />
            <input type="hidden" name="dayId" value={selected.id} />
            <button type="submit" disabled={full} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-border px-4 text-sm disabled:opacity-50">
              <Copy className="h-4 w-4" aria-hidden="true" /> Duplicar
            </button>
          </form>
          <form action={deletePlanDayForm}>
            <input type="hidden" name="mealPlanId" value={mealPlanId} />
            <input type="hidden" name="dayId" value={selected.id} />
            <button
              type="submit"
              disabled={days.length <= 1}
              aria-label={`Eliminar ${selected.name}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border text-danger disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Componente `src/features/nutrition/components/plan-instructions-form.tsx`**

```tsx
import { updatePlanInstructionsForm } from "../actions";

export function PlanInstructionsForm({ mealPlanId, value }: { mealPlanId: string; value: string | null }) {
  return (
    <form action={updatePlanInstructionsForm} className="space-y-2">
      <input type="hidden" name="mealPlanId" value={mealPlanId} />
      <label htmlFor="patientInstructions" className="block text-sm font-medium text-text">
        Indicaciones para el paciente
      </label>
      <p className="text-xs text-muted">Las verá en su portal. Las notas internas del plan nunca se muestran.</p>
      <textarea
        id="patientInstructions"
        name="patientInstructions"
        defaultValue={value ?? ""}
        maxLength={2000}
        rows={4}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
      />
      <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-white">
        Guardar indicaciones
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Página del plan — `src/app/(dashboard)/dashboard/meal-plans/[id]/page.tsx`**

Cambios:
1. Firma: `export default async function MealPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> })` y `const { day } = await searchParams;`.
2. Día seleccionado y totales **del día** (no de todo el plan):

```tsx
  const selectedDay = plan.days.find((d) => d.id === day) ?? plan.days[0];
  const totals = computePlanTotals(selectedDay?.meals.flatMap((m) => m.items) ?? []);
```

(eliminar la línea `const allItems = ...` y el `computePlanTotals(allItems)` anterior).
3. Importar `PlanDayTabs` y `PlanInstructionsForm`. Reemplazar la `Card` "Comidas del día" por:

```tsx
      <Card>
        <h3 className="font-semibold text-text mb-4">Días del plan</h3>
        <PlanDayTabs mealPlanId={id} days={plan.days.map((d) => ({ id: d.id, name: d.name }))} selectedDayId={selectedDay?.id ?? ""} />
        <div className="mt-6">
          <MealPlanEditor key={selectedDay?.id} mealPlanId={id} meals={selectedDay?.meals ?? []} foods={foods} />
        </div>
      </Card>

      <Card>
        <PlanInstructionsForm mealPlanId={id} value={plan.patientInstructions} />
      </Card>
```

4. Reemplazar el emoji del botón regenerar: `🔄 Regenerar automático` → `<RefreshCw className="h-4 w-4" aria-hidden="true" /> Regenerar automático` (importar `RefreshCw` de `lucide-react`).
5. El título de las métricas indica que son del día: encima del grid agregar `<p className="text-sm text-muted">Totales de {selectedDay?.name ?? "el día"} frente a la meta diaria</p>`.

- [ ] **Step 9: Verificar**

```bash
unset DATABASE_URL DIRECT_URL
pnpm exec tsc --noEmit
pnpm lint
pnpm test:unit
pnpm test:int -- tests/integration/plan-days.test.ts tests/integration/clinical-isolation.test.ts
```

Expected: tsc sin errores; lint 0 errores; unit pasa (incluido el guardián); integración pasa.

- [ ] **Step 10: Commit**

```bash
git add src/features/nutrition/plan-days.ts src/features/nutrition/actions.ts src/features/nutrition/components/plan-day-tabs.tsx src/features/nutrition/components/plan-instructions-form.tsx "src/app/(dashboard)/dashboard/meal-plans/[id]/page.tsx" tests/integration/plan-days.test.ts
git commit -m "feat(nutrition): planes de varios días, indicaciones para el paciente y fecha de activación"
```

---

### Task 6: Server actions del portal y configuración del portal en la ficha

**Files:**
- Create: `src/features/portal/portal-view.ts`
- Modify: `src/features/portal/actions.ts`
- Create: `src/features/patients/portal-settings.ts`
- Modify: `src/features/patients/actions.ts` (action `updatePortalSettingsAction`)
- Create: `src/features/patients/components/portal-settings-panel.tsx`
- Modify: `src/app/(dashboard)/dashboard/patients/[id]/page.tsx` (panel debajo de `InvitePatientPanel`; seleccionar los 3 campos nuevos en `getPatient` si usa `select`)
- Test: `tests/integration/portal-view.test.ts`, `tests/integration/portal-settings.test.ts`

**Interfaces:**
- Consumes: Task 2, 3, 4.
- Produces:
  - `interface PortalContext { records: { patientId: string; professionalName: string }[]; current: PortalRecord }`
  - `loadPortalContext(actor: Actor, requested: string | null): Promise<PortalContext | null>` — usa `getPortalRecords` + `pickRecord` y verifica `canViewPatientRecord(actor, { professionalId: "-", userId: actor.userId, consentActive: true })` sólo sobre fichas devueltas (ya filtradas por vínculo y consentimiento).
  - `interface PortalHome { context: PortalContext; greeting: Greeting; today: { dateKey: string; day: PortalDay | null; planName: string | null; instructions: string | null; goalKcal: number | null }; nextAppointment: PortalAppointment | null }`
  - `buildPortalHome(actor: Actor, requested: string | null, now: Date, firstName: string): Promise<PortalHome | null>`
  - `interface PortalWeek { context: PortalContext; plan: PortalPlan | null; todayKey: string; week: { dateKey: string; dayIndex: number | null }[]; weekOffset: number }`
  - `buildPortalWeek(actor: Actor, requested: string | null, now: Date, weekOffset: number): Promise<PortalWeek | null>`
  - Server actions (en `src/features/portal/actions.ts`): `getPortalHomeAction(requested?: string | null)`, `getPortalPlanAction(requested?: string | null, weekOffset?: number)`, `getPortalAppointmentsAction(requested?: string | null)` → `{ context, upcoming, past } | null`.
  - `updatePortalSettings(actor: Actor, patientId: string, input: { message: string; until: string; progressEnabled: boolean }, ip: string | null): Promise<{ ok: true } | { ok: false; error: string }>`
  - `updatePortalSettingsAction(patientId: string, formData: FormData): Promise<{ error?: string }>`

- [ ] **Step 1: Escribir `tests/integration/portal-view.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { buildPortalHome, buildPortalWeek, loadPortalContext } from "@/features/portal/portal-view";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T13:00:00Z");
const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function linkedWithPlan() {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id, firstName: "María" });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  await prisma.mealPlan.create({
    data: {
      name: "Plan", patientId: patient.id, professionalId: pro.id, status: "ACTIVE", activatedAt: new Date("2026-11-02T15:00:00Z"),
      days: { create: [{ name: "Día 1", orderNum: 1 }, { name: "Día 2", orderNum: 2 }] },
    },
  });
  return { pro, account, patient };
}

describe("vista del portal", () => {
  it("sin fichas vigentes no hay contexto", async () => {
    const account = await createPatientUser();
    expect(await loadPortalContext(patientActor(account.id), null)).toBeNull();
  });

  it("un actor que no es paciente no obtiene contexto", async () => {
    const { account } = await linkedWithPlan();
    const asPro: Actor = { userId: account.id, roles: ["PATIENT"], activeArea: "PROFESSIONAL", professionalStatus: null };
    expect(await loadPortalContext(asPro, null)).toBeNull();
  });

  it("no permite ver la ficha de otro paciente aunque se pida su id", async () => {
    const mine = await linkedWithPlan();
    const other = await linkedWithPlan();
    const ctx = await loadPortalContext(patientActor(mine.account.id), other.patient.id);
    expect(ctx?.current.patientId).toBe(mine.patient.id);
  });

  it("el inicio calcula el día del ciclo de hoy y el saludo", async () => {
    const { account } = await linkedWithPlan();
    const home = await buildPortalHome(patientActor(account.id), null, now, "María");
    expect(home?.greeting.salutation).toBe("Buenos días, María");
    expect(home?.today.day?.name).toBe("Día 1"); // 2-nov día 0, 3-nov día 1, 4-nov día 0 (ciclo de 2)
    expect(home?.greeting.fact).toBe("Llevas 2 días con tu plan");
  });

  it("la semana asigna días del ciclo y null antes de la activación", async () => {
    const { account } = await linkedWithPlan();
    const week = await buildPortalWeek(patientActor(account.id), null, now, 0);
    expect(week?.week.map((d) => d.dayIndex)).toEqual([0, 1, 0, 1, 0, 1, 0]);
    const previous = await buildPortalWeek(patientActor(account.id), null, now, -1);
    expect(previous?.week.every((d) => d.dayIndex === null)).toBe(true);
    expect(week?.todayKey).toBe("2026-11-04");
  });
});
```

- [ ] **Step 2: Escribir `tests/integration/portal-settings.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { updatePortalSettings } from "@/features/patients/portal-settings";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

describe("configuración del portal en la ficha", () => {
  it("guarda mensaje, vigencia e interruptor de progreso, y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    expect(await updatePortalSettings(proActor(pro.id), patient.id, { message: "  Agua primero  ", until: "2026-11-30", progressEnabled: false }, null)).toEqual({ ok: true });
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.portalMessage).toBe("Agua primero");
    expect(after.portalMessageUntil?.toISOString()).toBe("2026-12-01T04:59:59.999Z"); // fin del 30-nov en Bogotá
    expect(after.progressMessagesEnabled).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "PATIENT_UPDATED", patientId: patient.id } })).toBe(1);
  });

  it("mensaje vacío borra el mensaje y la vigencia", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await updatePortalSettings(proActor(pro.id), patient.id, { message: "Hola", until: "", progressEnabled: true }, null);
    await updatePortalSettings(proActor(pro.id), patient.id, { message: "  ", until: "2026-11-30", progressEnabled: true }, null);
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.portalMessage).toBeNull();
    expect(after.portalMessageUntil).toBeNull();
  });

  it("valida longitud y fecha, y bloquea a otro profesional", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    expect(await updatePortalSettings(proActor(pro.id), patient.id, { message: "x".repeat(281), until: "", progressEnabled: true }, null)).toEqual({ ok: false, error: "El mensaje admite máximo 280 caracteres" });
    expect(await updatePortalSettings(proActor(pro.id), patient.id, { message: "Hola", until: "30/11/2026", progressEnabled: true }, null)).toEqual({ ok: false, error: "Fecha de vigencia inválida" });
    const intruder = await createProfessional();
    expect(await updatePortalSettings(proActor(intruder.id), patient.id, { message: "Hola", until: "", progressEnabled: true }, null)).toEqual({ ok: false, error: "Paciente no encontrado" });
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que fallan**

Run: `unset DATABASE_URL DIRECT_URL; pnpm test:int -- tests/integration/portal-view.test.ts tests/integration/portal-settings.test.ts`
Expected: FAIL (módulos no existen).

- [ ] **Step 4: Implementar `src/features/portal/portal-view.ts`**

```ts
import { canViewPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { buildGreeting, type Greeting } from "@/core/portal/greeting";
import { cycleDayIndex, localDateKey, weekDateKeys, keyToNoonUtc } from "@/core/portal/plan-cycle";
import {
  getActivePlan,
  getAppointments,
  getPortalRecords,
  getProgressSnapshot,
  pickRecord,
  type PortalAppointment,
  type PortalDay,
  type PortalPlan,
  type PortalRecord,
} from "./portal-data";

export interface PortalContext {
  records: { patientId: string; professionalName: string }[];
  current: PortalRecord;
}

export interface PortalHome {
  context: PortalContext;
  greeting: Greeting;
  today: { dateKey: string; day: PortalDay | null; planName: string | null; instructions: string | null; goalKcal: number | null };
  nextAppointment: PortalAppointment | null;
}

export interface PortalWeek {
  context: PortalContext;
  plan: PortalPlan | null;
  todayKey: string;
  week: { dateKey: string; dayIndex: number | null }[];
  weekOffset: number;
}

export async function loadPortalContext(actor: Actor, requested: string | null): Promise<PortalContext | null> {
  if (actor.activeArea !== "PATIENT") return null;
  const records = await getPortalRecords(actor.userId);
  const current = pickRecord(records, requested);
  if (!current) return null;
  // getPortalRecords ya filtra por vínculo y consentimiento vigente; la política lo confirma explícitamente.
  if (!canViewPatientRecord(actor, { professionalId: "", userId: actor.userId, consentActive: true })) return null;
  return { records: records.map((r) => ({ patientId: r.patientId, professionalName: r.professionalName })), current };
}

export async function buildPortalHome(actor: Actor, requested: string | null, now: Date, firstName: string): Promise<PortalHome | null> {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const patientId = context.current.patientId;
  const [plan, appointments, progress] = await Promise.all([
    getActivePlan(patientId),
    getAppointments(patientId, now),
    getProgressSnapshot(patientId),
  ]);
  const index = plan ? cycleDayIndex({ activatedAt: plan.activatedAt, date: now, dayCount: plan.days.length }) : null;
  const nextAppointment = appointments.upcoming[0] ?? null;
  const greeting = buildGreeting({
    now,
    firstName: firstName || context.current.firstName,
    userId: actor.userId,
    nextAppointmentAt: nextAppointment?.date ?? null,
    planActivatedAt: plan?.activatedAt ?? null,
    progress: { enabled: context.current.progressMessagesEnabled, ...progress },
    professionalMessage: context.current.portalMessage
      ? { text: context.current.portalMessage, until: context.current.portalMessageUntil, professionalName: context.current.professionalName }
      : null,
  });
  return {
    context,
    greeting,
    today: {
      dateKey: localDateKey(now),
      day: index === null ? null : plan!.days[index] ?? null,
      planName: plan?.name ?? null,
      instructions: plan?.patientInstructions ?? null,
      goalKcal: plan?.goal?.targetKcal ?? null,
    },
    nextAppointment,
  };
}

export async function buildPortalWeek(actor: Actor, requested: string | null, now: Date, weekOffset: number): Promise<PortalWeek | null> {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const plan = await getActivePlan(context.current.patientId);
  const offset = Math.max(-12, Math.min(12, Math.trunc(weekOffset) || 0));
  const week = weekDateKeys(now, offset).map((dateKey) => ({
    dateKey,
    dayIndex: plan ? cycleDayIndex({ activatedAt: plan.activatedAt, date: keyToNoonUtc(dateKey), dayCount: plan.days.length }) : null,
  }));
  return { context, plan, todayKey: localDateKey(now), week, weekOffset: offset };
}

export async function buildPortalAppointments(actor: Actor, requested: string | null, now: Date) {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const { upcoming, past } = await getAppointments(context.current.patientId, now);
  return { context, upcoming, past };
}
```

Nota sobre `keyToNoonUtc`: el mediodía UTC es 7:00 en Bogotá del mismo día, así que `localDateKey(keyToNoonUtc(k)) === k`.

- [ ] **Step 5: Server actions en `src/features/portal/actions.ts`**

Agregar imports y funciones (conservar las existentes):

```ts
import { auth } from "@/infrastructure/auth/auth";
import { buildPortalAppointments, buildPortalHome, buildPortalWeek } from "./portal-view";
```

```ts
export async function getPortalHomeAction(requested: string | null = null) {
  const actor = await requireActorFor("PATIENT");
  const session = await auth();
  const firstName = (session?.user?.name ?? "").trim().split(/\s+/)[0] ?? "";
  return buildPortalHome(actor, requested, new Date(), firstName);
}

export async function getPortalPlanAction(requested: string | null = null, weekOffset = 0) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalWeek(actor, requested, new Date(), weekOffset);
}

export async function getPortalAppointmentsAction(requested: string | null = null) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalAppointments(actor, requested, new Date());
}
```

En `revokeConsentAction`, además de `revalidatePath("/portal")`, agregar `revalidatePath("/portal/cuenta");`.

- [ ] **Step 6: Implementar `src/features/patients/portal-settings.ts`**

```ts
import { canEditPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

const MAX_MESSAGE = 280;

/** "YYYY-MM-DD" → último milisegundo de ese día en Bogotá (UTC-5, sin horario de verano). */
function endOfDayBogota(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + 1, 4, 59, 59, 999));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function updatePortalSettings(
  actor: Actor,
  patientId: string,
  input: { message: string; until: string; progressEnabled: boolean },
  ip: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { professionalId: true, userId: true } });
  if (!patient || !canEditPatientRecord(actor, { ...patient, consentActive: false })) return { ok: false, error: "Paciente no encontrado" };

  const message = input.message.trim();
  if (message.length > MAX_MESSAGE) return { ok: false, error: `El mensaje admite máximo ${MAX_MESSAGE} caracteres` };
  let until: Date | null = null;
  if (message && input.until.trim()) {
    until = endOfDayBogota(input.until.trim());
    if (!until) return { ok: false, error: "Fecha de vigencia inválida" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: { portalMessage: message || null, portalMessageUntil: message ? until : null, progressMessagesEnabled: input.progressEnabled },
    });
    await recordAudit(
      { actorId: actor.userId, actorRole: "PROFESSIONAL", action: "PATIENT_UPDATED", entityType: "Patient", entityId: patientId, patientId, metadata: { change: "portal_settings" }, ip },
      tx
    );
  });
  return { ok: true };
}
```

Antes de implementar, confirmar la firma real de `recordAudit` en `src/infrastructure/audit/audit-logger.ts` (entrada + `tx`); si difiere, adaptar la llamada sin cambiar el comportamiento.

- [ ] **Step 7: Action en `src/features/patients/actions.ts`**

```ts
import { updatePortalSettings } from "./portal-settings";
```

```ts
export async function updatePortalSettingsAction(patientId: string, formData: FormData): Promise<{ error?: string }> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await updatePortalSettings(
    actor,
    patientId,
    {
      message: String(formData.get("portalMessage") ?? ""),
      until: String(formData.get("portalMessageUntil") ?? ""),
      progressEnabled: formData.get("progressMessagesEnabled") === "on",
    },
    ip
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/dashboard/patients/${patientId}`);
  return {};
}
```

(Importar `getRequestMeta` y `revalidatePath` si el archivo aún no los importa.)

- [ ] **Step 8: Componente `src/features/patients/components/portal-settings-panel.tsx`**

```tsx
"use client";

import { MessageCircleHeart } from "lucide-react";
import { useState, useTransition } from "react";
import { updatePortalSettingsAction } from "../actions";

interface Props {
  patientId: string;
  message: string | null;
  until: string | null; // "YYYY-MM-DD" (Bogotá) o null
  progressEnabled: boolean;
}

export function PortalSettingsPanel({ patientId, message, until, progressEnabled }: Props) {
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setStatus(null);
    startTransition(async () => {
      const result = await updatePortalSettingsAction(patientId, formData);
      setStatus(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: "Guardado" });
    });
  }

  return (
    <form action={submit} className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircleHeart className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-text">Mensaje en el portal</h3>
      </div>
      <label className="block text-sm">
        <span className="block font-medium text-text mb-1">Mensaje personal (opcional)</span>
        <textarea name="portalMessage" defaultValue={message ?? ""} maxLength={280} rows={3} className="w-full rounded-xl border border-border px-3 py-2" />
        <span className="text-xs text-muted">Reemplaza la frase del día mientras esté vigente.</span>
      </label>
      <label className="block text-sm">
        <span className="block font-medium text-text mb-1">Vigente hasta (opcional)</span>
        <input type="date" name="portalMessageUntil" defaultValue={until ?? ""} className="min-h-11 rounded-xl border border-border px-3" />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="progressMessagesEnabled" defaultChecked={progressEnabled} className="h-5 w-5 accent-primary" />
        Mostrar mensajes de progreso en el saludo
      </label>
      {status && (
        <p role="status" className={status.kind === "error" ? "text-sm text-danger" : "text-sm text-primary"}>{status.text}</p>
      )}
      <button type="submit" disabled={isPending} className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60">
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 9: Ficha del paciente**

En `src/app/(dashboard)/dashboard/patients/[id]/page.tsx`, debajo de `<InvitePatientPanel ... />`:

```tsx
        <PortalSettingsPanel
          patientId={patient.id}
          message={patient.portalMessage}
          until={patient.portalMessageUntil ? localDateKey(patient.portalMessageUntil) : null}
          progressEnabled={patient.progressMessagesEnabled}
        />
```

Importar `PortalSettingsPanel` y `localDateKey` (`@/core/portal/plan-cycle`). Si `getPatient` usa `select` explícito, agregar `portalMessage`, `portalMessageUntil` y `progressMessagesEnabled`.

- [ ] **Step 10: Verificar y commit**

```bash
unset DATABASE_URL DIRECT_URL
pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit
pnpm test:int -- tests/integration/portal-view.test.ts tests/integration/portal-settings.test.ts tests/integration/revoke-consent.test.ts
git add src/features/portal/portal-view.ts src/features/portal/actions.ts src/features/patients/portal-settings.ts src/features/patients/actions.ts src/features/patients/components/portal-settings-panel.tsx "src/app/(dashboard)/dashboard/patients/[id]/page.tsx" tests/integration/portal-view.test.ts tests/integration/portal-settings.test.ts
git commit -m "feat(portal): vistas autorizadas del paciente y mensaje personal configurable por el profesional"
```

---

### Task 7: Navegación del portal y pantalla Hoy

**Files:**
- Modify: `src/features/identity/navigation.ts` (íconos y `PATIENT_NAV`)
- Modify: `src/shared/ui/navigation/app-shell.tsx` (íconos nuevos; prop opcional `accountLinks`)
- Modify: `src/app/(portal)/portal/layout.tsx` (pasa `accountLinks`)
- Create: `src/app/(portal)/portal/cuenta/page.tsx` (contenido actual de "Mis profesionales")
- Modify: `src/app/(portal)/portal/page.tsx` (pantalla Hoy)
- Create: `src/features/portal/components/greeting-card.tsx`, `day-menu.tsx`, `record-switcher.tsx`, `portal-empty.tsx`
- Modify: `src/shared/lib/labels.ts` (agregar `PORTAL_MEAL_LABELS` con "Onces" para `AFTERNOON_SNACK`)

**Interfaces:**
- Consumes: `getPortalHomeAction` (Task 6), `PortalDay` (Task 4), `MEAL_TYPE_LABELS`.
- Produces:
  - `NavIconName` agrega `"utensils"`.
  - `PATIENT_NAV = [Hoy /portal (home, exact), Plan /portal/plan (utensils), Citas /portal/citas (calendar)]`
  - `AppShellProps.accountLinks?: { href: string; label: string }[]`
  - `<DayMenu day={PortalDay} goalKcal={number | null} />`, `<GreetingCard greeting={Greeting} />`, `<RecordSwitcher records={...} currentId={string} basePath={string} />`, `<PortalEmpty title={string} text={string} />`

- [ ] **Step 1: `src/features/identity/navigation.ts`**

```ts
export type NavIconName = "home" | "users" | "calendar" | "calculator" | "shield" | "heart" | "utensils";
```

```ts
export const PATIENT_NAV: NavItem[] = [
  { href: "/portal", label: "Hoy", icon: "home", exact: true },
  { href: "/portal/plan", label: "Plan", icon: "utensils" },
  { href: "/portal/citas", label: "Citas", icon: "calendar" },
];
```

- [ ] **Step 2: `src/shared/ui/navigation/app-shell.tsx`**

1. Importar `UtensilsCrossed` de `lucide-react` y agregar `utensils: UtensilsCrossed` a `ICONS`.
2. Agregar a `AppShellProps`: `accountLinks?: { href: string; label: string }[];` y desestructurarlo con default `[]`.
3. En `accountPanel`, justo después del bloque de nombre/email, agregar:

```tsx
      {accountLinks.length > 0 && (
        <ul className="space-y-2">
          {accountLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => accountDialogRef.current?.close()}
                className="flex min-h-11 w-full items-center rounded-xl border border-border px-4 text-sm font-medium text-text hover:bg-background"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
```

- [ ] **Step 3: `src/app/(portal)/portal/layout.tsx`** — pasar al `AppShell`:

```tsx
      accountLinks={[{ href: "/portal/cuenta", label: "Mi cuenta y profesionales" }]}
```

- [ ] **Step 4: Crear `src/app/(portal)/portal/cuenta/page.tsx`** con el contenido actual de `src/app/(portal)/portal/page.tsx` (lista "Mis profesionales" + `RevokeConsentButton`), renombrando la función a `PortalAccountPage` y el `h1` a "Mi cuenta", con un `h2` "Mis profesionales" encima de la lista.

- [ ] **Step 5: `src/shared/lib/labels.ts`** — agregar:

```ts
export const PORTAL_MEAL_LABELS: Record<string, string> = { ...MEAL_TYPE_LABELS, AFTERNOON_SNACK: "Onces" };
```

- [ ] **Step 6: `src/features/portal/components/greeting-card.tsx`**

```tsx
import { Quote, Sparkles } from "lucide-react";
import type { Greeting } from "@/core/portal/greeting";

export function GreetingCard({ greeting }: { greeting: Greeting }) {
  return (
    <section aria-label="Saludo" className="rounded-2xl gradient-wellness border border-border p-5 space-y-3">
      <h1 className="text-2xl font-bold text-text">{greeting.salutation}</h1>
      {greeting.fact && (
        <p className="flex items-start gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          {greeting.fact}
        </p>
      )}
      <figure className="rounded-xl bg-surface/80 p-4">
        <blockquote className="flex gap-2 text-text">
          <Quote className="h-4 w-4 mt-1 shrink-0 text-muted" aria-hidden="true" />
          <p>{greeting.message.text}</p>
        </blockquote>
        {greeting.message.author && <figcaption className="mt-2 text-xs text-muted">— {greeting.message.author}</figcaption>}
      </figure>
    </section>
  );
}
```

- [ ] **Step 7: `src/features/portal/components/day-menu.tsx`**

```tsx
import type { PortalDay } from "@/features/portal/portal-data";
import { PORTAL_MEAL_LABELS } from "@/shared/lib/labels";

export function DayMenu({ day, goalKcal }: { day: PortalDay; goalKcal: number | null }) {
  const meals = day.meals.filter((m) => m.items.length > 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {Math.round(day.totals.energyKcal)} kcal{goalKcal ? ` de ${Math.round(goalKcal)} kcal de tu meta` : ""}
      </p>
      {meals.length === 0 ? (
        <p className="text-sm text-muted">Tu profesional aún no ha agregado alimentos a este día.</p>
      ) : (
        <ul className="space-y-3">
          {meals.map((meal) => (
            <li key={meal.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
              <h3 className="bg-primary-light px-4 py-2 text-sm font-semibold text-primary">
                {PORTAL_MEAL_LABELS[meal.type] ?? meal.type}
              </h3>
              <ul className="divide-y divide-border">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-text">{item.foodName}</span>
                    <span className="shrink-0 text-muted">{item.grams} g · {item.kcal} kcal</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 8: `src/features/portal/components/record-switcher.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function RecordSwitcher({ records, currentId, basePath }: { records: { patientId: string; professionalName: string }[]; currentId: string; basePath: string }) {
  if (records.length < 2) return null;
  return (
    <nav aria-label="Profesional" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {records.map((r) => (
        <Link
          key={r.patientId}
          href={`${basePath}?p=${r.patientId}`}
          aria-current={r.patientId === currentId ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm",
            r.patientId === currentId ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-text"
          )}
        >
          {r.professionalName}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 9: `src/features/portal/components/portal-empty.tsx`**

```tsx
import { Stethoscope } from "lucide-react";

export function PortalEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
      <Stethoscope className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
      <p className="font-medium text-text mt-3">{title}</p>
      <p className="text-sm text-muted mt-1">{text}</p>
    </div>
  );
}
```

- [ ] **Step 10: Pantalla Hoy — reemplazar `src/app/(portal)/portal/page.tsx`**

```tsx
import Link from "next/link";
import { CalendarClock, ClipboardList } from "lucide-react";
import { PORTAL_TIME_ZONE } from "@/core/portal/plan-cycle";
import { getPortalHomeAction } from "@/features/portal/actions";
import { DayMenu } from "@/features/portal/components/day-menu";
import { GreetingCard } from "@/features/portal/components/greeting-card";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";

const formatAppointment = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(date);

export default async function PortalTodayPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const home = await getPortalHomeAction(p ?? null);

  if (!home) {
    return (
      <div className="space-y-4 max-w-xl">
        <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={home.context.records} currentId={home.context.current.patientId} basePath="/portal" />
      <GreetingCard greeting={home.greeting} />

      {home.nextAppointment && (
        <Link href="/portal/citas" className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <CalendarClock className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm text-text">
            Próxima cita: <strong className="font-semibold">{formatAppointment(home.nextAppointment.date)}</strong>
          </span>
        </Link>
      )}

      <section aria-labelledby="menu-hoy" className="space-y-3">
        <h2 id="menu-hoy" className="text-lg font-semibold text-text">Tu menú de hoy</h2>
        {home.today.day ? (
          <>
            <p className="text-sm text-muted">{home.today.planName} · {home.today.day.name}</p>
            <DayMenu day={home.today.day} goalKcal={home.today.goalKcal} />
          </>
        ) : (
          <PortalEmpty title="Aún no tienes un plan activo" text="Cuando tu profesional active tu plan, aquí verás qué comer cada día." />
        )}
      </section>

      {home.today.instructions && (
        <section aria-labelledby="indicaciones" className="rounded-2xl border border-border bg-surface p-4 space-y-2">
          <h2 id="indicaciones" className="flex items-center gap-2 font-semibold text-text">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" /> Indicaciones de tu profesional
          </h2>
          <p className="text-sm text-text whitespace-pre-line">{home.today.instructions}</p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Verificar y commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit
git add src/features/identity/navigation.ts src/shared/ui/navigation/app-shell.tsx "src/app/(portal)/portal/layout.tsx" "src/app/(portal)/portal/page.tsx" "src/app/(portal)/portal/cuenta/page.tsx" src/features/portal/components src/shared/lib/labels.ts
git commit -m "feat(portal): navegación Hoy/Plan/Citas y pantalla Hoy con saludo, menú del día y próxima cita"
```

---

### Task 8: Pantallas Plan (semana y completo) y Citas

**Files:**
- Create: `src/app/(portal)/portal/plan/page.tsx`
- Create: `src/app/(portal)/portal/citas/page.tsx`
- Create: `src/features/portal/components/plan-view-toggle.tsx`

**Interfaces:**
- Consumes: `getPortalPlanAction`, `getPortalAppointmentsAction` (Task 6); `DayMenu`, `RecordSwitcher`, `PortalEmpty` (Task 7); `keyToNoonUtc`, `PORTAL_TIME_ZONE` (Task 2).
- Produces: rutas `/portal/plan?vista=semana|completo&semana=<offset>&p=<patientId>` y `/portal/citas?p=<patientId>`.

- [ ] **Step 1: `src/features/portal/components/plan-view-toggle.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export function PlanViewToggle({ view, query }: { view: "semana" | "completo"; query: string }) {
  const tab = (value: "semana" | "completo", label: string) => (
    <Link
      href={`/portal/plan?vista=${value}${query}`}
      aria-current={view === value ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-medium",
        view === value ? "bg-surface text-primary shadow-sm" : "text-muted"
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Vista del plan" className="flex gap-1 rounded-xl bg-background p-1 border border-border">
      {tab("semana", "Esta semana")}
      {tab("completo", "Plan completo")}
    </nav>
  );
}
```

- [ ] **Step 2: `src/app/(portal)/portal/plan/page.tsx`**

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { PORTAL_TIME_ZONE, keyToNoonUtc } from "@/core/portal/plan-cycle";
import { getPortalPlanAction } from "@/features/portal/actions";
import { DayMenu } from "@/features/portal/components/day-menu";
import { PlanViewToggle } from "@/features/portal/components/plan-view-toggle";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";
import { cn } from "@/shared/lib/utils";

const dayLabel = (key: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "short" }).format(keyToNoonUtc(key));
const shortDate = (date: Date) => new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(date);

export default async function PortalPlanPage({ searchParams }: { searchParams: Promise<{ p?: string; vista?: string; semana?: string }> }) {
  const { p, vista, semana } = await searchParams;
  const view = vista === "completo" ? "completo" : "semana";
  const data = await getPortalPlanAction(p ?? null, Number(semana ?? 0));

  if (!data) return <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />;
  const patientQuery = p ? `&p=${p}` : "";

  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={data.context.records} currentId={data.context.current.patientId} basePath="/portal/plan" />
      <h1 className="text-xl font-bold text-text">Mi plan alimentario</h1>

      {!data.plan ? (
        <PortalEmpty title="Aún no tienes un plan activo" text="Cuando tu profesional active tu plan, aquí verás tu alimentación día a día." />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-1">
            <p className="font-semibold text-text">{data.plan.name}</p>
            <p className="text-sm text-muted">{data.context.current.professionalName} · activo desde el {shortDate(data.plan.activatedAt)}</p>
            {data.plan.goal && <p className="text-sm text-muted">Meta diaria: {Math.round(data.plan.goal.targetKcal)} kcal</p>}
          </div>

          <PlanViewToggle view={view} query={patientQuery} />

          {view === "semana" ? (
            <section aria-label="Esta semana" className="space-y-3">
              <div className="flex items-center justify-between">
                <Link href={`/portal/plan?vista=semana&semana=${data.weekOffset - 1}${patientQuery}`} aria-label="Semana anterior" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border">
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Link>
                <p className="text-sm font-medium text-text">
                  {data.weekOffset === 0 ? "Esta semana" : data.weekOffset > 0 ? `En ${data.weekOffset} semana(s)` : `Hace ${-data.weekOffset} semana(s)`}
                </p>
                <Link href={`/portal/plan?vista=semana&semana=${data.weekOffset + 1}${patientQuery}`} aria-label="Semana siguiente" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border">
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
              <ul className="space-y-2">
                {data.week.map(({ dateKey, dayIndex }) => {
                  const day = dayIndex === null ? null : data.plan!.days[dayIndex] ?? null;
                  const isToday = dateKey === data.todayKey;
                  return (
                    <li key={dateKey}>
                      <details open={isToday} className={cn("rounded-2xl border bg-surface", isToday ? "border-primary" : "border-border")}>
                        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4">
                          <span>
                            <span className="block text-sm font-semibold capitalize text-text">{dayLabel(dateKey)}{isToday ? " · Hoy" : ""}</span>
                            <span className="block text-xs text-muted">{day ? day.name : "Plan aún no activo"}</span>
                          </span>
                          {day && <span className="text-xs text-muted">{Math.round(day.totals.energyKcal)} kcal</span>}
                        </summary>
                        {day && (
                          <div className="px-4 pb-4">
                            <DayMenu day={day} goalKcal={data.plan!.goal?.targetKcal ?? null} />
                          </div>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section aria-label="Plan completo" className="space-y-6">
              {data.plan.patientInstructions && (
                <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
                  <h2 className="flex items-center gap-2 font-semibold text-text">
                    <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" /> Indicaciones de tu profesional
                  </h2>
                  <p className="text-sm text-text whitespace-pre-line">{data.plan.patientInstructions}</p>
                </div>
              )}
              {data.plan.days.map((day) => (
                <div key={day.id} className="space-y-2">
                  <h2 className="text-lg font-semibold text-text">{day.name}</h2>
                  <p className="text-xs text-muted">
                    Proteína {Math.round(day.totals.proteinG)} g · Carbohidratos {Math.round(day.totals.carbsG)} g · Grasas {Math.round(day.totals.fatG)} g
                  </p>
                  <DayMenu day={day} goalKcal={data.plan!.goal?.targetKcal ?? null} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(portal)/portal/citas/page.tsx`**

```tsx
import { CalendarCheck2, CalendarX2, Clock } from "lucide-react";
import { PORTAL_TIME_ZONE } from "@/core/portal/plan-cycle";
import { getPortalAppointmentsAction } from "@/features/portal/actions";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: PORTAL_TIME_ZONE, weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(date);

const STATUS = {
  SCHEDULED: { label: "Programada", Icon: Clock, className: "text-primary" },
  COMPLETED: { label: "Completada", Icon: CalendarCheck2, className: "text-muted" },
  CANCELLED: { label: "Cancelada", Icon: CalendarX2, className: "text-danger" },
} as const;

export default async function PortalAppointmentsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const data = await getPortalAppointmentsAction(p ?? null);
  if (!data) return <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />;

  const [next, ...later] = data.upcoming;
  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={data.context.records} currentId={data.context.current.patientId} basePath="/portal/citas" />
      <h1 className="text-xl font-bold text-text">Mis citas</h1>

      <section aria-labelledby="proximas" className="space-y-3">
        <h2 id="proximas" className="font-semibold text-text">Próximas</h2>
        {!next ? (
          <PortalEmpty title="No tienes citas programadas" text="Tu profesional agenda tus citas; aparecerán aquí." />
        ) : (
          <>
            <div className="rounded-2xl border-2 border-primary bg-primary-light/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Tu próxima cita</p>
              <p className="mt-1 font-semibold capitalize text-text">{formatDate(next.date)}</p>
              <p className="text-sm text-muted">{next.duration} min · {data.context.current.professionalName}{next.reason ? ` · ${next.reason}` : ""}</p>
            </div>
            {later.length > 0 && (
              <ul className="space-y-2">
                {later.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
                    <p className="font-medium capitalize text-text">{formatDate(a.date)}</p>
                    <p className="text-sm text-muted">{a.duration} min{a.reason ? ` · ${a.reason}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="historial" className="space-y-3">
        <h2 id="historial" className="font-semibold text-text">Historial</h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay citas anteriores.</p>
        ) : (
          <ul className="space-y-2">
            {data.past.map((a) => {
              const s = STATUS[a.status];
              return (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
                  <div>
                    <p className="font-medium capitalize text-text">{formatDate(a.date)}</p>
                    {a.reason && <p className="text-sm text-muted">{a.reason}</p>}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${s.className}`}>
                    <s.Icon className="h-4 w-4" aria-hidden="true" /> {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verificar y commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test:unit
git add "src/app/(portal)/portal/plan/page.tsx" "src/app/(portal)/portal/citas/page.tsx" src/features/portal/components/plan-view-toggle.tsx
git commit -m "feat(portal): plan alimentario (semana con fechas y plan completo) y citas del paciente"
```

---

### Task 9: Datos demo, E2E móvil y verificación final

**Files:**
- Modify: `prisma/seed.ts` (plan activo de 2 días y cita próxima para María)
- Create: `tests/e2e/patient-portal.spec.ts`
- Modify: `tests/e2e/patient-invitation.spec.ts` (revocar ahora está en `/portal/cuenta`)
- Modify: `tests/e2e/helpers.ts` (`loginAsPatient`)
- Modify: `tests/e2e/global-setup.ts` (no cambia la lógica; sólo verificar que `SEED_PATIENT_PASSWORD` se fija — ya lo hace)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `loginAsPatient(page: Page): Promise<void>` (usa `paciente@emuj.health` y `process.env.SEED_PATIENT_PASSWORD`).

- [ ] **Step 1: Seed — al final de `main()` en `prisma/seed.ts`, antes de los `console.log`**

```ts
  const someFoods = await prisma.food.findMany({ take: 4, orderBy: { name: "asc" }, select: { id: true } });
  const lastAssessment = await prisma.assessment.findFirst({ where: { patientId: patient.id }, orderBy: { assessmentDate: "desc" }, select: { id: true } });
  await prisma.mealPlan.deleteMany({ where: { id: "seed-plan-maria" } });
  const activatedAt = new Date();
  activatedAt.setDate(activatedAt.getDate() - 1);
  await prisma.mealPlan.create({
    data: {
      id: "seed-plan-maria",
      name: "Plan demo — María",
      status: "ACTIVE",
      activatedAt,
      patientInstructions: "Toma 8 vasos de agua al día y camina 20 minutos después del almuerzo.",
      patientId: patient.id,
      professionalId: dev.id,
      assessmentId: lastAssessment?.id,
      days: {
        create: [1, 2].map((n) => ({
          name: `Día ${n}`,
          orderNum: n,
          meals: {
            create: [
              { type: "BREAKFAST" as const, orderNum: 1, items: { create: someFoods.slice(0, 2).map((f) => ({ foodId: f.id, portionGrams: 80 + n * 10, quantity: 1 })) } },
              { type: "LUNCH" as const, orderNum: 2, items: { create: someFoods.slice(2, 4).map((f) => ({ foodId: f.id, portionGrams: 120, quantity: 1 })) } },
              { type: "DINNER" as const, orderNum: 3 },
            ],
          },
        })),
      },
    },
  });
  const appointmentAt = new Date();
  appointmentAt.setDate(appointmentAt.getDate() + 2);
  appointmentAt.setUTCHours(15, 0, 0, 0);
  await prisma.appointment.upsert({
    where: { id: "seed-appointment-maria" },
    update: { date: appointmentAt, status: "SCHEDULED" },
    create: { id: "seed-appointment-maria", date: appointmentAt, duration: 45, reason: "Control mensual", status: "SCHEDULED", patientId: patient.id, professionalId: dev.id },
  });
```

Agregar al resumen: `console.log("   Plan activo demo de 2 días y cita próxima para María");`

- [ ] **Step 2: `tests/e2e/helpers.ts`** — agregar:

```ts
export async function loginAsPatient(page: Page) {
  const password = process.env.SEED_PATIENT_PASSWORD;
  if (!password) throw new Error("SEED_PATIENT_PASSWORD no está definida: la fija tests/e2e/global-setup.ts");
  await login(page, "paciente@emuj.health", password);
}
```

- [ ] **Step 3: `tests/e2e/patient-portal.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { loginAsPatient } from "./helpers";

test("paciente: saludo, menú de hoy, plan semanal y completo, citas y cuenta", async ({ page }) => {
  await loginAsPatient(page);
  await expect(page).toHaveURL(/\/portal$/);

  await expect(page.getByRole("heading", { level: 1, name: /^(Buenos días|Buenas tardes|Buenas noches), María$/ })).toBeVisible();
  await expect(page.getByText(/^Tu próxima cita es el /)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tu menú de hoy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Desayuno" }).first()).toBeVisible();
  await expect(page.getByText("Toma 8 vasos de agua al día")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of ["Hoy", "Plan", "Citas", "Cuenta"]) await expect(nav.getByText(label, { exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/portal\/plan/);
  await expect(page.getByRole("region", { name: "Esta semana" }).getByRole("listitem")).toHaveCount(7);
  await expect(page.getByText(/· Hoy$/)).toBeVisible();

  await page.getByRole("link", { name: "Plan completo" }).click();
  await expect(page.getByRole("heading", { name: "Día 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Día 2" })).toBeVisible();

  await nav.getByRole("link", { name: "Citas" }).click();
  await expect(page.getByText("Tu próxima cita")).toBeVisible();
  await expect(page.getByText(/Control mensual/)).toBeVisible();

  await nav.getByRole("button", { name: "Cuenta" }).click();
  await page.getByRole("dialog", { name: "Cuenta" }).getByRole("link", { name: "Mi cuenta y profesionales" }).click();
  await expect(page).toHaveURL(/\/portal\/cuenta$/);
  await expect(page.getByText("Dr. Desarrollador")).toBeVisible();
});
```

Notas para el implementador: `getByRole("region", { name: "Esta semana" })` funciona porque la sección tiene `aria-label`; si `<section>` sin `aria-labelledby` no expone rol `region` en Chromium, usar `page.locator('section[aria-label="Esta semana"] > ul > li')`. Verificar cada selector contra el DOM real antes de ejecutar.

- [ ] **Step 4: `tests/e2e/patient-invitation.spec.ts`** — tras aceptar, el inicio es Hoy; revocar está en la cuenta:

Reemplazar las líneas desde `await expect(page).toHaveURL(/\/portal$/);` hasta la aserción "No tienes profesionales vinculados" por:

```ts
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Aún no tienes un plan activo")).toBeVisible();
  await page.goto("/portal/cuenta");
  await expect(page.getByText("Dr. Desarrollador", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("No tienes profesionales vinculados")).toBeVisible();
```

- [ ] **Step 5: Ejecutar todo** (el controlador detiene antes el servidor dev de :3000)

```bash
unset DATABASE_URL DIRECT_URL
pnpm exec tsc --noEmit
pnpm lint
pnpm test:unit
pnpm test:int
pnpm test:e2e
pnpm build
```

Expected: tsc OK; lint 0 errores; unit e integración en verde; E2E `4 passed`; build OK.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts tests/e2e/patient-portal.spec.ts tests/e2e/patient-invitation.spec.ts tests/e2e/helpers.ts
git commit -m "test(e2e): recorrido móvil del portal del paciente y datos demo de plan y cita"
```
