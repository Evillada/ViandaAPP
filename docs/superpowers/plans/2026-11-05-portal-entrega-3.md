# Portal del paciente — Entrega 3 (Progreso) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/portal/progreso` con una gráfica de evolución (selector de medida, cintura primero), tarjeta de última valoración con cambios neutros, metas actuales, lista de valoraciones y detalle `/portal/progreso/[assessmentId]` con antropometría, diagnóstico e indicaciones. Pestaña "Progreso" en la navegación del paciente.

**Spec:** `docs/superpowers/specs/2026-11-04-portal-paciente-design.md` §3.4 (actualizada el 2026-11-05), §7, §8, §9.

**Tech:** Next.js 16 App Router, Prisma 6, Supabase Postgres, NextAuth v5 (JWT), Vitest (unit + integración en esquema `test`), Playwright móvil. pnpm siempre.

## Reglas globales

- Toda función exportada de un archivo `"use server"` obtiene actor antes de prisma (guardián `tests/unit/guardian/actions-require-actor.test.ts`). Páginas en `src/app` no importan prisma.
- Lógica pura en `src/core/portal/`, lectura de datos en `src/features/portal/` (sin `"use server"`), las actions sólo resuelven actor y delegan.
- `select` explícito en todo lo que lee el portal; nunca `Assessment.notes`, `AnthropometryRecord.anthropometryNotes`, `MealPlan.notes` ni `DietaryRecall.notes`.
- Mobile-first 390×844, targets ≥ 44 px, iconos lucide, sin emojis, textos en español.
- **Sin cambios de esquema** en esta entrega.
- Cambios de medidas en lenguaje neutro, sin verde/rojo ni "mejor/peor". El peso nunca es la medida abierta por defecto.
- Antes de comandos prisma/test: `unset DATABASE_URL DIRECT_URL`. Nunca dos procesos de pruebas a la vez (`pgrep -fl "vitest|prisma"`).
- Pruebas por tarea: sólo los archivos de la tarea. Suite completa al final.

## Decisiones (tomadas con el usuario al planear)

1. Indicaciones del detalle = `MealPlan.patientInstructions` del plan no borrador más reciente ligado a esa valoración. Sin campo nuevo.
2. `Patient.progressMessagesEnabled` apagado oculta gráficas, última valoración, antropometría y diagnóstico. Metas, lista e indicaciones siguen visibles.
3. Una sola gráfica con botones de medida, en lugar de cuatro apiladas.
4. Fuera de alcance: que el paciente registre su peso; adherencia (no hay diario).

---

### Task 1: Lógica pura de progreso

**Files:**
- Create: `src/core/portal/progress.ts`
- Test: `tests/unit/portal/progress.test.ts`

**Interfaces:**
- Produces: `ProgressMetricKey`, `ProgressMetric`, `PROGRESS_METRICS`, `formatMeasure(value: number): string`, `describeChange(current: number | null, previous: number | null, unit: string): string | null`, `availableMetrics(points): ProgressMetric[]`.

- [ ] **Step 1: Test que falla** — `tests/unit/portal/progress.test.ts`:

```ts
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
```

- [ ] **Step 2:** `pnpm exec vitest run tests/unit/portal/progress.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implementación** — `src/core/portal/progress.ts`:

```ts
export type ProgressMetricKey = "waistCm" | "weightKg" | "bmi" | "bodyFatPercent";

export interface ProgressMetric {
  key: ProgressMetricKey;
  label: string;
  unit: string;
}

/** La cintura va primero: el peso nunca es la medida que se abre por defecto. */
export const PROGRESS_METRICS: ProgressMetric[] = [
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "bmi", label: "IMC", unit: "kg/m²" },
  { key: "bodyFatPercent", label: "% grasa", unit: "%" },
];

export function formatMeasure(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value);
}

/** Cambio frente a la valoración anterior, sin calificarlo como mejor o peor. */
export function describeChange(current: number | null, previous: number | null, unit: string): string | null {
  if (current == null || previous == null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return "Igual que la valoración anterior";
  const amount = `${formatMeasure(Math.abs(diff))} ${unit}`;
  return diff < 0 ? `${amount} menos que la valoración anterior` : `${amount} más que la valoración anterior`;
}

export function availableMetrics(points: Record<ProgressMetricKey, number | null>[]): ProgressMetric[] {
  return PROGRESS_METRICS.filter((m) => points.some((p) => p[m.key] != null));
}
```

- [ ] **Step 4:** el mismo comando → PASS.
- [ ] **Step 5: Commit** — `git add src/core/portal/progress.ts tests/unit/portal/progress.test.ts && git commit -m "feat(portal): lógica de medidas y cambios neutros para progreso"`

### Task 2: Datos y vista de progreso (con aislamiento)

**Files:**
- Create: `src/features/portal/portal-progress.ts`
- Modify: `src/features/portal/portal-view.ts` (agregar `buildPortalProgress`, `buildPortalAssessment`)
- Modify: `src/features/portal/actions.ts` (agregar `getPortalProgressAction`, `getPortalAssessmentAction`)
- Test: `tests/integration/portal-progress.test.ts`

**Interfaces:**
- Consumes: `buildEvolutionTimeline`, `EvolutionRow` de `src/core/anthropometry/evolution.ts`; `loadPortalContext`, `getPortalRecords` existentes.
- Produces:
  - `getPortalProgress(patientId: string): Promise<PortalProgressData>`
  - `getPortalAssessment(patientIds: string[], assessmentId: string): Promise<PortalAssessmentDetail | null>`
  - `buildPortalProgress(actor: Actor, requested: string | null): Promise<PortalProgressView | null>`
  - `buildPortalAssessment(actor: Actor, assessmentId: string): Promise<PortalAssessmentView | null>`
  - Tipos exportados: `PortalGoals`, `PortalAssessmentSummary`, `PortalProgressData`, `PortalMeasures`, `PortalAssessmentDetail`, `PortalProgressView`, `PortalAssessmentView`.

- [ ] **Step 1: Tests que fallan** — `tests/integration/portal-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { buildPortalAssessment, buildPortalProgress } from "@/features/portal/portal-view";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function assessment(patientId: string, professionalId: string, date: string, waistCm: number, weightKg: number) {
  return prisma.assessment.create({
    data: {
      type: "FOLLOW_UP",
      assessmentDate: new Date(date),
      reason: "Control",
      notes: "NOTA PRIVADA",
      patientId,
      professionalId,
      anthropometry: { create: { weightKg, heightCm: 165, waistCm, anthropometryNotes: "NOTA ANTRO" } },
      nutritionalGoal: {
        create: {
          bmi: Math.round((weightKg / 1.65 ** 2) * 10) / 10,
          bmiCategory: "OVERWEIGHT",
          tmbKcal: 1400,
          targetKcal: 1700,
          proteinG: 106,
          carbsG: 212,
          fatG: 47,
          waterMlPerDay: 2100,
          nutritionalDiagnosis: "Sobrepeso",
          cie10Code: "E66.3",
        },
      },
    },
  });
}

async function linkedWithProgress(progressMessagesEnabled = true) {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id, firstName: "María" });
  await prisma.patient.update({ where: { id: patient.id }, data: { progressMessagesEnabled } });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  const first = await assessment(patient.id, pro.id, "2026-07-01T00:00:00Z", 85, 75.5);
  const last = await assessment(patient.id, pro.id, "2026-08-20T00:00:00Z", 82, 73.2);
  await prisma.mealPlan.create({
    data: { name: "Borrador", status: "DRAFT", patientInstructions: "BORRADOR", notes: "NOTA PLAN", patientId: patient.id, professionalId: pro.id, assessmentId: last.id },
  });
  await prisma.mealPlan.create({
    data: {
      name: "Plan", status: "ACTIVE", activatedAt: new Date("2026-08-21T15:00:00Z"), patientInstructions: "Camina 20 minutos",
      notes: "NOTA PLAN", patientId: patient.id, professionalId: pro.id, assessmentId: last.id,
    },
  });
  return { pro, account, patient, first, last };
}

describe("progreso del portal", () => {
  it("lista valoraciones recientes primero, gráfica cronológica y metas del plan activo", async () => {
    const { account, first, last } = await linkedWithProgress();
    const view = await buildPortalProgress(patientActor(account.id), null);
    expect(view?.showMeasures).toBe(true);
    expect(view?.assessments.map((a) => a.id)).toEqual([last.id, first.id]);
    expect(view?.timeline.map((p) => p.waistCm)).toEqual([85, 82]);
    expect(view?.goals).toEqual({ targetKcal: 1700, proteinG: 106, carbsG: 212, fatG: 47, proteinPct: 25, carbsPct: 50, fatPct: 25, waterMlPerDay: 2100 });
  });

  it("nunca expone notas internas", async () => {
    const { account, last } = await linkedWithProgress();
    const progress = JSON.stringify(await buildPortalProgress(patientActor(account.id), null));
    const detail = JSON.stringify(await buildPortalAssessment(patientActor(account.id), last.id));
    for (const text of [progress, detail]) {
      expect(text).not.toContain("NOTA PRIVADA");
      expect(text).not.toContain("NOTA ANTRO");
      expect(text).not.toContain("NOTA PLAN");
    }
  });

  it("con el interruptor apagado oculta medidas pero deja metas y lista", async () => {
    const { account, last } = await linkedWithProgress(false);
    const view = await buildPortalProgress(patientActor(account.id), null);
    expect(view?.showMeasures).toBe(false);
    expect(view?.timeline).toEqual([]);
    expect(view?.goals?.targetKcal).toBe(1700);
    expect(view?.assessments).toHaveLength(2);
    const detail = await buildPortalAssessment(patientActor(account.id), last.id);
    expect(detail?.measures).toBeNull();
    expect(detail?.diagnosis).toBeNull();
    expect(detail?.instructions).toBe("Camina 20 minutos");
  });

  it("el detalle muestra medidas, diagnóstico e indicaciones del plan no borrador", async () => {
    const { account, last } = await linkedWithProgress();
    const detail = await buildPortalAssessment(patientActor(account.id), last.id);
    expect(detail).toMatchObject({
      id: last.id,
      type: "FOLLOW_UP",
      professionalName: "Dra. Ruiz",
      instructions: "Camina 20 minutos",
      diagnosis: { text: "Sobrepeso", cie10Code: "E66.3" },
    });
    expect(detail?.measures).toMatchObject({ weightKg: 73.2, heightCm: 165, waistCm: 82, bmi: 26.9 });
  });

  it("no permite abrir la valoración de otro paciente", async () => {
    const mine = await linkedWithProgress();
    const other = await linkedWithProgress();
    expect(await buildPortalAssessment(patientActor(mine.account.id), other.last.id)).toBeNull();
  });

  it("sin consentimiento vigente no hay progreso ni detalle", async () => {
    const { account, patient, last } = await linkedWithProgress();
    await prisma.patientConsent.updateMany({ where: { patientId: patient.id }, data: { revokedAt: new Date() } });
    expect(await buildPortalProgress(patientActor(account.id), null)).toBeNull();
    expect(await buildPortalAssessment(patientActor(account.id), last.id)).toBeNull();
  });

  it("un actor fuera del área paciente no obtiene nada", async () => {
    const { account, last } = await linkedWithProgress();
    const asPro: Actor = { userId: account.id, roles: ["PATIENT"], activeArea: "PROFESSIONAL", professionalStatus: null };
    expect(await buildPortalProgress(asPro, null)).toBeNull();
    expect(await buildPortalAssessment(asPro, last.id)).toBeNull();
  });
});
```

- [ ] **Step 2:** `pnpm test:int tests/integration/portal-progress.test.ts` → FAIL (`buildPortalProgress` no existe).
- [ ] **Step 3: Datos** — `src/features/portal/portal-progress.ts`:

```ts
import { buildEvolutionTimeline, type EvolutionRow } from "@/core/anthropometry/evolution";
import { prisma } from "@/infrastructure/database/prisma";

export interface PortalGoals {
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  waterMlPerDay: number | null;
}
export interface PortalAssessmentSummary { id: string; date: Date; type: string }
export interface PortalProgressData { assessments: PortalAssessmentSummary[]; timeline: EvolutionRow[]; goals: PortalGoals | null }
export interface PortalMeasures {
  weightKg: number;
  heightCm: number;
  bmi: number | null;
  bodyFatPercent: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  waistHipRatio: number | null;
}
export interface PortalAssessmentDetail {
  id: string;
  patientId: string;
  date: Date;
  type: string;
  measures: PortalMeasures | null;
  diagnosis: { text: string; cie10Code: string | null } | null;
  instructions: string | null;
}

const goalSelect = {
  targetKcal: true, proteinG: true, carbsG: true, fatG: true,
  proteinPct: true, carbsPct: true, fatPct: true, waterMlPerDay: true,
} as const;

const toGoals = (g: PortalGoals): PortalGoals => ({
  targetKcal: g.targetKcal, proteinG: g.proteinG, carbsG: g.carbsG, fatG: g.fatG,
  proteinPct: g.proteinPct, carbsPct: g.carbsPct, fatPct: g.fatPct, waterMlPerDay: g.waterMlPerDay,
});

export async function getPortalProgress(patientId: string): Promise<PortalProgressData> {
  const [assessments, activePlan] = await Promise.all([
    prisma.assessment.findMany({
      where: { patientId },
      orderBy: { assessmentDate: "desc" },
      select: {
        id: true,
        type: true,
        assessmentDate: true,
        anthropometry: { select: { weightKg: true, bodyFatPercent: true, waistCm: true, waistHipRatio: true, leanMassKg: true } },
        nutritionalGoal: { select: { bmi: true, ...goalSelect } },
      },
    }),
    prisma.mealPlan.findFirst({
      where: { patientId, status: "ACTIVE" },
      orderBy: [{ activatedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      select: { assessment: { select: { nutritionalGoal: { select: goalSelect } } } },
    }),
  ]);

  const timeline = buildEvolutionTimeline(
    assessments.map((a) => ({
      id: a.id,
      assessmentDate: a.assessmentDate,
      reason: "",
      anthropometry: a.anthropometry,
      nutritionalGoal: a.nutritionalGoal ? { bmi: a.nutritionalGoal.bmi } : null,
    }))
  );
  const goal = activePlan?.assessment?.nutritionalGoal ?? assessments.find((a) => a.nutritionalGoal)?.nutritionalGoal ?? null;

  return {
    assessments: assessments.map((a) => ({ id: a.id, date: a.assessmentDate, type: a.type })),
    timeline,
    goals: goal ? toGoals(goal) : null,
  };
}

export async function getPortalAssessment(patientIds: string[], assessmentId: string): Promise<PortalAssessmentDetail | null> {
  if (patientIds.length === 0) return null;
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, patientId: { in: patientIds } },
    select: {
      id: true,
      patientId: true,
      type: true,
      assessmentDate: true,
      anthropometry: {
        select: { weightKg: true, heightCm: true, bodyFatPercent: true, fatMassKg: true, leanMassKg: true, waistCm: true, hipCm: true, waistHipRatio: true },
      },
      nutritionalGoal: { select: { bmi: true, nutritionalDiagnosis: true, cie10Code: true } },
      mealPlans: {
        where: { status: { not: "DRAFT" }, patientInstructions: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { patientInstructions: true },
      },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    patientId: a.patientId,
    date: a.assessmentDate,
    type: a.type,
    measures: a.anthropometry ? { ...a.anthropometry, bmi: a.nutritionalGoal?.bmi ?? null } : null,
    diagnosis: a.nutritionalGoal?.nutritionalDiagnosis
      ? { text: a.nutritionalGoal.nutritionalDiagnosis, cie10Code: a.nutritionalGoal.cie10Code }
      : null,
    instructions: a.mealPlans[0]?.patientInstructions ?? null,
  };
}
```

- [ ] **Step 4: Vista** — en `src/features/portal/portal-view.ts` importar `getPortalAssessment`, `getPortalProgress` y sus tipos desde `./portal-progress`, y agregar al final:

```ts
export interface PortalProgressView extends PortalProgressData {
  context: PortalContext;
  showMeasures: boolean;
}

export interface PortalAssessmentView extends PortalAssessmentDetail {
  professionalName: string;
  showMeasures: boolean;
}

export async function buildPortalProgress(actor: Actor, requested: string | null): Promise<PortalProgressView | null> {
  const context = await loadPortalContext(actor, requested);
  if (!context) return null;
  const data = await getPortalProgress(context.current.patientId);
  const showMeasures = context.current.progressMessagesEnabled;
  return { context, showMeasures, ...data, timeline: showMeasures ? data.timeline : [] };
}

export async function buildPortalAssessment(actor: Actor, assessmentId: string): Promise<PortalAssessmentView | null> {
  if (actor.activeArea !== "PATIENT") return null;
  // getPortalRecords sólo devuelve fichas del actor con consentimiento vigente.
  const records = await getPortalRecords(actor.userId);
  const detail = await getPortalAssessment(records.map((r) => r.patientId), assessmentId);
  if (!detail) return null;
  const record = records.find((r) => r.patientId === detail.patientId)!;
  const showMeasures = record.progressMessagesEnabled;
  return {
    ...detail,
    professionalName: record.professionalName,
    showMeasures,
    measures: showMeasures ? detail.measures : null,
    diagnosis: showMeasures ? detail.diagnosis : null,
  };
}
```

- [ ] **Step 5: Actions** — en `src/features/portal/actions.ts` importar `buildPortalAssessment`, `buildPortalProgress` desde `./portal-view` y agregar:

```ts
export async function getPortalProgressAction(requested: string | null = null) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalProgress(actor, requested);
}

export async function getPortalAssessmentAction(assessmentId: string) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalAssessment(actor, assessmentId);
}
```

- [ ] **Step 6:** `pnpm test:int tests/integration/portal-progress.test.ts` → PASS (7). `pnpm exec vitest run tests/unit/guardian` → PASS.
- [ ] **Step 7: Commit** — `git add src/features/portal/portal-progress.ts src/features/portal/portal-view.ts src/features/portal/actions.ts tests/integration/portal-progress.test.ts && git commit -m "feat(portal): datos de progreso y detalle de valoración con aislamiento y sin notas internas"`

### Task 3: Página "Mi progreso", gráfica con selector y pestaña

**Files:**
- Create: `src/shared/ui/charts/metric-line-chart.tsx` (movido desde `evolution-charts.tsx`)
- Modify: `src/features/assessments/components/evolution-charts.tsx` (importa el gráfico movido)
- Create: `src/features/portal/components/progress-chart.tsx`
- Create: `src/features/portal/components/goals-card.tsx`
- Create: `src/app/(portal)/portal/progreso/page.tsx`
- Modify: `src/features/identity/navigation.ts`, `src/shared/ui/navigation/app-shell.tsx`

**Interfaces:**
- Consumes: `getPortalProgressAction` (Task 2), `PROGRESS_METRICS`, `availableMetrics`, `describeChange`, `formatMeasure` (Task 1), `RecordSwitcher({ records, currentId, basePath })`, `PortalEmpty({ title, text })`, `ASSESSMENT_TYPE_LABELS`, `formatCalendarDate`.
- Produces: `MetricLineChart` en `@/shared/ui/charts/metric-line-chart`; ruta `/portal/progreso`.

- [ ] **Step 1: Mover el gráfico.** Cortar `MetricLineChart` y su interfaz de `evolution-charts.tsx` a `src/shared/ui/charts/metric-line-chart.tsx` con `"use client"` y `export function MetricLineChart`. Cambiar la etiqueta del eje X (hoy `formatDate(p.date).slice(0, 5)`, que muestra "1 de " en vez de la fecha) por la fecha corta en UTC, porque `assessmentDate` es una fecha sin hora guardada a medianoche UTC:

```tsx
const shortDate = (date: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
// ...
{shortDate(p.date)}
```

  En el mensaje de un solo punto, el texto queda igual. `evolution-charts.tsx` importa `MetricLineChart` desde `@/shared/ui/charts/metric-line-chart` y conserva `EvolutionCharts` sin otro cambio.

- [ ] **Step 2: Gráfica con selector** — `src/features/portal/components/progress-chart.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { EvolutionPoint } from "@/core/anthropometry/evolution";
import type { ProgressMetric } from "@/core/portal/progress";
import { cn } from "@/shared/lib/utils";
import { MetricLineChart } from "@/shared/ui/charts/metric-line-chart";

export function ProgressChart({ timeline, metrics }: { timeline: EvolutionPoint[]; metrics: ProgressMetric[] }) {
  const [selected, setSelected] = useState(metrics[0]!.key);
  const metric = metrics.find((m) => m.key === selected) ?? metrics[0]!;
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Medida" className="flex gap-2 overflow-x-auto pb-1">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.key === metric.key}
            onClick={() => setSelected(m.key)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
              m.key === metric.key ? "border-primary bg-primary text-white" : "border-border bg-surface text-text"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <MetricLineChart title={metric.label} unit={metric.unit} data={timeline} getValue={(p) => p[metric.key]} />
    </div>
  );
}
```

- [ ] **Step 3: Metas** — `src/features/portal/components/goals-card.tsx`:

```tsx
import { Droplets } from "lucide-react";
import type { PortalGoals } from "@/features/portal/portal-progress";
import { formatMeasure } from "@/core/portal/progress";

const MACROS = [
  { key: "protein", label: "Proteína", className: "bg-primary" },
  { key: "carbs", label: "Carbohidratos", className: "bg-secondary" },
  { key: "fat", label: "Grasa", className: "bg-accent" },
] as const;

export function GoalsCard({ goals }: { goals: PortalGoals }) {
  const values = {
    protein: { g: goals.proteinG, pct: goals.proteinPct },
    carbs: { g: goals.carbsG, pct: goals.carbsPct },
    fat: { g: goals.fatG, pct: goals.fatPct },
  };
  return (
    <section aria-labelledby="metas" className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <h2 id="metas" className="font-semibold text-text">Tus metas</h2>
      <p className="text-2xl font-bold text-text">
        {formatMeasure(Math.round(goals.targetKcal))} <span className="text-base font-medium text-muted">kcal al día</span>
      </p>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
        {MACROS.map((m) => (
          <div key={m.key} className={m.className} style={{ width: `${values[m.key].pct}%` }} />
        ))}
      </div>
      <ul className="space-y-1">
        {MACROS.map((m) => (
          <li key={m.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-text">
              <span className={`h-2.5 w-2.5 rounded-full ${m.className}`} aria-hidden="true" /> {m.label}
            </span>
            <span className="text-muted">{Math.round(values[m.key].g)} g · {formatMeasure(values[m.key].pct)} %</span>
          </li>
        ))}
      </ul>
      {goals.waterMlPerDay != null && (
        <p className="flex items-center gap-2 border-t border-border pt-3 text-sm text-text">
          <Droplets className="h-4 w-4 text-secondary" aria-hidden="true" /> Agua: {formatMeasure(goals.waterMlPerDay / 1000)} litros al día
        </p>
      )}
    </section>
  );
}
```

  `primary`, `secondary` y `accent` son colores del tema en `src/app/globals.css`.

- [ ] **Step 4: Página** — `src/app/(portal)/portal/progreso/page.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { availableMetrics, describeChange, formatMeasure } from "@/core/portal/progress";
import { getPortalProgressAction } from "@/features/portal/actions";
import { GoalsCard } from "@/features/portal/components/goals-card";
import { PortalEmpty } from "@/features/portal/components/portal-empty";
import { ProgressChart } from "@/features/portal/components/progress-chart";
import { RecordSwitcher } from "@/features/portal/components/record-switcher";
import { ASSESSMENT_TYPE_LABELS } from "@/shared/lib/labels";
import { formatCalendarDate } from "@/shared/lib/utils";

export default async function PortalProgressPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const data = await getPortalProgressAction(p ?? null);
  if (!data) return <PortalEmpty title="No tienes profesionales vinculados" text="Pide a tu nutricionista un enlace de invitación." />;

  const latest = data.timeline.at(-1) ?? null;
  const previous = data.timeline.at(-2) ?? null;
  const metrics = availableMetrics(data.timeline);
  const patientId = data.context.current.patientId;

  return (
    <div className="space-y-5 max-w-xl">
      <RecordSwitcher records={data.context.records} currentId={patientId} basePath="/portal/progreso" />
      <h1 className="text-xl font-bold text-text">Mi progreso</h1>

      {data.assessments.length === 0 ? (
        <PortalEmpty title="Aún no tienes valoraciones" text="Aparecerán aquí después de tu consulta." />
      ) : (
        <>
          {latest && metrics.length > 0 && (
            <section aria-labelledby="ultima" className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <h2 id="ultima" className="font-semibold text-text">Tu última valoración</h2>
                <p className="text-sm text-muted">{formatCalendarDate(latest.date)}</p>
              </div>
              <ul className="grid grid-cols-2 gap-3">
                {metrics.map((m) => {
                  const value = latest[m.key];
                  if (value == null) return null;
                  const change = describeChange(value, previous?.[m.key] ?? null, m.unit);
                  return (
                    <li key={m.key} className="rounded-xl bg-background p-3">
                      <p className="text-xs text-muted">{m.label}</p>
                      <p className="text-lg font-semibold text-text">{formatMeasure(value)} {m.unit}</p>
                      {change && <p className="text-xs text-muted">{change}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {data.timeline.length >= 2 && metrics.length > 0 && (
            <section aria-label="Evolución">
              <ProgressChart timeline={data.timeline} metrics={metrics} />
            </section>
          )}

          {data.goals && <GoalsCard goals={data.goals} />}

          <section aria-labelledby="valoraciones" className="space-y-3">
            <h2 id="valoraciones" className="font-semibold text-text">Tus valoraciones</h2>
            <ul className="space-y-2">
              {data.assessments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/portal/progreso/${a.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
                  >
                    <span>
                      <span className="block font-medium text-text">{ASSESSMENT_TYPE_LABELS[a.type] ?? "Valoración"}</span>
                      <span className="block text-sm text-muted">{formatCalendarDate(a.date)}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
```

  Si `data.goals` es null y no hay valoraciones, sólo se ve el estado vacío.

- [ ] **Step 5: Pestaña.** En `navigation.ts`: `NavIconName` agrega `"progress"`; `PATIENT_NAV` agrega `{ href: "/portal/progreso", label: "Progreso", icon: "progress" }` después de Citas. En `app-shell.tsx`: importar `TrendingUp` de `lucide-react` y agregar `progress: TrendingUp` a `ICONS`.
- [ ] **Step 6: Verificar** — `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec vitest run tests/unit`. Con el servidor de desarrollo del usuario en :3000 y la cuenta de María (seed), abrir `/portal/progreso` a 390×844 y confirmar: botón "Cintura" seleccionado, gráfica con 3 puntos y fechas legibles, metas, 3 valoraciones. Abrir también la ficha de María del lado profesional y confirmar que las gráficas de evolución siguen iguales salvo las fechas del eje, ahora legibles.
- [ ] **Step 7: Commit** — `git add src/shared/ui/charts/metric-line-chart.tsx src/features/assessments/components/evolution-charts.tsx src/features/portal/components/progress-chart.tsx src/features/portal/components/goals-card.tsx "src/app/(portal)/portal/progreso/page.tsx" src/features/identity/navigation.ts src/shared/ui/navigation/app-shell.tsx && git commit -m "feat(portal): página Mi progreso con gráfica por medida, metas y valoraciones"`

### Task 4: Detalle de valoración

**Files:**
- Create: `src/app/(portal)/portal/progreso/[assessmentId]/page.tsx`

**Interfaces:**
- Consumes: `getPortalAssessmentAction(assessmentId)` → `PortalAssessmentView | null` (Task 2), `formatMeasure` (Task 1), `ASSESSMENT_TYPE_LABELS`, `formatCalendarDate`.

- [ ] **Step 1: Página:**

```tsx
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMeasure } from "@/core/portal/progress";
import { getPortalAssessmentAction } from "@/features/portal/actions";
import type { PortalMeasures } from "@/features/portal/portal-progress";
import { ASSESSMENT_TYPE_LABELS } from "@/shared/lib/labels";
import { formatCalendarDate } from "@/shared/lib/utils";

const MEASURE_ROWS: { key: keyof PortalMeasures; label: string; unit: string }[] = [
  { key: "weightKg", label: "Peso", unit: "kg" },
  { key: "heightCm", label: "Talla", unit: "cm" },
  { key: "bmi", label: "IMC", unit: "kg/m²" },
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "hipCm", label: "Cadera", unit: "cm" },
  { key: "waistHipRatio", label: "Índice cintura/cadera", unit: "" },
  { key: "bodyFatPercent", label: "Grasa corporal", unit: "%" },
  { key: "fatMassKg", label: "Masa grasa", unit: "kg" },
  { key: "leanMassKg", label: "Masa magra", unit: "kg" },
];

export default async function PortalAssessmentPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const data = await getPortalAssessmentAction(assessmentId);
  if (!data) notFound();

  const rows = data.measures ? MEASURE_ROWS.filter((r) => data.measures![r.key] != null) : [];

  return (
    <div className="space-y-5 max-w-xl">
      <Link href={`/portal/progreso?p=${data.patientId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a mi progreso
      </Link>
      <div>
        <h1 className="text-xl font-bold text-text">{ASSESSMENT_TYPE_LABELS[data.type] ?? "Valoración"}</h1>
        <p className="text-sm text-muted">{formatCalendarDate(data.date)} · {data.professionalName}</p>
      </div>

      {rows.length > 0 && (
        <section aria-labelledby="medidas" className="rounded-2xl border border-border bg-surface p-4">
          <h2 id="medidas" className="mb-2 font-semibold text-text">Medidas</h2>
          <dl className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.key} className="flex justify-between py-2 text-sm">
                <dt className="text-muted">{r.label}</dt>
                <dd className="font-medium text-text">{formatMeasure(data.measures![r.key] as number)}{r.unit ? ` ${r.unit}` : ""}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.diagnosis && (
        <section aria-labelledby="diagnostico" className="rounded-2xl border border-border bg-surface p-4 space-y-1">
          <h2 id="diagnostico" className="font-semibold text-text">Diagnóstico nutricional</h2>
          <p className="text-sm text-text">{data.diagnosis.text}</p>
          {data.diagnosis.cie10Code && <p className="text-xs text-muted">CIE-10: {data.diagnosis.cie10Code}</p>}
        </section>
      )}

      <section aria-labelledby="indicaciones" className="rounded-2xl border border-border bg-surface p-4 space-y-1">
        <h2 id="indicaciones" className="font-semibold text-text">Indicaciones de tu nutricionista</h2>
        <p className="whitespace-pre-line text-sm text-text">
          {data.instructions ?? "Tu nutricionista no dejó indicaciones en esta valoración."}
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verificar** — `pnpm exec tsc --noEmit`, `pnpm lint`. En el navegador a 390×844 con María: abrir la valoración más reciente → medidas, indicaciones "Toma 8 vasos de agua al día…". Abrir `/portal/progreso/no-existe` → 404.
- [ ] **Step 3: Commit** — `git add "src/app/(portal)/portal/progreso/[assessmentId]/page.tsx" && git commit -m "feat(portal): detalle de valoración con medidas, diagnóstico e indicaciones"`

### Task 5: Interruptor del profesional y E2E

**Files:**
- Modify: `src/features/patients/components/portal-settings-panel.tsx` (texto del interruptor)
- Modify: `tests/e2e/patient-portal.spec.ts`

- [ ] **Step 1: Texto del interruptor.** Reemplazar `Mostrar mensajes de progreso en el saludo` por:

```tsx
<span>
  <span className="block">Mostrar progreso y medidas en el portal</span>
  <span className="block text-xs text-muted">Si lo apagas, el paciente no ve mensajes de progreso, gráficas, medidas ni diagnóstico.</span>
</span>
```

  Ninguna prueba usa el texto anterior (verificado con `rg -n "mensajes de progreso" tests src`).

- [ ] **Step 2: E2E.** En `tests/e2e/patient-portal.spec.ts`, cambiar la lista de pestañas a `["Hoy", "Plan", "Citas", "Progreso", "Cuenta"]` y, después del bloque de Citas y antes del de Cuenta, agregar:

```ts
  await nav.getByRole("link", { name: "Progreso" }).click();
  await expect(page).toHaveURL(/\/portal\/progreso/);
  await expect(page.getByRole("heading", { level: 1, name: "Mi progreso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cintura" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Peso" }).click();
  await expect(page.getByRole("button", { name: "Peso" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Tus metas" })).toBeVisible();
  await page.getByRole("link", { name: /Control \/ seguimiento/ }).first().click();
  await expect(page).toHaveURL(/\/portal\/progreso\/.+/);
  await expect(page.getByRole("heading", { name: "Indicaciones de tu nutricionista" })).toBeVisible();
  await expect(page.getByText(/Toma 8 vasos de agua al día/)).toBeVisible();
```

  Requiere el seed actual (`pnpm db:seed`): María tiene 3 valoraciones y el plan activo ligado a la última.
- [ ] **Step 3:** Con el permiso del usuario para detener su servidor en :3000, `pnpm test:e2e tests/e2e/patient-portal.spec.ts` → PASS. Reiniciar `pnpm dev` al terminar.
- [ ] **Step 4: Commit** — `git add src/features/patients/components/portal-settings-panel.tsx tests/e2e/patient-portal.spec.ts && git commit -m "feat(portal): interruptor de progreso cubre medidas y E2E de Mi progreso"`

### Task 6: Verificación final y publicación

- [ ] `pgrep -fl "vitest|prisma"` vacío. Luego: `pnpm exec tsc --noEmit`, `pnpm lint` (0 errores), `pnpm test` (unit), `pnpm test:int`, `pnpm test:e2e`, `pnpm build`.
- [ ] Revisión final de toda la entrega por un revisor independiente; corregir lo crítico e importante.
- [ ] Con aprobación del usuario: `git push origin main` y `vercel deploy --prod --yes`; smoke de `https://vianda-eta.vercel.app/portal/progreso` (sin sesión → 307 a `/login`).
