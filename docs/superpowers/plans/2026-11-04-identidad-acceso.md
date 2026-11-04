# Identidad y acceso (Subproyecto A) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profesionales aprobados, pacientes por invitación con consentimiento revocable, permisos por rol y relación, y auditoría — sin que ningún rol (incluido ADMIN) vea fichas ajenas.

**Architecture:** Políticas puras en `src/core/access` deciden permisos sobre un `Actor`. `src/infrastructure/access/access-context.ts` construye el `Actor` de la petición leyendo roles desde la BD. Toda server action de `src/features/*/actions.ts` obtiene el actor con `getActorFor(area)` / `requireActorFor(area)`. La auditoría se escribe con `recordAudit` (transaccional) o `recordAuditBestEffort` (lecturas). Cada área (`/dashboard`, `/portal`, `/admin`) tiene un layout que valida el área y usa un `AppShell` mobile-first.

**Tech Stack:** Next.js 16.3 (App Router, server actions), NextAuth 5 beta (JWT), Prisma 6.19 + PostgreSQL (Supabase), Tailwind v4, Zod 4, Vitest, Playwright, lucide-react. Gestor: **pnpm** exclusivamente.

**Spec:** `docs/superpowers/specs/2026-11-04-identidad-acceso-design.md`

## Global Constraints

- Gestor de paquetes: **sólo `pnpm`** (`pnpm add`, `pnpm exec`, `pnpm dlx`). Prohibido `npm`, `npx`, `yarn`.
- Responsive-first: cada pantalla se construye y verifica primero a **390×844**; `sm:`/`md:`/`lg:` sólo amplían. Destinos táctiles ≥ 44 px. Iconos SVG (`lucide-react`), nunca emojis en navegación. Cerrar sesión alcanzable en móvil.
- Roles: `PATIENT`, `PROFESSIONAL`, `ADMIN`; una cuenta puede tener varios. `ADMIN` **no** da acceso a fichas clínicas.
- Un profesional sin perfil `APPROVED` no tiene capacidades de profesional aunque tenga el rol.
- Token de invitación: 32 bytes aleatorios en base64url; sólo se persiste su SHA-256 (hex). Vigencia: **7 días**. Un solo uso.
- Auditoría transaccional (si falla, la operación falla): invitaciones, consentimiento, registro/aprobación/rechazo/suspensión de profesionales. Auditoría de mejor esfuerzo: `PATIENT_RECORD_VIEWED`, cambios clínicos, logins.
- Roles se leen de la BD en cada petición; el JWT sólo guarda `id`. El proxy sólo exige sesión, nunca roles.
- Textos de UI en español. Identificadores de código en inglés.
- Antes de escribir código Next.js, consultar la guía relevante en `node_modules/next/dist/docs/` (regla de `AGENTS.md`).

**Fuera de este plan (decidido):** pantalla para *consultar* la auditoría. Este plan registra todos los eventos y deja la política `auditScope` probada; la vista de consulta va en el subproyecto D (admin).

## Antes de empezar

- [ ] **Commit de cambios pendientes ajenos a este plan.** El árbol de trabajo tiene cambios sin commitear (migración a Supabase, `pnpm`, rendimiento, `CLAUDE.md`). Pide confirmación al usuario y haz un commit separado:

```bash
git status --short
git add .gitignore CLAUDE.md README.md docs/superpowers/specs next.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml prisma/schema.prisma prisma/seed.ts src/features/patients/components/patient-search.tsx .env.example
git commit -m "chore: migración a Supabase, pnpm-only, rendimiento de consultas y reglas responsive-first"
```

- [ ] **Detén `pnpm dev`** durante las tareas que reinician la BD (Tarea 2) y durante E2E (Tarea 15): Next 16 no permite dos `next dev` en el mismo directorio.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `vitest.config.mts` / `vitest.integration.config.mts` | Config unitaria / integración |
| `tests/setup/test-database-url.ts` | URL del esquema `test` |
| `tests/setup/integration-global-setup.ts` / `integration-setup.ts` | Reset de esquema / mocks de Next y auth |
| `tests/support/db.ts`, `factories.ts`, `session.ts` | Limpieza, fábricas, sesión simulada |
| `src/core/access/types.ts`, `policies.ts`, `landing.ts` | Tipos, políticas puras, áreas y aterrizaje |
| `src/core/invitations/invitation-token.ts` | Generar/hashear token, estado de invitación |
| `src/core/audit/audit.ts` | Lista de acciones y tipo `AuditEntry` |
| `src/infrastructure/audit/audit-logger.ts` | `recordAudit`, `recordAuditBestEffort` |
| `src/infrastructure/http/request-meta.ts` | IP, user agent y origen de la petición |
| `src/infrastructure/access/access-context.ts` | `loadActor`, `getSessionActor`, `getActorFor`, `requireActorFor` |
| `src/features/identity/*` | Credenciales, registro profesional, sesión, navegación, estado pendiente |
| `src/features/admin/*` | Revisión de profesionales |
| `src/features/invitations/*` | Crear, previsualizar, aceptar invitación; cuenta de invitado |
| `src/features/consent/*` | Documento vigente, revocación |
| `src/features/portal/*` | Portal mínimo |
| `src/shared/ui/brand/logo.tsx`, `src/shared/ui/navigation/app-shell.tsx` | Marca y navegación responsive |
| `src/proxy.ts` | Sustituye a `src/middleware.ts` |
| `src/app/start`, `src/app/pending`, `src/app/invite/[token]`, `src/app/(portal)/portal`, `src/app/(admin)/admin` | Rutas nuevas |
| `playwright.config.ts`, `tests/e2e/*` | E2E móvil |

---

### Task 1: Infraestructura de pruebas (Vitest + esquema `test`)

**Files:**
- Create: `vitest.config.mts`, `vitest.integration.config.mts`
- Create: `tests/setup/test-database-url.ts`, `tests/setup/integration-global-setup.ts`, `tests/setup/integration-setup.ts`
- Create: `tests/support/db.ts`, `tests/support/session.ts`
- Create: `tests/unit/sanity.test.ts`, `tests/integration/db-sanity.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `testDatabaseUrl(): string`; `resetDatabase(): Promise<void>`; `prisma` re-exportado desde `tests/support/db.ts`; `signInAs(userId: string | null): void`; scripts `pnpm test:unit`, `pnpm test:int`, `pnpm test`.

- [ ] **Step 1: Instalar Vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Crear `tests/setup/test-database-url.ts`**

```ts
export function testDatabaseUrl(): string {
  const base = process.env.DIRECT_URL;
  if (!base) throw new Error("DIRECT_URL no está definido en .env");
  const url = new URL(base);
  url.searchParams.set("schema", "test");
  url.searchParams.set("connection_limit", "5");
  return url.toString();
}
```

- [ ] **Step 3: Crear `tests/setup/integration-global-setup.ts`**

```ts
import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database-url";

export default function setup(): void {
  process.loadEnvFile(".env");
  const url = testDatabaseUrl();
  execSync("pnpm exec prisma db push --force-reset --accept-data-loss --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
```

- [ ] **Step 4: Crear `tests/setup/integration-setup.ts`**

```ts
import { beforeEach, vi } from "vitest";
import { testDatabaseUrl } from "./test-database-url";

process.loadEnvFile(".env");
process.env.DATABASE_URL = testDatabaseUrl();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "vitest",
        host: "localhost:3000",
      })
  ),
}));
vi.mock("@/infrastructure/auth/auth", () => ({
  auth: vi.fn(async () => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

beforeEach(async () => {
  const { resetDatabase } = await import("../support/db");
  await resetDatabase();
});
```

- [ ] **Step 5: Crear `tests/support/db.ts`**

```ts
import { prisma } from "@/infrastructure/database/prisma";

export async function resetDatabase(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'test'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"test"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

export { prisma };
```

- [ ] **Step 6: Crear `tests/support/session.ts`**

```ts
import { vi } from "vitest";
import { auth } from "@/infrastructure/auth/auth";

type AuthFn = () => Promise<unknown>;

export function signInAs(userId: string | null): void {
  const session = userId
    ? { user: { id: userId, email: `${userId}@test.co`, name: "Test" }, expires: "2999-01-01T00:00:00.000Z" }
    : null;
  vi.mocked(auth as unknown as AuthFn).mockResolvedValue(session);
}
```

- [ ] **Step 7: Crear `vitest.config.mts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 8: Crear `vitest.integration.config.mts`**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/integration-global-setup.ts"],
    setupFiles: ["tests/setup/integration-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
```

- [ ] **Step 9: Agregar scripts en `package.json`** (dentro de `"scripts"`, después de `"lint"`)

```json
    "test": "pnpm test:unit && pnpm test:int",
    "test:unit": "vitest run --config vitest.config.mts",
    "test:int": "vitest run --config vitest.integration.config.mts",
    "test:e2e": "playwright test",
```

- [ ] **Step 10: Escribir pruebas de humo**

`tests/unit/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateBmi } from "@/core/nutrition/nutrition-calculator";

describe("entorno unitario", () => {
  it("resuelve el alias @ y ejecuta core", () => {
    expect(calculateBmi(70, 170)).toBe(24.2);
  });
});
```

`tests/integration/db-sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../support/db";

describe("entorno de integración", () => {
  it("usa el esquema test", async () => {
    const [row] = await prisma.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
    expect(row?.schema).toBe("test");
  });
});
```

- [ ] **Step 11: Ejecutar**

Run: `pnpm test:unit` → Expected: `1 passed`.
Run: `pnpm test:int` → Expected: prisma db push sobre el esquema `test` y `1 passed`.

- [ ] **Step 12: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.mts vitest.integration.config.mts tests
git commit -m "test: infraestructura Vitest con esquema test en Supabase"
```

---

### Task 2: Esquema de identidad, compatibilidad y seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `src/infrastructure/auth/auth.config.ts`, `src/types/next-auth.d.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/core/domain/entities/user.entity.ts`, `src/infrastructure/repositories/user.repository.impl.ts`
- Create: `tests/support/factories.ts`
- Test: `tests/integration/schema.test.ts`

**Interfaces:**
- Produces (Prisma): `Role { PATIENT PROFESSIONAL ADMIN }`, `ProfessionalStatus`, `AuditAction`; `User.roles Role[]`, `User.lastArea Role?`, `User.professionalProfile`; `Patient.userId String?`, `Patient.user`; modelos `ProfessionalProfile`, `PatientInvitation`, `ConsentDocument`, `PatientConsent`, `AuditLog`.
- Produces (tests): `createProfessional(opts?: { status?: ProfessionalStatus; extraRoles?: Role[]; name?: string })`, `createAdmin()`, `createPatientUser()`, `createAccount()`, `createPatientRecord(professionalId: string, data?: { userId?: string; firstName?: string })`, `createConsentDocument(version?: string)`.

- [ ] **Step 1: Reemplazar `enum Role` en `prisma/schema.prisma`**

```prisma
enum Role {
  PATIENT
  PROFESSIONAL
  ADMIN
}

enum ProfessionalStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

enum AuditAction {
  AUTH_LOGIN
  AUTH_LOGIN_FAILED
  PATIENT_RECORD_VIEWED
  PATIENT_CREATED
  PATIENT_UPDATED
  ASSESSMENT_CREATED
  MEAL_PLAN_CHANGED
  APPOINTMENT_CHANGED
  INVITATION_CREATED
  INVITATION_REVOKED
  INVITATION_ACCEPTED
  CONSENT_GRANTED
  CONSENT_REVOKED
  PROFESSIONAL_REGISTERED
  PROFESSIONAL_APPROVED
  PROFESSIONAL_REJECTED
  PROFESSIONAL_SUSPENDED
}
```

- [ ] **Step 2: Reemplazar `model User`**

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  roles         Role[]    @default([])
  lastArea      Role?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts            Account[]
  sessions            Session[]
  patients            Patient[]             @relation("PatientProfessional")
  patientRecords      Patient[]             @relation("PatientAccount")
  appointments        Appointment[]
  assessments         Assessment[]
  mealPlans           MealPlan[]
  professionalProfile ProfessionalProfile?  @relation("ProfileOwner")
  reviewedProfiles    ProfessionalProfile[] @relation("ProfileReviewer")
  invitationsCreated  PatientInvitation[]   @relation("InvitationCreator")
  invitationsAccepted PatientInvitation[]   @relation("InvitationAcceptor")
  consents            PatientConsent[]
  auditLogs           AuditLog[]

  @@map("users")
}
```

- [ ] **Step 3: Reemplazar `model Patient`**

```prisma
model Patient {
  id          String        @id @default(cuid())
  firstName   String
  lastName    String
  documentId  String?
  sex         Sex?
  email       String?
  phone       String?
  dateOfBirth DateTime?
  notes       String?
  status      PatientStatus @default(ACTIVE)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  professionalId String
  professional   User                @relation("PatientProfessional", fields: [professionalId], references: [id], onDelete: Cascade)
  userId         String?
  user           User?               @relation("PatientAccount", fields: [userId], references: [id], onDelete: SetNull)
  appointments   Appointment[]
  assessments    Assessment[]
  mealPlans      MealPlan[]
  invitations    PatientInvitation[]
  consents       PatientConsent[]
  auditLogs      AuditLog[]

  @@unique([professionalId, userId])
  @@map("patients")
}
```

- [ ] **Step 4: Agregar modelos nuevos al final de `prisma/schema.prisma`**

```prisma
model ProfessionalProfile {
  id              String             @id @default(cuid())
  licenseNumber   String
  status          ProfessionalStatus @default(PENDING)
  reviewedAt      DateTime?
  rejectionReason String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  userId       String  @unique
  user         User    @relation("ProfileOwner", fields: [userId], references: [id], onDelete: Cascade)
  reviewedById String?
  reviewedBy   User?   @relation("ProfileReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([status])
  @@map("professional_profiles")
}

model PatientInvitation {
  id         String    @id @default(cuid())
  tokenHash  String    @unique
  expiresAt  DateTime
  acceptedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  patientId    String
  patient      Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  createdById  String
  createdBy    User    @relation("InvitationCreator", fields: [createdById], references: [id], onDelete: Cascade)
  acceptedById String?
  acceptedBy   User?   @relation("InvitationAcceptor", fields: [acceptedById], references: [id], onDelete: SetNull)

  @@index([patientId])
  @@map("patient_invitations")
}

model ConsentDocument {
  id          String   @id @default(cuid())
  version     String   @unique
  body        String
  effectiveAt DateTime
  createdAt   DateTime @default(now())

  consents PatientConsent[]

  @@map("consent_documents")
}

model PatientConsent {
  id        String    @id @default(cuid())
  grantedAt DateTime  @default(now())
  ip        String?
  userAgent String?
  revokedAt DateTime?

  patientId  String
  patient    Patient         @relation(fields: [patientId], references: [id], onDelete: Cascade)
  userId     String
  user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  documentId String
  document   ConsentDocument @relation(fields: [documentId], references: [id])

  @@index([patientId, grantedAt])
  @@map("patient_consents")
}

model AuditLog {
  id         String      @id @default(cuid())
  actorRole  Role?
  action     AuditAction
  entityType String
  entityId   String?
  metadata   Json?
  ip         String?
  createdAt  DateTime    @default(now())

  actorId   String?
  actor     User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  patientId String?
  patient   Patient? @relation(fields: [patientId], references: [id], onDelete: SetNull)

  @@index([patientId, createdAt])
  @@index([actorId, createdAt])
  @@index([createdAt])
  @@map("audit_logs")
}
```

- [ ] **Step 5: Validar esquema**

Run: `pnpm exec prisma validate` → Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 6: Compatibilidad de auth — `src/types/next-auth.d.ts` (reemplazo completo)**

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

export {};
```

- [ ] **Step 7: `src/infrastructure/auth/auth.config.ts`** — en `authorize`, reemplazar el `return` por:

```ts
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
```

y reemplazar el bloque `callbacks` por:

```ts
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id;
      return session;
    },
  },
```

- [ ] **Step 8: Registro temporal en `src/app/api/auth/register/route.ts`** (se reemplaza en la Tarea 9). Reemplazar el `prisma.user.create` por:

```ts
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: ["PROFESSIONAL"],
        professionalProfile: { create: { licenseNumber: "SIN-REGISTRAR", status: "APPROVED" } },
      },
    });
```

- [ ] **Step 9: Entidad legada `src/core/domain/entities/user.entity.ts` (reemplazo completo)**

```ts
import { BaseEntity } from "./base.entity";

interface UserProps {
  email: string;
  name: string;
  image?: string;
  roles: UserRole[];
}

export enum UserRole {
  PATIENT = "PATIENT",
  PROFESSIONAL = "PROFESSIONAL",
  ADMIN = "ADMIN",
}

export class User extends BaseEntity<UserProps> {
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get image(): string | undefined { return this.props.image; }
  get roles(): UserRole[] { return this.props.roles; }

  public isAdmin(): boolean {
    return this.props.roles.includes(UserRole.ADMIN);
  }

  public isProfessional(): boolean {
    return this.props.roles.includes(UserRole.PROFESSIONAL);
  }

  public static create(props: UserProps, id: string, createdAt?: Date, updatedAt?: Date): User {
    return new User(props, id, createdAt, updatedAt);
  }
}
```

- [ ] **Step 10: `src/infrastructure/repositories/user.repository.impl.ts`** — reemplazar las tres apariciones:
  - en `create` y `update`: `role: user.role,` → `roles: user.roles,`
  - en `toDomain`: `role: (data.role as UserRole) ?? UserRole.USER,` → `roles: (data.roles as UserRole[]) ?? [],`

- [ ] **Step 11: Seed — `prisma/seed.ts`.** Agregar después de los `import`:

```ts
const CONSENT_V1_BODY = `BORRADOR — pendiente de revisión legal.

Autorización para el tratamiento de datos personales y datos de salud (Ley 1581 de 2012).

Al aceptar, autorizo de manera previa, expresa e informada a mi profesional de nutrición, a través de la plataforma Vianda, para recolectar, almacenar y usar mis datos personales y mis datos de salud (antropometría, valoraciones, planes alimentarios y registros que yo aporte) con la única finalidad de prestarme atención nutricional.

Entiendo que mis datos de salud son datos sensibles, que no estoy obligado(a) a autorizar su tratamiento, y que puedo conocer, actualizar, rectificar y revocar esta autorización en cualquier momento desde mi cuenta. La revocación corta mi acceso al portal; la ficha clínica que el profesional conserve se rige por las normas de historia clínica aplicables.`;
```

Reemplazar los dos `prisma.user.upsert` de usuarios por:

```ts
  const dev = await prisma.user.upsert({
    where: { email: "dev@gmail.com" },
    update: { name: "Dr. Desarrollador", password: devPassword, roles: ["PROFESSIONAL", "ADMIN"] },
    create: { email: "dev@gmail.com", name: "Dr. Desarrollador", password: devPassword, roles: ["PROFESSIONAL", "ADMIN"] },
  });

  await prisma.professionalProfile.upsert({
    where: { userId: dev.id },
    update: { status: "APPROVED", licenseNumber: "RETHUS-DEMO-0001", reviewedAt: new Date() },
    create: { userId: dev.id, status: "APPROVED", licenseNumber: "RETHUS-DEMO-0001", reviewedAt: new Date() },
  });

  const patientUser = await prisma.user.upsert({
    where: { email: "paciente@emuj.health" },
    update: { name: "María García", password: patientPassword, roles: ["PATIENT"] },
    create: { email: "paciente@emuj.health", name: "María García", password: patientPassword, roles: ["PATIENT"] },
  });

  const consentDocument = await prisma.consentDocument.upsert({
    where: { version: "2026-11-v1" },
    update: { body: CONSENT_V1_BODY },
    create: { version: "2026-11-v1", body: CONSENT_V1_BODY, effectiveAt: new Date("2026-11-01T00:00:00Z") },
  });
```

En el `prisma.patient.upsert` de María, agregar `userId: patientUser.id,` tanto en `update` como en `create`. Inmediatamente después del upsert de María, agregar:

```ts
  await prisma.patientConsent.deleteMany({ where: { patientId: patient.id } });
  await prisma.patientConsent.create({
    data: { patientId: patient.id, userId: patientUser.id, documentId: consentDocument.id, ip: "seed", userAgent: "seed" },
  });

  await prisma.patient.upsert({
    where: { id: "seed-patient-carlos" },
    update: { professionalId: dev.id },
    create: {
      id: "seed-patient-carlos",
      firstName: "Carlos",
      lastName: "Ruiz",
      sex: "MALE",
      dateOfBirth: new Date("1985-03-10"),
      phone: "+57 310 555 0101",
      notes: "Paciente demo sin cuenta — para probar invitaciones",
      professionalId: dev.id,
    },
  });
```

Agregar al final de los `console.log`:

```ts
  console.log("   Consentimiento v1, María vinculada a paciente@emuj.health, Carlos sin cuenta");
```

- [ ] **Step 12: Reiniciar BD de desarrollo (destructivo, aprobado en spec §6.6) y sembrar**

```bash
pnpm exec prisma db push --force-reset --accept-data-loss
pnpm db:seed
```

Expected: `Your database is now in sync` y `✅ Vianda seed completado`.

- [ ] **Step 13: Crear `tests/support/factories.ts`**

```ts
import type { ProfessionalStatus, Role } from "@prisma/client";
import { prisma } from "./db";

let sequence = 0;
const unique = () => `${Date.now()}-${++sequence}`;

export async function createProfessional(
  opts: { status?: ProfessionalStatus; extraRoles?: Role[]; name?: string } = {}
) {
  const status = opts.status ?? "APPROVED";
  const hasProfessionalRole = status === "APPROVED" || status === "SUSPENDED";
  return prisma.user.create({
    data: {
      email: `pro-${unique()}@test.co`,
      name: opts.name ?? "Pro Test",
      password: "x",
      roles: [...(hasProfessionalRole ? (["PROFESSIONAL"] as Role[]) : []), ...(opts.extraRoles ?? [])],
      professionalProfile: { create: { licenseNumber: `LIC-${unique()}`, status } },
    },
  });
}

export async function createAdmin() {
  return prisma.user.create({
    data: { email: `admin-${unique()}@test.co`, name: "Admin Test", password: "x", roles: ["ADMIN"] },
  });
}

export async function createPatientUser() {
  return prisma.user.create({
    data: { email: `pac-${unique()}@test.co`, name: "Paciente Test", password: "x", roles: ["PATIENT"] },
  });
}

export async function createAccount() {
  return prisma.user.create({
    data: { email: `acc-${unique()}@test.co`, name: "Cuenta Test", password: "x", roles: [] },
  });
}

export async function createPatientRecord(
  professionalId: string,
  data: { userId?: string; firstName?: string } = {}
) {
  return prisma.patient.create({
    data: {
      firstName: data.firstName ?? "Ana",
      lastName: "Paciente",
      sex: "FEMALE",
      dateOfBirth: new Date("1990-01-01"),
      professionalId,
      userId: data.userId,
    },
  });
}

export async function createConsentDocument(version = "test-v1") {
  return prisma.consentDocument.upsert({
    where: { version },
    update: {},
    create: { version, body: "Texto de prueba", effectiveAt: new Date("2020-01-01T00:00:00Z") },
  });
}
```

- [ ] **Step 14: Prueba de esquema `tests/integration/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../support/db";
import { createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

describe("esquema de identidad", () => {
  it("permite varios roles por cuenta", async () => {
    const pro = await createProfessional({ extraRoles: ["ADMIN"] });
    expect(pro.roles).toEqual(["PROFESSIONAL", "ADMIN"]);
  });

  it("impide dos fichas del mismo profesional vinculadas a la misma cuenta", async () => {
    const pro = await createProfessional();
    const account = await createPatientUser();
    await createPatientRecord(pro.id, { userId: account.id });
    await expect(createPatientRecord(pro.id, { userId: account.id })).rejects.toThrow();
  });

  it("permite varias fichas sin cuenta del mismo profesional", async () => {
    const pro = await createProfessional();
    await createPatientRecord(pro.id);
    await createPatientRecord(pro.id);
    expect(await prisma.patient.count({ where: { professionalId: pro.id } })).toBe(2);
  });
});
```

- [ ] **Step 15: Ejecutar pruebas y compilación**

Run: `pnpm test:int` → Expected: todas pasan.
Run: `pnpm exec tsc --noEmit 2>&1 | rg -v "^\.next/" | rg "error" ; echo done` → Expected: sólo `done`.

- [ ] **Step 16: Commit**

```bash
git add prisma src/infrastructure/auth src/types src/app/api/auth/register/route.ts src/core/domain src/infrastructure/repositories tests
git commit -m "feat(db): roles múltiples, perfil profesional, invitaciones, consentimiento y auditoría"
```

---

### Task 3: Políticas de acceso puras (`core/access`)

**Files:**
- Create: `src/core/access/types.ts`, `src/core/access/policies.ts`, `src/core/access/landing.ts`
- Test: `tests/unit/access/policies.test.ts`, `tests/unit/access/landing.test.ts`

**Interfaces:**
- Produces: tipos `Role`, `Area`, `ProfessionalStatus`, `Actor`, `PatientRecordRef`, `AuditScope`; funciones `hasRole`, `isApprovedProfessional`, `canAccessArea`, `canViewPatientRecord`, `canEditPatientRecord`, `canManageInvitations`, `canRevokeConsent`, `canReviewProfessionals`, `auditScope`; `AREA_PATHS`, `availableAreas`, `resolveLandingPath`.

- [ ] **Step 1: Escribir `tests/unit/access/policies.test.ts` (falla: módulo no existe)**

```ts
import { describe, expect, it } from "vitest";
import type { Actor, Area, PatientRecordRef, Role } from "@/core/access/types";
import {
  auditScope,
  canAccessArea,
  canEditPatientRecord,
  canManageInvitations,
  canReviewProfessionals,
  canRevokeConsent,
  canViewPatientRecord,
} from "@/core/access/policies";

function actor(roles: Role[], activeArea: Area | null, professionalStatus: Actor["professionalStatus"] = null): Actor {
  return { userId: "u1", roles, activeArea, professionalStatus };
}

const ownRecord: PatientRecordRef = { professionalId: "u1", userId: null, consentActive: false };
const otherRecord: PatientRecordRef = { professionalId: "u2", userId: null, consentActive: false };
const myPatientRecord: PatientRecordRef = { professionalId: "u2", userId: "u1", consentActive: true };

describe("canAccessArea", () => {
  it("profesional aprobado entra al área profesional", () => {
    expect(canAccessArea(actor(["PROFESSIONAL"], null, "APPROVED"), "PROFESSIONAL")).toBe(true);
  });
  it.each(["PENDING", "REJECTED", "SUSPENDED"] as const)("profesional %s no entra", (status) => {
    expect(canAccessArea(actor(["PROFESSIONAL"], null, status), "PROFESSIONAL")).toBe(false);
  });
  it("paciente entra al portal", () => {
    expect(canAccessArea(actor(["PATIENT"], null), "PATIENT")).toBe(true);
  });
  it("admin entra a administración y no al área profesional", () => {
    expect(canAccessArea(actor(["ADMIN"], null), "ADMIN")).toBe(true);
    expect(canAccessArea(actor(["ADMIN"], null), "PROFESSIONAL")).toBe(false);
  });
  it("cuenta sin roles no entra a ningún área", () => {
    for (const area of ["PATIENT", "PROFESSIONAL", "ADMIN"] as const) {
      expect(canAccessArea(actor([], null), area)).toBe(false);
    }
  });
});

describe("fichas clínicas", () => {
  const pro = actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED");

  it("profesional ve y edita sus fichas", () => {
    expect(canViewPatientRecord(pro, ownRecord)).toBe(true);
    expect(canEditPatientRecord(pro, ownRecord)).toBe(true);
    expect(canManageInvitations(pro, ownRecord)).toBe(true);
  });
  it("profesional no ve ni edita fichas ajenas", () => {
    expect(canViewPatientRecord(pro, otherRecord)).toBe(false);
    expect(canEditPatientRecord(pro, otherRecord)).toBe(false);
    expect(canManageInvitations(pro, otherRecord)).toBe(false);
  });
  it("profesional suspendido no ve sus fichas", () => {
    expect(canViewPatientRecord(actor(["PROFESSIONAL"], "PROFESSIONAL", "SUSPENDED"), ownRecord)).toBe(false);
  });
  it("admin + profesional actuando como admin no ve fichas", () => {
    const both = actor(["PROFESSIONAL", "ADMIN"], "ADMIN", "APPROVED");
    expect(canViewPatientRecord(both, ownRecord)).toBe(false);
    expect(canEditPatientRecord(both, ownRecord)).toBe(false);
  });
  it("admin puro nunca ve fichas", () => {
    expect(canViewPatientRecord(actor(["ADMIN"], "ADMIN"), otherRecord)).toBe(false);
  });
  it("paciente ve su ficha sólo con consentimiento vigente", () => {
    const patient = actor(["PATIENT"], "PATIENT");
    expect(canViewPatientRecord(patient, myPatientRecord)).toBe(true);
    expect(canViewPatientRecord(patient, { ...myPatientRecord, consentActive: false })).toBe(false);
  });
  it("paciente nunca edita ni invita", () => {
    const patient = actor(["PATIENT"], "PATIENT");
    expect(canEditPatientRecord(patient, myPatientRecord)).toBe(false);
    expect(canManageInvitations(patient, myPatientRecord)).toBe(false);
  });
  it("paciente no ve fichas de otra cuenta", () => {
    expect(canViewPatientRecord(actor(["PATIENT"], "PATIENT"), { ...myPatientRecord, userId: "u9" })).toBe(false);
  });
});

describe("consentimiento y revisión", () => {
  it("paciente revoca sólo su propio consentimiento", () => {
    const patient = actor(["PATIENT"], "PATIENT");
    expect(canRevokeConsent(patient, myPatientRecord)).toBe(true);
    expect(canRevokeConsent(patient, { ...myPatientRecord, userId: "u9" })).toBe(false);
    expect(canRevokeConsent(patient, { ...myPatientRecord, userId: null })).toBe(false);
  });
  it("profesional no revoca consentimientos", () => {
    expect(canRevokeConsent(actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED"), myPatientRecord)).toBe(false);
  });
  it("sólo admin actuando como admin revisa profesionales", () => {
    expect(canReviewProfessionals(actor(["ADMIN"], "ADMIN"))).toBe(true);
    expect(canReviewProfessionals(actor(["ADMIN", "PROFESSIONAL"], "PROFESSIONAL", "APPROVED"))).toBe(false);
    expect(canReviewProfessionals(actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED"))).toBe(false);
  });
});

describe("auditScope", () => {
  it("admin ve toda la auditoría, profesional la de sus fichas, paciente nada", () => {
    expect(auditScope(actor(["ADMIN"], "ADMIN"))).toBe("ALL");
    expect(auditScope(actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED"))).toBe("OWN_RECORDS");
    expect(auditScope(actor(["PATIENT"], "PATIENT"))).toBe("NONE");
  });
});
```

- [ ] **Step 2: Escribir `tests/unit/access/landing.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { availableAreas, resolveLandingPath } from "@/core/access/landing";

describe("availableAreas", () => {
  it("ordena profesional, paciente, admin", () => {
    expect(availableAreas({ roles: ["ADMIN", "PATIENT", "PROFESSIONAL"], professionalStatus: "APPROVED" })).toEqual([
      "PROFESSIONAL",
      "PATIENT",
      "ADMIN",
    ]);
  });
  it("excluye el área profesional si no está aprobado", () => {
    expect(availableAreas({ roles: ["PROFESSIONAL", "ADMIN"], professionalStatus: "SUSPENDED" })).toEqual(["ADMIN"]);
  });
});

describe("resolveLandingPath", () => {
  it("usa lastArea si sigue disponible", () => {
    expect(resolveLandingPath({ roles: ["PROFESSIONAL", "ADMIN"], professionalStatus: "APPROVED", lastArea: "ADMIN" })).toBe("/admin");
  });
  it("ignora lastArea no disponible", () => {
    expect(resolveLandingPath({ roles: ["PATIENT"], professionalStatus: null, lastArea: "ADMIN" })).toBe("/portal");
  });
  it("prioriza el área profesional", () => {
    expect(resolveLandingPath({ roles: ["PATIENT", "PROFESSIONAL"], professionalStatus: "APPROVED", lastArea: null })).toBe("/dashboard");
  });
  it("sin áreas disponibles va a /pending", () => {
    expect(resolveLandingPath({ roles: [], professionalStatus: "PENDING", lastArea: null })).toBe("/pending");
    expect(resolveLandingPath({ roles: [], professionalStatus: null, lastArea: null })).toBe("/pending");
  });
});
```

- [ ] **Step 3: Ejecutar y verificar que fallan**

Run: `pnpm test:unit` → Expected: FAIL `Failed to resolve import "@/core/access/types"`.

- [ ] **Step 4: Crear `src/core/access/types.ts`**

```ts
export const ROLES = ["PATIENT", "PROFESSIONAL", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];
export type Area = Role;
export type ProfessionalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface Actor {
  userId: string;
  roles: readonly Role[];
  activeArea: Area | null;
  professionalStatus: ProfessionalStatus | null;
}

export interface PatientRecordRef {
  professionalId: string;
  userId: string | null;
  consentActive: boolean;
}

export type AuditScope = "ALL" | "OWN_RECORDS" | "NONE";
```

- [ ] **Step 5: Crear `src/core/access/policies.ts`**

```ts
import type { Actor, Area, AuditScope, PatientRecordRef, Role } from "./types";

export function hasRole(actor: Pick<Actor, "roles">, role: Role): boolean {
  return actor.roles.includes(role);
}

export function isApprovedProfessional(actor: Pick<Actor, "roles" | "professionalStatus">): boolean {
  return hasRole(actor, "PROFESSIONAL") && actor.professionalStatus === "APPROVED";
}

export function canAccessArea(actor: Pick<Actor, "roles" | "professionalStatus">, area: Area): boolean {
  switch (area) {
    case "PROFESSIONAL":
      return isApprovedProfessional(actor);
    case "PATIENT":
      return hasRole(actor, "PATIENT");
    case "ADMIN":
      return hasRole(actor, "ADMIN");
  }
}

function actingAs(actor: Actor, area: Area): boolean {
  return actor.activeArea === area && canAccessArea(actor, area);
}

function ownsRecord(actor: Actor, record: PatientRecordRef): boolean {
  return record.professionalId === actor.userId;
}

export function canViewPatientRecord(actor: Actor, record: PatientRecordRef): boolean {
  if (actingAs(actor, "PROFESSIONAL") && ownsRecord(actor, record)) return true;
  return actingAs(actor, "PATIENT") && record.userId === actor.userId && record.consentActive;
}

export function canEditPatientRecord(actor: Actor, record: PatientRecordRef): boolean {
  return actingAs(actor, "PROFESSIONAL") && ownsRecord(actor, record);
}

export function canManageInvitations(actor: Actor, record: PatientRecordRef): boolean {
  return canEditPatientRecord(actor, record);
}

export function canRevokeConsent(actor: Actor, record: PatientRecordRef): boolean {
  return actingAs(actor, "PATIENT") && record.userId !== null && record.userId === actor.userId;
}

export function canReviewProfessionals(actor: Actor): boolean {
  return actingAs(actor, "ADMIN");
}

export function auditScope(actor: Actor): AuditScope {
  if (actingAs(actor, "ADMIN")) return "ALL";
  if (actingAs(actor, "PROFESSIONAL")) return "OWN_RECORDS";
  return "NONE";
}
```

- [ ] **Step 6: Crear `src/core/access/landing.ts`**

```ts
import { canAccessArea } from "./policies";
import type { Actor, Area } from "./types";

export const AREA_PATHS: Record<Area, string> = {
  PROFESSIONAL: "/dashboard",
  PATIENT: "/portal",
  ADMIN: "/admin",
};

const AREA_PRIORITY: readonly Area[] = ["PROFESSIONAL", "PATIENT", "ADMIN"];

export function availableAreas(actor: Pick<Actor, "roles" | "professionalStatus">): Area[] {
  return AREA_PRIORITY.filter((area) => canAccessArea(actor, area));
}

export function resolveLandingPath(input: Pick<Actor, "roles" | "professionalStatus"> & { lastArea: Area | null }): string {
  const areas = availableAreas(input);
  if (input.lastArea && areas.includes(input.lastArea)) return AREA_PATHS[input.lastArea];
  const first = areas[0];
  return first ? AREA_PATHS[first] : "/pending";
}
```

- [ ] **Step 7: Ejecutar**

Run: `pnpm test:unit` → Expected: todas pasan.

- [ ] **Step 8: Commit**

```bash
git add src/core/access tests/unit/access
git commit -m "feat(access): políticas puras de acceso y resolución de área"
```

---

### Task 4: Tokens de invitación (`core/invitations`)

**Files:**
- Create: `src/core/invitations/invitation-token.ts`
- Test: `tests/unit/invitations/invitation-token.test.ts`

**Interfaces:**
- Produces: `INVITATION_TTL_DAYS = 7`; `generateInvitationToken(): string`; `hashInvitationToken(token: string): string`; `invitationExpiry(now: Date): Date`; `type InvitationState = "VALID" | "EXPIRED" | "USED" | "REVOKED"`; `invitationState(inv: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null }, now: Date): InvitationState`.

- [ ] **Step 1: Escribir la prueba**

```ts
import { describe, expect, it } from "vitest";
import {
  INVITATION_TTL_DAYS,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
} from "@/core/invitations/invitation-token";

const now = new Date("2026-11-04T12:00:00Z");

describe("tokens de invitación", () => {
  it("genera tokens base64url de 43 caracteres y distintos", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("el hash es SHA-256 hex, determinista y no contiene el token", () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInvitationToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("vence a los 7 días", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(invitationExpiry(now).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("invitationState", () => {
  const base = { expiresAt: invitationExpiry(now), acceptedAt: null, revokedAt: null };

  it("válida antes de vencer", () => {
    expect(invitationState(base, now)).toBe("VALID");
  });
  it("vencida en el instante de vencimiento", () => {
    expect(invitationState(base, base.expiresAt)).toBe("EXPIRED");
  });
  it("usada tiene prioridad sobre vencida", () => {
    expect(invitationState({ ...base, acceptedAt: now }, new Date("2027-01-01"))).toBe("USED");
  });
  it("revocada", () => {
    expect(invitationState({ ...base, revokedAt: now }, now)).toBe("REVOKED");
  });
});
```

Guardar en `tests/unit/invitations/invitation-token.test.ts`.

- [ ] **Step 2: Ejecutar** — Run: `pnpm test:unit` → Expected: FAIL por import inexistente.

- [ ] **Step 3: Implementar `src/core/invitations/invitation-token.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_DAYS = 7;

export type InvitationState = "VALID" | "EXPIRED" | "USED" | "REVOKED";

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function invitationState(
  invitation: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now: Date
): InvitationState {
  if (invitation.acceptedAt) return "USED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "VALID";
}
```

- [ ] **Step 4: Ejecutar** — Run: `pnpm test:unit` → Expected: todas pasan.

- [ ] **Step 5: Commit**

```bash
git add src/core/invitations tests/unit/invitations
git commit -m "feat(invitations): tokens de un solo uso con hash SHA-256"
```

---

### Task 5: Auditoría

**Files:**
- Create: `src/core/audit/audit.ts`
- Create: `src/infrastructure/audit/audit-logger.ts`
- Create: `src/infrastructure/http/request-meta.ts`
- Test: `tests/integration/audit.test.ts`

**Interfaces:**
- Produces: `AUDIT_ACTIONS`, `type AuditAction`, `interface AuditEntry { actorId: string | null; actorRole: Role | null; action: AuditAction; entityType: string; entityId?: string | null; patientId?: string | null; metadata?: Record<string, unknown>; ip?: string | null }`; `type AuditDb = Prisma.TransactionClient | PrismaClient`; `recordAudit(entry: AuditEntry, db?: AuditDb): Promise<void>`; `recordAuditBestEffort(entry: AuditEntry): Promise<void>`; `getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }>`; `getRequestOrigin(): Promise<string>`.

- [ ] **Step 1: Escribir `tests/integration/audit.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { AuditAction as PrismaAuditAction } from "@prisma/client";
import { AUDIT_ACTIONS } from "@/core/audit/audit";
import { recordAudit, recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

describe("auditoría", () => {
  it("la lista de acciones de core coincide con el enum de Prisma", () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual(Object.values(PrismaAuditAction).sort());
  });

  it("registra una entrada con paciente y metadata", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await recordAudit({
      actorId: pro.id,
      actorRole: "PROFESSIONAL",
      action: "PATIENT_RECORD_VIEWED",
      entityType: "Patient",
      entityId: patient.id,
      patientId: patient.id,
      metadata: { source: "test" },
      ip: "203.0.113.7",
    });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(log).toMatchObject({ action: "PATIENT_RECORD_VIEWED", actorRole: "PROFESSIONAL", ip: "203.0.113.7" });
    expect(log.metadata).toEqual({ source: "test" });
  });

  it("recordAudit dentro de una transacción fallida no deja rastro", async () => {
    const pro = await createProfessional();
    await expect(
      prisma.$transaction(async (tx) => {
        await recordAudit({ actorId: pro.id, actorRole: null, action: "INVITATION_CREATED", entityType: "PatientInvitation" }, tx);
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("best effort no lanza si la escritura falla", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAuditBestEffort({ actorId: "no-existe", actorRole: null, action: "AUTH_LOGIN", entityType: "User" })
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Ejecutar** — Run: `pnpm test:int` → Expected: FAIL por imports inexistentes.

- [ ] **Step 3: Crear `src/core/audit/audit.ts`**

```ts
import type { Role } from "@/core/access/types";

export const AUDIT_ACTIONS = [
  "AUTH_LOGIN",
  "AUTH_LOGIN_FAILED",
  "PATIENT_RECORD_VIEWED",
  "PATIENT_CREATED",
  "PATIENT_UPDATED",
  "ASSESSMENT_CREATED",
  "MEAL_PLAN_CHANGED",
  "APPOINTMENT_CHANGED",
  "INVITATION_CREATED",
  "INVITATION_REVOKED",
  "INVITATION_ACCEPTED",
  "CONSENT_GRANTED",
  "CONSENT_REVOKED",
  "PROFESSIONAL_REGISTERED",
  "PROFESSIONAL_APPROVED",
  "PROFESSIONAL_REJECTED",
  "PROFESSIONAL_SUSPENDED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  actorId: string | null;
  actorRole: Role | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}
```

- [ ] **Step 4: Crear `src/infrastructure/audit/audit-logger.ts`**

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditEntry } from "@/core/audit/audit";
import { prisma } from "@/infrastructure/database/prisma";

export type AuditDb = Prisma.TransactionClient | PrismaClient;

export async function recordAudit(entry: AuditEntry, db: AuditDb = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      patientId: entry.patientId ?? null,
      metadata: entry.metadata ? (entry.metadata as Prisma.InputJsonValue) : undefined,
      ip: entry.ip ?? null,
    },
  });
}

export async function recordAuditBestEffort(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(entry);
  } catch (error) {
    console.error(`[audit] no se pudo registrar ${entry.action}`, error);
  }
}
```

- [ ] **Step 5: Crear `src/infrastructure/http/request-meta.ts`**

```ts
import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
```

- [ ] **Step 6: Ejecutar** — Run: `pnpm test:int` → Expected: todas pasan.

- [ ] **Step 7: Commit**

```bash
git add src/core/audit src/infrastructure/audit src/infrastructure/http tests/integration/audit.test.ts
git commit -m "feat(audit): registro transaccional y de mejor esfuerzo"
```

---

### Task 6: Contexto de acceso por petición

**Files:**
- Create: `src/infrastructure/access/access-context.ts`
- Test: `tests/integration/access-context.test.ts`

**Interfaces:**
- Consumes: `canAccessArea` (Tarea 3), `auth` de `@/infrastructure/auth/auth`.
- Produces: `class AccessDeniedError extends Error`; `loadActor(userId: string, activeArea: Area | null): Promise<Actor | null>`; `getSessionActor(): Promise<Actor | null>`; `getActorFor(area: Area): Promise<Actor | null>`; `requireActorFor(area: Area): Promise<Actor>`.

- [ ] **Step 1: Escribir `tests/integration/access-context.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  getActorFor,
  getSessionActor,
  requireActorFor,
} from "@/infrastructure/access/access-context";
import { prisma } from "../support/db";
import { createAdmin, createPatientUser, createProfessional } from "../support/factories";
import { signInAs } from "../support/session";

describe("access-context", () => {
  it("sin sesión no hay actor", async () => {
    signInAs(null);
    expect(await getSessionActor()).toBeNull();
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
  });

  it("profesional aprobado obtiene actor con área activa", async () => {
    const pro = await createProfessional();
    signInAs(pro.id);
    expect(await getActorFor("PROFESSIONAL")).toEqual({
      userId: pro.id,
      roles: ["PROFESSIONAL"],
      activeArea: "PROFESSIONAL",
      professionalStatus: "APPROVED",
    });
  });

  it("profesional pendiente no obtiene actor profesional", async () => {
    const pro = await createProfessional({ status: "PENDING" });
    signInAs(pro.id);
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
    await expect(requireActorFor("PROFESSIONAL")).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("la suspensión surte efecto inmediato (lee BD, no JWT)", async () => {
    const pro = await createProfessional();
    signInAs(pro.id);
    expect(await getActorFor("PROFESSIONAL")).not.toBeNull();
    await prisma.professionalProfile.update({ where: { userId: pro.id }, data: { status: "SUSPENDED" } });
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
  });

  it("admin no obtiene actor profesional; paciente no obtiene admin", async () => {
    const admin = await createAdmin();
    signInAs(admin.id);
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
    expect(await getActorFor("ADMIN")).not.toBeNull();

    const patient = await createPatientUser();
    signInAs(patient.id);
    expect(await getActorFor("ADMIN")).toBeNull();
    expect(await getActorFor("PATIENT")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar** — Run: `pnpm test:int` → Expected: FAIL por import inexistente.

- [ ] **Step 3: Implementar `src/infrastructure/access/access-context.ts`**

```ts
import { cache } from "react";
import { canAccessArea } from "@/core/access/policies";
import type { Actor, Area } from "@/core/access/types";
import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";

export class AccessDeniedError extends Error {
  constructor() {
    super("No autorizado");
    this.name = "AccessDeniedError";
  }
}

export async function loadActor(userId: string, activeArea: Area | null): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: true, professionalProfile: { select: { status: true } } },
  });
  if (!user) return null;
  return {
    userId: user.id,
    roles: user.roles,
    activeArea,
    professionalStatus: user.professionalProfile?.status ?? null,
  };
}

const loadSessionActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? loadActor(userId, null) : null;
});

export async function getSessionActor(): Promise<Actor | null> {
  return loadSessionActor();
}

export async function getActorFor(area: Area): Promise<Actor | null> {
  const base = await loadSessionActor();
  if (!base) return null;
  const actor: Actor = { ...base, activeArea: area };
  return canAccessArea(actor, area) ? actor : null;
}

export async function requireActorFor(area: Area): Promise<Actor> {
  const actor = await getActorFor(area);
  if (!actor) throw new AccessDeniedError();
  return actor;
}
```

- [ ] **Step 4: Ejecutar** — Run: `pnpm test:int` → Expected: todas pasan.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/access tests/integration/access-context.test.ts
git commit -m "feat(access): contexto de acceso con roles leídos de la BD"
```

---

### Task 7: Sesión, proxy, aterrizaje `/start` y login con auditoría

**Files:**
- Create: `src/features/identity/verify-credentials.ts`
- Modify: `src/infrastructure/auth/auth.config.ts` (authorize)
- Modify: `src/infrastructure/auth/auth.ts` (authorized)
- Delete: `src/middleware.ts` · Create: `src/proxy.ts`
- Create: `src/app/start/page.tsx`
- Create: `src/features/identity/components/login-form.tsx` · Modify: `src/app/(auth)/login/page.tsx`
- Create: `src/shared/ui/brand/logo.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (guard de área)
- Test: `tests/integration/verify-credentials.test.ts`

**Interfaces:**
- Consumes: `recordAuditBestEffort` (T5), `resolveLandingPath` (T3), `getActorFor` (T6).
- Produces: `verifyCredentials(email: string, password: string, ip: string | null): Promise<{ id: string; email: string; name: string | null } | null>`; ruta `/start`; login acepta `?callbackUrl=/ruta`.

- [ ] **Step 1: Leer la guía de proxy** — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (secciones *Exports* y *Migration to Proxy*).

- [ ] **Step 2: Escribir `tests/integration/verify-credentials.test.ts`**

```ts
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { verifyCredentials } from "@/features/identity/verify-credentials";
import { prisma } from "../support/db";

describe("verifyCredentials", () => {
  it("acepta credenciales válidas y audita AUTH_LOGIN", async () => {
    const user = await prisma.user.create({
      data: { email: "login@test.co", name: "Login", password: await bcrypt.hash("Secreta1!", 4), roles: [] },
    });
    expect(await verifyCredentials("Login@Test.co ", "Secreta1!", "203.0.113.7")).toEqual({
      id: user.id,
      email: "login@test.co",
      name: "Login",
    });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "AUTH_LOGIN" } });
    expect(log).toMatchObject({ actorId: user.id, ip: "203.0.113.7" });
  });

  it("rechaza contraseña incorrecta y audita AUTH_LOGIN_FAILED", async () => {
    await prisma.user.create({
      data: { email: "fail@test.co", password: await bcrypt.hash("Secreta1!", 4), roles: [] },
    });
    expect(await verifyCredentials("fail@test.co", "otra", null)).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "AUTH_LOGIN_FAILED" } })).toBe(1);
  });

  it("rechaza email inexistente sin actor", async () => {
    expect(await verifyCredentials("nadie@test.co", "x", null)).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "AUTH_LOGIN_FAILED" } });
    expect(log.actorId).toBeNull();
  });
});
```

- [ ] **Step 3: Ejecutar** — Run: `pnpm test:int` → Expected: FAIL por import inexistente.

- [ ] **Step 4: Crear `src/features/identity/verify-credentials.ts`**

```ts
import bcrypt from "bcryptjs";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export async function verifyCredentials(
  email: string,
  password: string,
  ip: string | null
): Promise<{ id: string; email: string; name: string | null } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const valid = user?.password ? await bcrypt.compare(password, user.password) : false;

  if (!user || !valid) {
    await recordAuditBestEffort({
      actorId: user?.id ?? null,
      actorRole: null,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id ?? null,
      metadata: { email: normalizedEmail },
      ip,
    });
    return null;
  }

  await recordAuditBestEffort({
    actorId: user.id,
    actorRole: null,
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: user.id,
    ip,
  });
  return { id: user.id, email: user.email, name: user.name };
}
```

- [ ] **Step 5: `src/infrastructure/auth/auth.config.ts` (reemplazo completo)**

```ts
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/features/identity/verify-credentials";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        return verifyCredentials(credentials.email as string, credentials.password as string, ip);
      },
    }),
  ],
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id;
      return session;
    },
  },
};
```

- [ ] **Step 6: `src/infrastructure/auth/auth.ts` (reemplazo completo)**

```ts
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/admin", "/pending", "/start"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      if (isProtected && !auth?.user) {
        const loginUrl = new URL("/login", request.nextUrl);
        loginUrl.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(loginUrl);
      }
      return true;
    },
  },
});
```

- [ ] **Step 7: Proxy** — borrar `src/middleware.ts` y crear `src/proxy.ts`:

```ts
export { auth as proxy } from "@/infrastructure/auth/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/admin/:path*", "/pending", "/start"],
};
```

- [ ] **Step 8: Crear `src/app/start/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { resolveLandingPath } from "@/core/access/landing";
import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";

export default async function StartPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true, lastArea: true, professionalProfile: { select: { status: true } } },
  });
  if (!user) redirect("/login");

  redirect(
    resolveLandingPath({
      roles: user.roles,
      lastArea: user.lastArea,
      professionalStatus: user.professionalProfile?.status ?? null,
    })
  );
}
```

- [ ] **Step 9: Crear `src/features/identity/components/login-form.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/shared/ui/components";

function safeCallbackUrl(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/start";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="min-h-11"
          required
        />
        <Input
          label="Contraseña"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="min-h-11"
          required
        />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full min-h-11" size="lg" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted mt-6">
        ¿Eres nutricionista y no tienes cuenta?{" "}
        <Link href="/register" className="text-primary hover:underline font-medium">
          Regístrate
        </Link>
      </p>
    </>
  );
}
```

- [ ] **Step 10: `src/app/(auth)/login/page.tsx` (reemplazo completo)**

```tsx
import { Suspense } from "react";
import { LoginForm } from "@/features/identity/components/login-form";
import { Logo } from "@/shared/ui/brand/logo";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center gradient-wellness px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-xl border border-border">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo />
          <p className="text-muted mt-3">Inicia sesión en tu cuenta</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
```

Crear también `src/shared/ui/brand/logo.tsx` (la Tarea 8 lo reutiliza):

```tsx
import { cn } from "@/shared/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#2A9D8F" />
      <path d="M18 20 L32 46 L46 20" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="15" r="5" fill="#F4A261" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="text-xl font-bold text-text">
        Via<span className="text-primary">nda</span>
      </span>
    </span>
  );
}
```

- [ ] **Step 11: Guard de área en `src/app/(dashboard)/layout.tsx`** — después de `if (!session?.user) redirect("/login");` agregar:

```ts
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) redirect("/start");
```

y el import `import { getActorFor } from "@/infrastructure/access/access-context";`.

- [ ] **Step 12: Ejecutar pruebas** — Run: `pnpm test` → Expected: todas pasan.

- [ ] **Step 13: Verificación manual** (con `pnpm dev`)

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/dashboard
```

Expected: `307 http://localhost:3000/login?callbackUrl=%2Fdashboard`. El log del servidor no muestra la advertencia `"middleware" file convention is deprecated`. Iniciar sesión con `dev@gmail.com` lleva a `/dashboard`; con `paciente@emuj.health` lleva a `/start` → `/portal` (404 hasta la Tarea 14; esperado).

- [ ] **Step 14: Commit**

```bash
git add src/features/identity src/infrastructure/auth src/proxy.ts src/middleware.ts src/app/start src/app/\(auth\)/login src/app/\(dashboard\)/layout.tsx src/shared/ui/brand tests/integration/verify-credentials.test.ts
git commit -m "feat(auth): proxy sin roles, aterrizaje /start, login auditado con callbackUrl"
```

---

### Task 8: Navegación responsive y marca

**Files:**
- Create: `src/app/icon.svg`, `src/app/apple-icon.tsx`, `src/app/manifest.ts` · Delete: `src/app/favicon.ico`
- Modify: `src/app/layout.tsx` (viewport)
- Create: `src/shared/ui/navigation/app-shell.tsx`
- Create: `src/features/identity/navigation.ts`, `src/features/identity/session-actions.ts`
- Modify: `src/app/(dashboard)/layout.tsx` (usar AppShell)
- Test: `tests/unit/identity/navigation.test.ts`

**Interfaces:**
- Consumes: `availableAreas`, `AREA_PATHS` (T3); `getActorFor` (T6); `signOut` (auth).
- Produces: `Logo`, `LogoMark`; `type NavIconName = "home" | "users" | "calendar" | "calculator" | "shield" | "heart"`; `interface NavItem { href: string; label: string; icon: NavIconName; exact?: boolean }`; `AREA_LABELS`, `PROFESSIONAL_NAV`, `PATIENT_NAV`, `ADMIN_NAV`, `areaLinks(actor: Actor, current: Area): { area: Area; label: string; active: boolean }[]`; `AppShell` props `{ areaLabel; items; areas; user: { name: string | null; email: string | null }; switchAreaAction: (formData: FormData) => Promise<void>; signOutAction: () => Promise<void>; children }`; server actions `signOutAction()`, `switchAreaAction(formData)`.
- Accesibilidad que usan las E2E: `nav[aria-label="Navegación principal"]` (barra inferior), botón **Cuenta**, diálogo `aria-label="Cuenta"` con botones de área (`Consulta`, `Mi salud`, `Administración`) y **Cerrar sesión**.

- [ ] **Step 1: Instalar iconos** — `pnpm add lucide-react`

- [ ] **Step 2: Marca** — `src/shared/ui/brand/logo.tsx` ya existe (Tarea 7, Step 10); confirmar que exporta `Logo` y `LogoMark`.

- [ ] **Step 3: Íconos de app.** Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md` y `manifest.md`. Borrar `src/app/favicon.ico`. Crear `src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2A9D8F"/><path d="M18 20 L32 46 L46 20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="47" cy="15" r="5" fill="#F4A261"/></svg>
```

`src/app/apple-icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2A9D8F",
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        V
      </div>
    ),
    size
  );
}
```

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vianda — Nutrición clínica",
    short_name: "Vianda",
    start_url: "/start",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2A9D8F",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 4: Viewport en `src/app/layout.tsx`** — cambiar el import a `import type { Metadata, Viewport } from "next";` y agregar tras `metadata`:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2A9D8F",
};
```

- [ ] **Step 5: Prueba `tests/unit/identity/navigation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { areaLinks } from "@/features/identity/navigation";

describe("areaLinks", () => {
  it("lista sólo áreas disponibles y marca la actual", () => {
    expect(
      areaLinks({ userId: "u", roles: ["PROFESSIONAL", "ADMIN"], activeArea: "ADMIN", professionalStatus: "APPROVED" }, "ADMIN")
    ).toEqual([
      { area: "PROFESSIONAL", label: "Consulta", active: false },
      { area: "ADMIN", label: "Administración", active: true },
    ]);
  });
});
```

Run: `pnpm test:unit` → Expected: FAIL por import inexistente.

- [ ] **Step 6: Crear `src/features/identity/navigation.ts`**

```ts
import { availableAreas } from "@/core/access/landing";
import type { Actor, Area } from "@/core/access/types";

export type NavIconName = "home" | "users" | "calendar" | "calculator" | "shield" | "heart";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  exact?: boolean;
}

export const AREA_LABELS: Record<Area, string> = {
  PROFESSIONAL: "Consulta",
  PATIENT: "Mi salud",
  ADMIN: "Administración",
};

export const PROFESSIONAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "home", exact: true },
  { href: "/dashboard/patients", label: "Pacientes", icon: "users" },
  { href: "/dashboard/appointments", label: "Citas", icon: "calendar" },
  { href: "/dashboard/tools", label: "Herramientas", icon: "calculator" },
];

export const PATIENT_NAV: NavItem[] = [{ href: "/portal", label: "Inicio", icon: "heart", exact: true }];

export const ADMIN_NAV: NavItem[] = [{ href: "/admin/professionals", label: "Profesionales", icon: "shield" }];

export function areaLinks(actor: Actor, current: Area): { area: Area; label: string; active: boolean }[] {
  return availableAreas(actor).map((area) => ({ area, label: AREA_LABELS[area], active: area === current }));
}
```

Run: `pnpm test:unit` → Expected: pasa.

- [ ] **Step 7: Crear `src/features/identity/session-actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { AREA_PATHS } from "@/core/access/landing";
import type { Area } from "@/core/access/types";
import { getActorFor } from "@/infrastructure/access/access-context";
import { signOut } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";

function isArea(value: FormDataEntryValue | null): value is Area {
  return value === "PROFESSIONAL" || value === "PATIENT" || value === "ADMIN";
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function switchAreaAction(formData: FormData): Promise<void> {
  const area = formData.get("area");
  if (!isArea(area)) redirect("/start");
  const actor = await getActorFor(area);
  if (!actor) redirect("/start");
  await prisma.user.update({ where: { id: actor.userId }, data: { lastArea: area } });
  redirect(AREA_PATHS[area]);
}
```

- [ ] **Step 8: Crear `src/shared/ui/navigation/app-shell.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Calculator,
  CalendarDays,
  HeartPulse,
  House,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Area } from "@/core/access/types";
import type { NavIconName, NavItem } from "@/features/identity/navigation";
import { Logo } from "@/shared/ui/brand/logo";
import { cn } from "@/shared/lib/utils";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: House,
  users: Users,
  calendar: CalendarDays,
  calculator: Calculator,
  shield: ShieldCheck,
  heart: HeartPulse,
};

interface AppShellProps {
  areaLabel: string;
  items: NavItem[];
  areas: { area: Area; label: string; active: boolean }[];
  user: { name: string | null; email: string | null };
  switchAreaAction: (formData: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ areaLabel, items, areas, user, switchAreaAction, signOutAction, children }: AppShellProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const initial = user.name?.[0]?.toUpperCase() ?? "V";

  const accountPanel = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary-light flex items-center justify-center text-primary font-semibold">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text truncate">{user.name}</p>
          <p className="text-xs text-muted truncate">{user.email}</p>
        </div>
      </div>
      {areas.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Cambiar de área</p>
          {areas.map((a) => (
            <form key={a.area} action={switchAreaAction}>
              <input type="hidden" name="area" value={a.area} />
              <button
                type="submit"
                disabled={a.active}
                className={cn(
                  "w-full min-h-11 rounded-xl px-4 text-left text-sm font-medium border",
                  a.active ? "border-primary bg-primary-light text-primary" : "border-border text-text hover:bg-primary-light"
                )}
              >
                {a.label}
              </button>
            </form>
          ))}
        </div>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full min-h-11 rounded-xl px-4 flex items-center gap-2 text-sm font-medium text-danger border border-border hover:bg-danger/5"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background md:flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="p-6 border-b border-border">
          <Logo />
          <p className="text-xs text-muted mt-2">{areaLabel}</p>
        </div>
        <nav aria-label="Navegación lateral" className="flex-1 p-4 space-y-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors",
                  active ? "bg-primary-light text-primary" : "text-muted hover:bg-primary-light hover:text-primary"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">{accountPanel}</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur px-4 py-3 flex items-center justify-between">
          <Logo />
          <span className="text-xs font-medium text-muted">{areaLabel}</span>
        </header>

        <main className="flex-1 p-4 pb-28 md:p-8 md:pb-8">{children}</main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="flex w-full min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
              Cuenta
            </button>
          </li>
        </ul>
      </nav>

      {accountOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setAccountOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cuenta"
            className="w-full rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-text">Cuenta</p>
              <button
                type="button"
                onClick={() => setAccountOpen(false)}
                aria-label="Cerrar"
                className="h-11 w-11 flex items-center justify-center rounded-full text-muted hover:bg-background"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {accountPanel}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: `src/app/(dashboard)/layout.tsx` (reemplazo completo)**

```tsx
import { redirect } from "next/navigation";
import { AREA_LABELS, PROFESSIONAL_NAV, areaLinks } from "@/features/identity/navigation";
import { signOutAction, switchAreaAction } from "@/features/identity/session-actions";
import { getActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { AppShell } from "@/shared/ui/navigation/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) redirect("/start");

  return (
    <AppShell
      areaLabel={AREA_LABELS.PROFESSIONAL}
      items={PROFESSIONAL_NAV}
      areas={areaLinks(actor, "PROFESSIONAL")}
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      switchAreaAction={switchAreaAction}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 10: Ejecutar** — Run: `pnpm test:unit && pnpm build` → Expected: pruebas pasan, build sin errores.

- [ ] **Step 11: Verificación manual móvil** — con `pnpm dev`, DevTools en 390×844, sesión `dev@gmail.com`: barra inferior con 4 iconos + "Cuenta", pestaña activa resaltada; "Cuenta" abre la hoja con "Consulta"/"Administración" y "Cerrar sesión"; "Cerrar sesión" lleva a `/login`; favicon de Vianda en la pestaña. Tomar captura de la barra y de la hoja.

- [ ] **Step 12: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/ui src/app/icon.svg src/app/apple-icon.tsx src/app/manifest.ts src/app/favicon.ico src/app/layout.tsx src/features/identity src/app/\(dashboard\)/layout.tsx tests/unit/identity
git commit -m "feat(ui): navegación mobile-first con iconos SVG, cuenta y cambio de área; marca e íconos de app"
```

---

### Task 9: Registro de profesional con aprobación pendiente

**Files:**
- Create: `src/features/identity/register-professional.ts`
- Create: `src/features/identity/pending-status.ts`
- Modify: `src/app/api/auth/register/route.ts` (reemplazo completo)
- Modify: `src/app/(auth)/register/page.tsx` (campo tarjeta, destino `/start`, móvil)
- Create: `src/app/pending/page.tsx`
- Test: `tests/integration/register-professional.test.ts`

**Interfaces:**
- Consumes: `recordAudit` (T5), `resolveLandingPath` (T3), `signOutAction` (T8).
- Produces: `registerProfessional(input: unknown, meta: { ip: string | null }): Promise<{ ok: true; userId: string } | { ok: false; status: 400 | 409; error: string }>`; `getPendingStatus(userId: string): Promise<{ redirectTo: string } | { status: "PENDING" | "REJECTED" | "SUSPENDED" | "NO_ACCESS"; name: string | null; rejectionReason: string | null }>`.

- [ ] **Step 1: Escribir `tests/integration/register-professional.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { registerProfessional } from "@/features/identity/register-professional";
import { prisma } from "../support/db";

const valid = { name: "Laura Gómez", email: "Laura@Test.co", password: "Secreta1", licenseNumber: "TP-12345" };

describe("registerProfessional", () => {
  it("crea cuenta sin roles con perfil PENDING y audita en la misma operación", async () => {
    const result = await registerProfessional(valid, { ip: "203.0.113.7" });
    expect(result.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "laura@test.co" },
      include: { professionalProfile: true },
    });
    expect(user.roles).toEqual([]);
    expect(user.professionalProfile).toMatchObject({ status: "PENDING", licenseNumber: "TP-12345" });
    expect(await prisma.auditLog.count({ where: { action: "PROFESSIONAL_REGISTERED", actorId: user.id } })).toBe(1);
  });

  it("rechaza email duplicado con 409", async () => {
    await registerProfessional(valid, { ip: null });
    expect(await registerProfessional(valid, { ip: null })).toEqual({
      ok: false,
      status: 409,
      error: "Ya existe una cuenta con este email",
    });
  });

  it("exige tarjeta profesional", async () => {
    const result = await registerProfessional({ ...valid, licenseNumber: "" }, { ip: null });
    expect(result).toEqual({ ok: false, status: 400, error: "Número de tarjeta profesional requerido" });
  });
});
```

- [ ] **Step 2: Ejecutar** — Run: `pnpm test:int` → Expected: FAIL por import inexistente.

- [ ] **Step 3: Crear `src/features/identity/register-professional.ts`**

```ts
import bcrypt from "bcryptjs";
import { z } from "zod";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

const registerProfessionalSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  licenseNumber: z.string().trim().min(1, "Número de tarjeta profesional requerido").max(40, "Número de tarjeta demasiado largo"),
});

export async function registerProfessional(
  input: unknown,
  meta: { ip: string | null }
): Promise<{ ok: true; userId: string } | { ok: false; status: 400 | 409; error: string }> {
  const parsed = registerProfessionalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, email, password, licenseNumber } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, status: 409, error: "Ya existe una cuenta con este email" };

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: [],
        professionalProfile: { create: { licenseNumber } },
      },
      select: { id: true },
    });
    await recordAudit(
      {
        actorId: created.id,
        actorRole: null,
        action: "PROFESSIONAL_REGISTERED",
        entityType: "ProfessionalProfile",
        entityId: created.id,
        metadata: { licenseNumber },
        ip: meta.ip,
      },
      tx
    );
    return created;
  });

  return { ok: true, userId: user.id };
}
```

- [ ] **Step 4: `src/app/api/auth/register/route.ts` (reemplazo completo)**

```ts
import { NextResponse } from "next/server";
import { registerProfessional } from "@/features/identity/register-professional";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await registerProfessional(body, { ip });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear la cuenta" }, { status: 500 });
  }
}
```

- [ ] **Step 5: `src/app/(auth)/register/page.tsx`** — cambios exactos:
  - Agregar estado `const [licenseNumber, setLicenseNumber] = useState("");`.
  - En el `body` del `fetch`: `JSON.stringify({ name, email, password, licenseNumber })`.
  - Reemplazar `router.push("/dashboard");` por `router.push("/start");`.
  - Reemplazar el `<main ...>` y el bloque de cabecera por:

```tsx
    <main className="flex min-h-dvh items-center justify-center gradient-wellness px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-xl border border-border">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo />
          <p className="text-muted mt-3">Crea tu cuenta de nutricionista</p>
          <p className="text-xs text-muted mt-1">Verificamos tu tarjeta profesional antes de activar el acceso.</p>
        </div>
```

  - Agregar `inputMode="email" autoComplete="email" className="min-h-11"` al input de email, `autoComplete="name" className="min-h-11"` al de nombre, `autoComplete="new-password" className="min-h-11"` al de contraseña.
  - Después del input de contraseña, agregar:

```tsx
          <Input
            label="Número de tarjeta profesional"
            id="licenseNumber"
            type="text"
            autoComplete="off"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="Ej: TP-123456"
            className="min-h-11"
            required
          />
```

  - Botón: agregar `min-h-11` a `className`.
  - Import: `import { Logo } from "@/shared/ui/brand/logo";`.

- [ ] **Step 6: Crear `src/features/identity/pending-status.ts`**

```ts
import { resolveLandingPath } from "@/core/access/landing";
import { prisma } from "@/infrastructure/database/prisma";

export type PendingStatus =
  | { redirectTo: string }
  | { status: "PENDING" | "REJECTED" | "SUSPENDED" | "NO_ACCESS"; name: string | null; rejectionReason: string | null };

export async function getPendingStatus(userId: string): Promise<PendingStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      roles: true,
      lastArea: true,
      professionalProfile: { select: { status: true, rejectionReason: true } },
    },
  });
  if (!user) return { redirectTo: "/login" };

  const landing = resolveLandingPath({
    roles: user.roles,
    lastArea: user.lastArea,
    professionalStatus: user.professionalProfile?.status ?? null,
  });
  if (landing !== "/pending") return { redirectTo: landing };

  const profileStatus = user.professionalProfile?.status;
  const status = profileStatus === "PENDING" || profileStatus === "REJECTED" || profileStatus === "SUSPENDED" ? profileStatus : "NO_ACCESS";
  return { status, name: user.name, rejectionReason: user.professionalProfile?.rejectionReason ?? null };
}
```

- [ ] **Step 7: Crear `src/app/pending/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { Clock, ShieldOff, XCircle } from "lucide-react";
import { getPendingStatus } from "@/features/identity/pending-status";
import { signOutAction } from "@/features/identity/session-actions";
import { auth } from "@/infrastructure/auth/auth";
import { Logo } from "@/shared/ui/brand/logo";

const COPY = {
  PENDING: { icon: Clock, title: "Tu cuenta está en revisión", body: "Estamos verificando tu tarjeta profesional. Te daremos acceso apenas se apruebe." },
  REJECTED: { icon: XCircle, title: "No pudimos aprobar tu cuenta", body: "Revisa el motivo y contáctanos si crees que es un error." },
  SUSPENDED: { icon: ShieldOff, title: "Tu cuenta está suspendida", body: "Tus fichas se conservan, pero el acceso está desactivado." },
  NO_ACCESS: { icon: ShieldOff, title: "Tu cuenta no tiene acceso activo", body: "Si eres paciente, pide a tu nutricionista un enlace de invitación." },
} as const;

export default async function PendingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const result = await getPendingStatus(userId);
  if ("redirectTo" in result) redirect(result.redirectTo);

  const copy = COPY[result.status];
  const Icon = copy.icon;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-sm border border-border text-center">
        <Logo className="justify-center" />
        <Icon className="h-12 w-12 text-primary mx-auto mt-8" aria-hidden="true" />
        <h1 className="text-xl font-bold text-text mt-4">{copy.title}</h1>
        <p className="text-sm text-muted mt-2">{copy.body}</p>
        {result.status === "REJECTED" && result.rejectionReason && (
          <p className="text-sm text-text mt-4 rounded-xl bg-background p-3">Motivo: {result.rejectionReason}</p>
        )}
        <form action={signOutAction} className="mt-8">
          <button type="submit" className="w-full min-h-11 rounded-xl border border-border text-sm font-medium text-text hover:bg-background">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Ejecutar** — Run: `pnpm test && pnpm build` → Expected: todo pasa.

- [ ] **Step 9: Verificación manual móvil** — registrar una cuenta nueva a 390×844: termina en "Tu cuenta está en revisión"; "Cerrar sesión" funciona; `/dashboard` redirige a `/pending`.

- [ ] **Step 10: Commit**

```bash
git add src/features/identity src/app/api/auth/register/route.ts src/app/\(auth\)/register/page.tsx src/app/pending tests/integration/register-professional.test.ts
git commit -m "feat(identity): registro profesional con tarjeta y aprobación pendiente"
```

---

### Task 10: Migrar actions existentes a contexto de acceso + guardián

**Files:**
- Modify: `src/features/patients/actions.ts` (reemplazo completo)
- Modify: `src/features/appointments/actions.ts` (reemplazo completo)
- Modify: `src/features/assessments/actions.ts`
- Modify: `src/features/nutrition/actions.ts`
- Test: `tests/unit/guardian/actions-require-actor.test.ts`, `tests/integration/clinical-isolation.test.ts`

**Interfaces:**
- Consumes: `getActorFor`, `requireActorFor` (T6); `canViewPatientRecord` (T3); `recordAuditBestEffort` (T5); `getRequestMeta` (T5).
- Produces: las mismas firmas públicas existentes (sin cambios para las páginas). Las funciones de lectura lanzan `AccessDeniedError` si no hay actor profesional (antes `Error("No autorizado")`).

- [ ] **Step 1: Guardián `tests/unit/guardian/actions-require-actor.test.ts`**

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FEATURES_DIR = fileURLToPath(new URL("../../../src/features", import.meta.url));

/** Funciones que consultan sólo el catálogo público de alimentos (sin datos clínicos). */
const ALLOWED_WITHOUT_ACTOR = new Set(["getFoods"]);

function topLevelFunctions(source: string): { name: string; exported: boolean; body: string }[] {
  const matches = [...source.matchAll(/^(export )?(?:async )?function (\w+)/gm)];
  return matches.map((match, index) => ({
    name: match[2]!,
    exported: Boolean(match[1]),
    body: source.slice(match.index!, matches[index + 1]?.index ?? source.length),
  }));
}

const actionFiles = readdirSync(FEATURES_DIR)
  .map((dir) => path.join(FEATURES_DIR, dir, "actions.ts"))
  .filter((file) => existsSync(file));

describe.each(actionFiles)("%s", (file) => {
  const guarded = topLevelFunctions(readFileSync(file, "utf8")).filter(
    (fn) => fn.exported && fn.body.includes("prisma.") && !ALLOWED_WITHOUT_ACTOR.has(fn.name)
  );

  if (guarded.length === 0) {
    it("no tiene funciones exportadas que consulten prisma", () => {
      expect(guarded).toEqual([]);
    });
    return;
  }

  it.each(guarded.map((fn) => [fn.name, fn.body] as const))("%s obtiene el actor antes de consultar", (_name, body) => {
    expect(body).toMatch(/\b(getActorFor|requireActorFor)\(/);
  });
});
```

Run: `pnpm test:unit` → Expected: FAIL en `getPatients`, `getAppointments`, `getAssessment`, `getMealPlan`, etc.

- [ ] **Step 2: Prueba de aislamiento `tests/integration/clinical-isolation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "@/infrastructure/access/access-context";
import { createAppointment } from "@/features/appointments/actions";
import { getAssessment } from "@/features/assessments/actions";
import { getMealPlan } from "@/features/nutrition/actions";
import { getPatient, getPatients, updatePatient } from "@/features/patients/actions";
import { prisma } from "../support/db";
import { createAdmin, createPatientRecord, createProfessional } from "../support/factories";
import { signInAs } from "../support/session";

async function setup() {
  const proA = await createProfessional({ name: "Pro A" });
  const proB = await createProfessional({ name: "Pro B" });
  const patientB = await createPatientRecord(proB.id, { firstName: "Beatriz" });
  const assessmentB = await prisma.assessment.create({
    data: { reason: "Control", patientId: patientB.id, professionalId: proB.id },
  });
  const planB = await prisma.mealPlan.create({
    data: { name: "Plan B", patientId: patientB.id, professionalId: proB.id },
  });
  return { proA, proB, patientB, assessmentB, planB };
}

describe("aislamiento clínico entre profesionales", () => {
  it("A no lee la ficha, valoración ni plan de B", async () => {
    const { proA, patientB, assessmentB, planB } = await setup();
    signInAs(proA.id);
    expect(await getPatient(patientB.id)).toBeNull();
    expect(await getAssessment(assessmentB.id)).toBeNull();
    expect(await getMealPlan(planB.id)).toBeNull();
    expect((await getPatients()).map((p) => p.id)).not.toContain(patientB.id);
  });

  it("A no edita la ficha de B ni le agenda citas", async () => {
    const { proA, patientB } = await setup();
    signInAs(proA.id);
    const form = new FormData();
    form.set("firstName", "Hack");
    form.set("lastName", "Hack");
    expect(await updatePatient(patientB.id, form)).toEqual({ error: "Paciente no encontrado" });

    const appointment = new FormData();
    appointment.set("patientId", patientB.id);
    appointment.set("date", "2026-12-01");
    appointment.set("time", "10:00");
    expect(await createAppointment(appointment)).toEqual({ error: "Paciente no encontrado" });
  });

  it("abrir la ficha propia audita PATIENT_RECORD_VIEWED", async () => {
    const { proB, patientB } = await setup();
    signInAs(proB.id);
    expect((await getPatient(patientB.id))?.id).toBe(patientB.id);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "PATIENT_RECORD_VIEWED" } });
    expect(log).toMatchObject({ actorId: proB.id, actorRole: "PROFESSIONAL", patientId: patientB.id });
  });

  it("admin y profesional pendiente no acceden a datos clínicos", async () => {
    const { patientB } = await setup();
    const admin = await createAdmin();
    signInAs(admin.id);
    await expect(getPatients()).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(getPatient(patientB.id)).rejects.toBeInstanceOf(AccessDeniedError);

    const pending = await createProfessional({ status: "PENDING" });
    signInAs(pending.id);
    await expect(getPatients()).rejects.toBeInstanceOf(AccessDeniedError);
  });
});
```

Run: `pnpm test:int` → Expected: FAIL (admin obtiene lista vacía en vez de `AccessDeniedError`; no hay auditoría).

- [ ] **Step 3: `src/features/patients/actions.ts` (reemplazo completo)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canViewPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import type { AuditAction } from "@/core/audit/audit";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta } from "@/infrastructure/http/request-meta";

const patientSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellido requerido"),
  documentId: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

function parsePatientForm(formData: FormData) {
  return patientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    documentId: formData.get("documentId") || undefined,
    sex: formData.get("sex") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

async function auditPatient(actor: Actor, action: AuditAction, patientId: string, metadata?: Record<string, unknown>) {
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId: actor.userId,
    actorRole: "PROFESSIONAL",
    action,
    entityType: "Patient",
    entityId: patientId,
    patientId,
    metadata,
    ip,
  });
}

function revalidatePatients(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/patients");
  if (id) revalidatePath(`/dashboard/patients/${id}`);
}

export async function getPatients(includeInactive = false) {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.patient.findMany({
    where: {
      professionalId: actor.userId,
      ...(!includeInactive && { status: { not: "INACTIVE" } }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assessments: true, mealPlans: true } },
      assessments: {
        orderBy: { assessmentDate: "desc" },
        take: 2,
        include: { anthropometry: true, nutritionalGoal: true },
      },
    },
  });
}

export async function getPatient(id: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  const patient = await prisma.patient.findFirst({
    where: { id, professionalId: actor.userId },
    include: {
      assessments: {
        orderBy: { assessmentDate: "desc" },
        include: { anthropometry: true, nutritionalGoal: true },
      },
      mealPlans: {
        orderBy: { createdAt: "desc" },
        include: { assessment: { include: { nutritionalGoal: true } } },
      },
    },
  });

  if (!patient || !canViewPatientRecord(actor, { professionalId: patient.professionalId, userId: patient.userId, consentActive: false })) {
    return null;
  }

  await auditPatient(actor, "PATIENT_RECORD_VIEWED", patient.id);
  return patient;
}

export async function createPatient(formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { firstName, lastName, documentId, sex, email, phone, dateOfBirth, notes } = parsed.data;

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      documentId: documentId || null,
      sex: sex || null,
      email: email || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      notes: notes || null,
      professionalId: actor.userId,
    },
  });

  await auditPatient(actor, "PATIENT_CREATED", patient.id);
  revalidatePatients();
  return { success: true };
}

async function setPatientStatus(id: string, status: "ACTIVE" | "INACTIVE" | "DISCHARGED") {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const result = await prisma.patient.updateMany({
    where: { id, professionalId: actor.userId },
    data: { status },
  });
  if (result.count === 0) return { error: "Paciente no encontrado" };

  await auditPatient(actor, "PATIENT_UPDATED", id, { status });
  revalidatePatients(id);
  return { success: true };
}

/** Desactiva un paciente (soft delete — nunca se borra de la BD) */
export async function deactivatePatient(id: string) {
  return setPatientStatus(id, "INACTIVE");
}

/** Reactiva un paciente desactivado */
export async function reactivatePatient(id: string) {
  return setPatientStatus(id, "ACTIVE");
}

/** Da de alta a un paciente */
export async function dischargePatient(id: string) {
  return setPatientStatus(id, "DISCHARGED");
}

/** Actualiza la información de un paciente */
export async function updatePatient(id: string, formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { firstName, lastName, documentId, sex, email, phone, dateOfBirth, notes } = parsed.data;

  const result = await prisma.patient.updateMany({
    where: { id, professionalId: actor.userId },
    data: {
      firstName,
      lastName,
      documentId: documentId || null,
      sex: sex || null,
      email: email || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      notes: notes || null,
    },
  });

  if (result.count === 0) return { error: "Paciente no encontrado" };

  await auditPatient(actor, "PATIENT_UPDATED", id);
  revalidatePatients(id);
  return { success: true };
}

/** Búsqueda de pacientes con filtros */
export async function searchPatients(query?: string, status?: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  const where: Record<string, unknown> = { professionalId: actor.userId };

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { documentId: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  return prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assessments: true, mealPlans: true } },
      assessments: {
        orderBy: { assessmentDate: "desc" },
        take: 2,
        include: { anthropometry: true, nutritionalGoal: true },
      },
    },
  });
}
```

Nota: `deactivatePatient`, `reactivatePatient` y `dischargePatient` delegan en `setPatientStatus` (no exportada), que sí obtiene el actor; el guardián sólo exige actor a funciones exportadas que contienen `prisma.`, y estas tres no lo contienen.

- [ ] **Step 4: `src/features/appointments/actions.ts` (reemplazo completo)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta } from "@/infrastructure/http/request-meta";

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Paciente requerido"),
  date: z.string().min(1, "Fecha requerida"),
  time: z.string().min(1, "Hora requerida"),
  duration: z.coerce.number().min(15).max(180).default(30),
  reason: z.string().optional(),
});

async function auditAppointment(actorId: string, appointmentId: string, patientId: string, metadata: Record<string, unknown>) {
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId,
    actorRole: "PROFESSIONAL",
    action: "APPOINTMENT_CHANGED",
    entityType: "Appointment",
    entityId: appointmentId,
    patientId,
    metadata,
    ip,
  });
}

function todayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

export async function getAppointments() {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.appointment.findMany({
    where: { professionalId: actor.userId },
    include: { patient: true },
    orderBy: { date: "asc" },
  });
}

export async function getTodayAppointments() {
  const actor = await requireActorFor("PROFESSIONAL");
  const { today, tomorrow } = todayRange();

  return prisma.appointment.findMany({
    where: {
      professionalId: actor.userId,
      date: { gte: today, lt: tomorrow },
      status: "SCHEDULED",
    },
    include: { patient: true },
    orderBy: { date: "asc" },
  });
}

export async function getUpcomingAppointments() {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.appointment.findMany({
    where: {
      professionalId: actor.userId,
      date: { gte: new Date() },
      status: "SCHEDULED",
    },
    include: { patient: true },
    orderBy: { date: "asc" },
    take: 5,
  });
}

export async function createAppointment(formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const parsed = appointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    date: formData.get("date"),
    time: formData.get("time"),
    duration: formData.get("duration") || 30,
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { patientId, date, time, duration, reason } = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: actor.userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      professionalId: actor.userId,
      date: new Date(`${date}T${time}`),
      duration,
      reason: reason || null,
    },
  });

  await auditAppointment(actor.userId, appointment.id, patientId, { change: "created" });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: true };
}

export async function updateAppointmentStatus(id: string, status: "SCHEDULED" | "COMPLETED" | "CANCELLED") {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const appointment = await prisma.appointment.findFirst({
    where: { id, professionalId: actor.userId },
    select: { id: true, patientId: true },
  });
  if (!appointment) return { error: "Cita no encontrada" };

  await prisma.appointment.update({ where: { id }, data: { status } });

  await auditAppointment(actor.userId, id, appointment.patientId, { status });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: true };
}

export async function getDashboardStats() {
  const actor = await requireActorFor("PROFESSIONAL");
  const { today, tomorrow } = todayRange();

  const [patientCount, assessmentCount, planCount, todayCount] = await Promise.all([
    prisma.patient.count({ where: { professionalId: actor.userId } }),
    prisma.assessment.count({ where: { professionalId: actor.userId } }),
    prisma.mealPlan.count({ where: { professionalId: actor.userId } }),
    prisma.appointment.count({
      where: {
        professionalId: actor.userId,
        date: { gte: today, lt: tomorrow },
        status: "SCHEDULED",
      },
    }),
  ]);

  return { patientCount, assessmentCount, planCount, todayCount };
}
```

- [ ] **Step 5: `src/features/assessments/actions.ts`** — cambios exactos:

5a. Reemplazar el import `import { auth } from "@/infrastructure/auth/auth";` por:

```ts
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
```

5b. Reemplazar `getAssessment` y `getPatientAssessments` completos por:

```ts
export async function getAssessment(id: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  const assessment = await prisma.assessment.findFirst({
    where: { id, professionalId: actor.userId },
    include: {
      patient: true,
      anthropometry: true,
      nutritionalGoal: true,
      mealPlans: { orderBy: { createdAt: "desc" } },
    },
  });

  if (assessment) {
    const { ip } = await getRequestMeta();
    await recordAuditBestEffort({
      actorId: actor.userId,
      actorRole: "PROFESSIONAL",
      action: "PATIENT_RECORD_VIEWED",
      entityType: "Assessment",
      entityId: assessment.id,
      patientId: assessment.patientId,
      ip,
    });
  }

  return assessment;
}

export async function getPatientAssessments(patientId: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.assessment.findMany({
    where: { patientId, professionalId: actor.userId },
    include: { anthropometry: true, nutritionalGoal: true },
    orderBy: { assessmentDate: "desc" },
  });
}
```

5c. En `createAssessment`, reemplazar:

```ts
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };
```

por:

```ts
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };
```

5d. En `createAssessment`, reemplazar las dos apariciones de `session.user.id` por `actor.userId` (en `where: { id: data.patientId, professionalId: ... }` y en `professionalId: ...` del `assessment.create`).

5e. En `createAssessment`, inmediatamente antes de `revalidatePath(\`/dashboard/patients/${data.patientId}\`);`, agregar:

```ts
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId: actor.userId,
    actorRole: "PROFESSIONAL",
    action: "ASSESSMENT_CREATED",
    entityType: "Assessment",
    entityId: assessment.id,
    patientId: data.patientId,
    ip,
  });
```

- [ ] **Step 6: `src/features/nutrition/actions.ts`** — cambios exactos:

6a. Reemplazar `import { auth } from "@/infrastructure/auth/auth";` por:

```ts
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
```

6b. Agregar después de los imports:

```ts
async function auditMealPlan(actorId: string, mealPlanId: string, patientId: string, change: string) {
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId,
    actorRole: "PROFESSIONAL",
    action: "MEAL_PLAN_CHANGED",
    entityType: "MealPlan",
    entityId: mealPlanId,
    patientId,
    metadata: { change },
    ip,
  });
}
```

6c. En `getMealPlan`, reemplazar:

```ts
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
```

por `const actor = await requireActorFor("PROFESSIONAL");` y `professionalId: session.user.id` por `professionalId: actor.userId`.

6d. En `createMealPlan`, `generateAutomaticMealPlanAction`, `regenerateAutomaticMealPlan`, `addMealItem`, `removeMealItem` y `activateMealPlan`, reemplazar:

```ts
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };
```

por:

```ts
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };
```

y cada `session.user.id` del archivo por `actor.userId`. Verificación: `rg -n "session" src/features/nutrition/actions.ts` → sin resultados.

6e. Auditoría de escrituras (insertar justo antes de cada `redirect`/`revalidatePath` final indicado):
  - `createMealPlan`, antes de `redirect(...)`: `await auditMealPlan(actor.userId, plan.id, patientId, "created");`
  - `generateAutomaticMealPlanAction`, antes de `revalidatePath(...)`: `await auditMealPlan(actor.userId, plan.id, patientId, "generated");`
  - `regenerateAutomaticMealPlan`, antes de `revalidatePath(...)`: `await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "regenerated");`
  - `addMealItem`, antes de `revalidatePath(...)`: `await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "item_added");`
  - `removeMealItem`, antes de `revalidatePath(...)`: `await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "item_removed");`

6f. `removeMealItem` hoy borra el ítem por `id` sin comprobar que pertenezca al plan. Reemplazar `await prisma.mealItem.delete({ where: { id: itemId } });` por:

```ts
  const removed = await prisma.mealItem.deleteMany({
    where: { id: itemId, meal: { day: { mealPlanId } } },
  });
  if (removed.count === 0) return { error: "Elemento no encontrado" };
```

6g. `addMealItem` acepta cualquier `mealId`. Después de comprobar el plan, agregar:

```ts
  const meal = await prisma.meal.findFirst({ where: { id: mealId, day: { mealPlanId } }, select: { id: true } });
  if (!meal) return { error: "Comida no encontrada en este plan" };
```

6h. `activateMealPlan`, reemplazar el cuerpo tras obtener el actor por:

```ts
  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, professionalId: actor.userId },
    select: { id: true, patientId: true },
  });
  if (!plan) return { error: "Plan no encontrado" };

  await prisma.mealPlan.update({ where: { id: mealPlanId }, data: { status: "ACTIVE" } });
  await auditMealPlan(actor.userId, mealPlanId, plan.patientId, "activated");

  revalidatePath(`/dashboard/meal-plans/${mealPlanId}`);
  return { success: true };
```

- [ ] **Step 7: Ejecutar** — Run: `pnpm test` → Expected: guardián y aislamiento pasan, resto en verde.

- [ ] **Step 8: Build y verificación manual**

Run: `pnpm build` → sin errores.
Manual con `dev@gmail.com` en 390×844: lista y búsqueda de pacientes (ahora sin distinguir mayúsculas), ficha, nueva valoración, crear/generar plan, agregar/quitar alimento, activar plan, crear cita y cambiar estado. Todo funciona igual que antes.

- [ ] **Step 9: Commit**

```bash
git add src/features tests/unit/guardian tests/integration/clinical-isolation.test.ts
git commit -m "refactor(access): todas las actions clínicas usan contexto de acceso y auditoría"
```

---

### Task 11: Revisión de profesionales (admin mínimo)

**Files:**
- Create: `src/features/admin/review-professionals.ts`
- Create: `src/features/admin/actions.ts`
- Create: `src/features/admin/components/professional-review-card.tsx`
- Create: `src/app/(admin)/admin/layout.tsx`, `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/professionals/page.tsx`
- Test: `tests/integration/review-professionals.test.ts`

**Interfaces:**
- Consumes: `canReviewProfessionals` (T3), `recordAudit` (T5), `getActorFor` (T6), `AppShell`, `ADMIN_NAV`, `areaLinks` (T8).
- Produces: `listProfessionalsForReview(): Promise<ProfessionalForReview[]>`; `reviewProfessional(input: { actor: Actor; profileId: string; decision: "APPROVE" | "REJECT" | "SUSPEND"; reason?: string; ip: string | null }): Promise<{ ok: true } | { ok: false; error: string }>`; server actions `approveProfessionalAction(formData)`, `rejectProfessionalAction(formData)`, `suspendProfessionalAction(formData)`, `getProfessionalsForReviewAction()`.

- [ ] **Step 1: Escribir `tests/integration/review-professionals.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { reviewProfessional } from "@/features/admin/review-professionals";
import { prisma } from "../support/db";
import { createAdmin, createProfessional } from "../support/factories";

function adminActor(userId: string): Actor {
  return { userId, roles: ["ADMIN"], activeArea: "ADMIN", professionalStatus: null };
}

async function profileOf(userId: string) {
  return prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
}

describe("reviewProfessional", () => {
  it("aprobar agrega el rol PROFESSIONAL y audita", async () => {
    const admin = await createAdmin();
    const pending = await createProfessional({ status: "PENDING" });
    const profile = await profileOf(pending.id);

    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "APPROVE", ip: null })).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: pending.id }, include: { professionalProfile: true } });
    expect(user.roles).toContain("PROFESSIONAL");
    expect(user.professionalProfile).toMatchObject({ status: "APPROVED", reviewedById: admin.id });
    expect(await prisma.auditLog.count({ where: { action: "PROFESSIONAL_APPROVED" } })).toBe(1);
  });

  it("rechazar exige motivo", async () => {
    const admin = await createAdmin();
    const profile = await profileOf((await createProfessional({ status: "PENDING" })).id);
    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "REJECT", reason: " ", ip: null })).toEqual({
      ok: false,
      error: "Indica el motivo del rechazo",
    });
    expect(
      await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "REJECT", reason: "Tarjeta no coincide", ip: null })
    ).toEqual({ ok: true });
    expect((await prisma.professionalProfile.findUniqueOrThrow({ where: { id: profile.id } })).rejectionReason).toBe("Tarjeta no coincide");
  });

  it("suspender deja el rol pero quita el estado aprobado", async () => {
    const admin = await createAdmin();
    const pro = await createProfessional();
    const profile = await profileOf(pro.id);
    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "SUSPEND", ip: null })).toEqual({ ok: true });
    expect((await profileOf(pro.id)).status).toBe("SUSPENDED");
  });

  it("un profesional no puede revisar", async () => {
    const pro = await createProfessional();
    const pending = await profileOf((await createProfessional({ status: "PENDING" })).id);
    const actor: Actor = { userId: pro.id, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" };
    expect(await reviewProfessional({ actor, profileId: pending.id, decision: "APPROVE", ip: null })).toEqual({ ok: false, error: "No autorizado" });
  });
});
```

Run: `pnpm test:int` → Expected: FAIL por import inexistente.

- [ ] **Step 2: Crear `src/features/admin/review-professionals.ts`**

```ts
import type { ProfessionalStatus } from "@prisma/client";
import { canReviewProfessionals } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import type { AuditAction } from "@/core/audit/audit";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export interface ProfessionalForReview {
  profileId: string;
  name: string | null;
  email: string;
  licenseNumber: string;
  status: ProfessionalStatus;
  createdAt: Date;
}

export async function listProfessionalsForReview(): Promise<ProfessionalForReview[]> {
  const profiles = await prisma.professionalProfile.findMany({
    where: { status: { in: ["PENDING", "APPROVED", "SUSPENDED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { name: true, email: true } } },
  });
  return profiles.map((p) => ({
    profileId: p.id,
    name: p.user.name,
    email: p.user.email,
    licenseNumber: p.licenseNumber,
    status: p.status,
    createdAt: p.createdAt,
  }));
}

type Decision = "APPROVE" | "REJECT" | "SUSPEND";

const DECISIONS: Record<Decision, { status: ProfessionalStatus; action: AuditAction; from: ProfessionalStatus[] }> = {
  APPROVE: { status: "APPROVED", action: "PROFESSIONAL_APPROVED", from: ["PENDING", "SUSPENDED", "REJECTED"] },
  REJECT: { status: "REJECTED", action: "PROFESSIONAL_REJECTED", from: ["PENDING"] },
  SUSPEND: { status: "SUSPENDED", action: "PROFESSIONAL_SUSPENDED", from: ["APPROVED"] },
};

export async function reviewProfessional(input: {
  actor: Actor;
  profileId: string;
  decision: Decision;
  reason?: string;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canReviewProfessionals(input.actor)) return { ok: false, error: "No autorizado" };

  const reason = input.reason?.trim() ?? "";
  if (input.decision === "REJECT" && reason.length === 0) {
    return { ok: false, error: "Indica el motivo del rechazo" };
  }

  const rule = DECISIONS[input.decision];
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: input.profileId },
    select: { id: true, userId: true, status: true, user: { select: { roles: true } } },
  });
  if (!profile) return { ok: false, error: "Profesional no encontrado" };
  if (!rule.from.includes(profile.status)) return { ok: false, error: "Esta acción no aplica al estado actual" };

  await prisma.$transaction(async (tx) => {
    await tx.professionalProfile.update({
      where: { id: profile.id },
      data: {
        status: rule.status,
        reviewedById: input.actor.userId,
        reviewedAt: new Date(),
        rejectionReason: input.decision === "REJECT" ? reason : null,
      },
    });
    if (input.decision === "APPROVE" && !profile.user.roles.includes("PROFESSIONAL")) {
      await tx.user.update({ where: { id: profile.userId }, data: { roles: { push: "PROFESSIONAL" } } });
    }
    await recordAudit(
      {
        actorId: input.actor.userId,
        actorRole: "ADMIN",
        action: rule.action,
        entityType: "ProfessionalProfile",
        entityId: profile.id,
        metadata: reason ? { reason } : undefined,
        ip: input.ip,
      },
      tx
    );
  });

  return { ok: true };
}
```

- [ ] **Step 3: Crear `src/features/admin/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { listProfessionalsForReview, reviewProfessional } from "./review-professionals";

export async function getProfessionalsForReviewAction() {
  await requireActorFor("ADMIN");
  return listProfessionalsForReview();
}

async function decide(formData: FormData, decision: "APPROVE" | "REJECT" | "SUSPEND"): Promise<{ error?: string }> {
  const actor = await getActorFor("ADMIN");
  if (!actor) return { error: "No autorizado" };
  const profileId = String(formData.get("profileId") ?? "");
  const reason = formData.get("reason");
  const { ip } = await getRequestMeta();
  const result = await reviewProfessional({
    actor,
    profileId,
    decision,
    reason: typeof reason === "string" ? reason : undefined,
    ip,
  });
  revalidatePath("/admin/professionals");
  return result.ok ? {} : { error: result.error };
}

export async function approveProfessionalAction(formData: FormData) {
  return decide(formData, "APPROVE");
}

export async function rejectProfessionalAction(formData: FormData) {
  return decide(formData, "REJECT");
}

export async function suspendProfessionalAction(formData: FormData) {
  return decide(formData, "SUSPEND");
}

export async function countPendingProfessionalsAction(): Promise<number> {
  await requireActorFor("ADMIN");
  return prisma.professionalProfile.count({ where: { status: "PENDING" } });
}
```

- [ ] **Step 4: Crear `src/features/admin/components/professional-review-card.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/shared/ui/components";
import { formatDate } from "@/shared/lib/utils";
import { approveProfessionalAction, rejectProfessionalAction, suspendProfessionalAction } from "../actions";
import type { ProfessionalForReview } from "../review-professionals";

const STATUS_LABEL = { PENDING: "Pendiente", APPROVED: "Aprobado", SUSPENDED: "Suspendido", REJECTED: "Rechazado" } as const;

export function ProfessionalReviewCard({ professional }: { professional: ProfessionalForReview }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error?: string }>, extra?: Record<string, string>) {
    const fd = new FormData();
    fd.set("profileId", professional.profileId);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    setError(null);
    startTransition(async () => {
      const result = await action(fd);
      if (result.error) setError(result.error);
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 space-y-3" aria-label={professional.name ?? professional.email}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text truncate">{professional.name ?? "Sin nombre"}</h3>
          <p className="text-sm text-muted truncate">{professional.email}</p>
        </div>
        <Badge variant={professional.status === "APPROVED" ? "success" : professional.status === "PENDING" ? "warning" : "muted"}>
          {STATUS_LABEL[professional.status]}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted">Tarjeta profesional</dt>
          <dd className="font-medium text-text break-all">{professional.licenseNumber}</dd>
        </div>
        <div>
          <dt className="text-muted">Solicitud</dt>
          <dd className="font-medium text-text">{formatDate(professional.createdAt)}</dd>
        </div>
      </dl>

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {professional.status === "PENDING" && !rejecting && (
        <div className="grid grid-cols-2 gap-2">
          <Button className="min-h-11" disabled={isPending} onClick={() => run(approveProfessionalAction)}>
            Aprobar
          </Button>
          <Button variant="outline" className="min-h-11" disabled={isPending} onClick={() => setRejecting(true)}>
            Rechazar
          </Button>
        </div>
      )}

      {professional.status === "PENDING" && rejecting && (
        <div className="space-y-2">
          <label htmlFor={`reason-${professional.profileId}`} className="block text-sm font-medium text-text">
            Motivo del rechazo
          </label>
          <textarea
            id={`reason-${professional.profileId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" className="min-h-11" disabled={isPending} onClick={() => run(rejectProfessionalAction, { reason })}>
              Confirmar rechazo
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {professional.status === "APPROVED" && (
        <Button variant="outline" className="w-full min-h-11" disabled={isPending} onClick={() => run(suspendProfessionalAction)}>
          Suspender
        </Button>
      )}

      {professional.status === "SUSPENDED" && (
        <Button className="w-full min-h-11" disabled={isPending} onClick={() => run(approveProfessionalAction)}>
          Reactivar
        </Button>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Layout y páginas de admin**

`src/app/(admin)/admin/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { ADMIN_NAV, AREA_LABELS, areaLinks } from "@/features/identity/navigation";
import { signOutAction, switchAreaAction } from "@/features/identity/session-actions";
import { getActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { AppShell } from "@/shared/ui/navigation/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await getActorFor("ADMIN");
  if (!actor) redirect("/start");

  return (
    <AppShell
      areaLabel={AREA_LABELS.ADMIN}
      items={ADMIN_NAV}
      areas={areaLinks(actor, "ADMIN")}
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      switchAreaAction={switchAreaAction}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
```

`src/app/(admin)/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminHome() {
  redirect("/admin/professionals");
}
```

`src/app/(admin)/admin/professionals/page.tsx`:

```tsx
import { getProfessionalsForReviewAction } from "@/features/admin/actions";
import { ProfessionalReviewCard } from "@/features/admin/components/professional-review-card";

export default async function ProfessionalsReviewPage() {
  const professionals = await getProfessionalsForReviewAction();
  const pending = professionals.filter((p) => p.status === "PENDING");
  const others = professionals.filter((p) => p.status !== "PENDING");

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-3">
        <h1 className="text-xl font-bold text-text">Profesionales por aprobar</h1>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No hay solicitudes pendientes.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <ProfessionalReviewCard key={p.profileId} professional={p} />
            ))}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text">Profesionales registrados</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {others.map((p) => (
            <ProfessionalReviewCard key={p.profileId} professional={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Ejecutar** — Run: `pnpm test && pnpm build` → Expected: todo pasa.

- [ ] **Step 7: Verificación manual móvil** — con `dev@gmail.com`: Cuenta → Administración → `/admin/professionals`; aprobar la cuenta creada en la Tarea 9; esa cuenta al iniciar sesión entra a `/dashboard`. Suspenderla: su siguiente navegación la manda a `/pending` con "Tu cuenta está suspendida". Captura de la tarjeta pendiente a 390 px.

- [ ] **Step 8: Commit**

```bash
git add src/features/admin src/app/\(admin\) tests/integration/review-professionals.test.ts
git commit -m "feat(admin): aprobación, rechazo y suspensión de profesionales con auditoría"
```

---

### Task 12: Invitar paciente (lado profesional)

**Files:**
- Create: `src/features/invitations/create-invitation.ts`
- Create: `src/features/invitations/invitation-status.ts`
- Create: `src/features/invitations/actions.ts`
- Create: `src/features/invitations/components/invite-patient-panel.tsx`
- Modify: `src/app/(dashboard)/dashboard/patients/[id]/page.tsx`
- Test: `tests/integration/create-invitation.test.ts`

**Interfaces:**
- Consumes: `canManageInvitations` (T3), `generateInvitationToken`, `hashInvitationToken`, `invitationExpiry` (T4), `recordAudit` (T5), `getActorFor` (T6), `getRequestOrigin` (T5).
- Produces: `createInvitation(input: { actor: Actor; patientId: string; now: Date; ip: string | null }): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: string }>`; `type InvitationStatus = { state: "NONE" } | { state: "PENDING"; expiresAt: Date } | { state: "LINKED" } | { state: "REVOKED_BY_PATIENT" }`; `getInvitationStatus(patientId: string, now: Date): Promise<InvitationStatus>`; server actions `createInvitationAction(patientId: string): Promise<{ url: string; expiresAt: Date } | { error: string }>`, `getInvitationStatusAction(patientId: string): Promise<InvitationStatus | null>`.

- [ ] **Step 1: Escribir `tests/integration/create-invitation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { hashInvitationToken } from "@/core/invitations/invitation-token";
import type { Actor } from "@/core/access/types";
import { createInvitation } from "@/features/invitations/create-invitation";
import { getInvitationStatus } from "@/features/invitations/invitation-status";
import { prisma } from "../support/db";
import { createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

describe("createInvitation", () => {
  it("crea invitación con hash, vence en 7 días y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    const result = await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
    if (!result.ok) throw new Error(result.error);

    const stored = await prisma.patientInvitation.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(stored.tokenHash).toBe(hashInvitationToken(result.token));
    expect(stored.expiresAt.toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_CREATED", patientId: patient.id } })).toBe(1);
    expect(await getInvitationStatus(patient.id, now)).toEqual({ state: "PENDING", expiresAt: stored.expiresAt });
  });

  it("generar una nueva revoca la anterior", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
    await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
    const invitations = await prisma.patientInvitation.findMany({ where: { patientId: patient.id } });
    expect(invitations).toHaveLength(2);
    expect(invitations.filter((i) => i.revokedAt !== null)).toHaveLength(1);
    expect(invitations.filter((i) => i.revokedAt === null)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: "INVITATION_REVOKED" } })).toBe(1);
  });

  it("no invita fichas ajenas ni ya vinculadas", async () => {
    const pro = await createProfessional();
    const other = await createProfessional();
    const foreign = await createPatientRecord(other.id);
    expect(await createInvitation({ actor: proActor(pro.id), patientId: foreign.id, now, ip: null })).toEqual({ ok: false, error: "No autorizado" });

    const account = await createPatientUser();
    const linked = await createPatientRecord(pro.id, { userId: account.id });
    expect(await createInvitation({ actor: proActor(pro.id), patientId: linked.id, now, ip: null })).toEqual({
      ok: false,
      error: "Esta ficha ya está vinculada a una cuenta",
    });
    expect(await getInvitationStatus(linked.id, now)).toEqual({ state: "LINKED" });
  });
});
```

Run: `pnpm test:int` → Expected: FAIL por import inexistente.

- [ ] **Step 2: Crear `src/features/invitations/create-invitation.ts`**

```ts
import { canManageInvitations } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { generateInvitationToken, hashInvitationToken, invitationExpiry } from "@/core/invitations/invitation-token";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export async function createInvitation(input: {
  actor: Actor;
  patientId: string;
  now: Date;
  ip: string | null;
}): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: string }> {
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, professionalId: true, userId: true },
  });
  if (!patient || !canManageInvitations(input.actor, { professionalId: patient.professionalId, userId: patient.userId, consentActive: false })) {
    return { ok: false, error: "No autorizado" };
  }
  if (patient.userId) return { ok: false, error: "Esta ficha ya está vinculada a una cuenta" };

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry(input.now);

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.patientInvitation.updateMany({
      where: { patientId: patient.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: input.now },
    });
    if (revoked.count > 0) {
      await recordAudit(
        {
          actorId: input.actor.userId,
          actorRole: "PROFESSIONAL",
          action: "INVITATION_REVOKED",
          entityType: "PatientInvitation",
          patientId: patient.id,
          metadata: { count: revoked.count, reason: "replaced" },
          ip: input.ip,
        },
        tx
      );
    }
    const invitation = await tx.patientInvitation.create({
      data: {
        patientId: patient.id,
        tokenHash: hashInvitationToken(token),
        expiresAt,
        createdById: input.actor.userId,
      },
      select: { id: true },
    });
    await recordAudit(
      {
        actorId: input.actor.userId,
        actorRole: "PROFESSIONAL",
        action: "INVITATION_CREATED",
        entityType: "PatientInvitation",
        entityId: invitation.id,
        patientId: patient.id,
        ip: input.ip,
      },
      tx
    );
  });

  return { ok: true, token, expiresAt };
}
```

- [ ] **Step 3: Crear `src/features/invitations/invitation-status.ts`**

```ts
import { prisma } from "@/infrastructure/database/prisma";

export type InvitationStatus =
  | { state: "NONE" }
  | { state: "PENDING"; expiresAt: Date }
  | { state: "LINKED" }
  | { state: "REVOKED_BY_PATIENT" };

export async function getInvitationStatus(patientId: string, now: Date): Promise<InvitationStatus> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      userId: true,
      invitations: {
        where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { expiresAt: true },
      },
      consents: { where: { revokedAt: { not: null } }, take: 1, select: { id: true } },
    },
  });
  if (!patient) return { state: "NONE" };
  if (patient.userId) return { state: "LINKED" };
  const pending = patient.invitations[0];
  if (pending) return { state: "PENDING", expiresAt: pending.expiresAt };
  if (patient.consents.length > 0) return { state: "REVOKED_BY_PATIENT" };
  return { state: "NONE" };
}
```

- [ ] **Step 4: Crear `src/features/invitations/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { canManageInvitations } from "@/core/access/policies";
import { getActorFor } from "@/infrastructure/access/access-context";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta, getRequestOrigin } from "@/infrastructure/http/request-meta";
import { createInvitation } from "./create-invitation";
import { getInvitationStatus, type InvitationStatus } from "./invitation-status";

export async function createInvitationAction(patientId: string): Promise<{ url: string; expiresAt: Date } | { error: string }> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await createInvitation({ actor, patientId, now: new Date(), ip });
  if (!result.ok) return { error: result.error };
  const origin = await getRequestOrigin();
  revalidatePath(`/dashboard/patients/${patientId}`);
  return { url: `${origin}/invite/${result.token}`, expiresAt: result.expiresAt };
}

export async function getInvitationStatusAction(patientId: string): Promise<InvitationStatus | null> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return null;
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { professionalId: true, userId: true },
  });
  if (!patient || !canManageInvitations(actor, { ...patient, consentActive: false })) return null;
  return getInvitationStatus(patientId, new Date());
}
```

- [ ] **Step 5: Crear `src/features/invitations/components/invite-patient-panel.tsx`**

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import { Badge, Button } from "@/shared/ui/components";
import { formatDate } from "@/shared/lib/utils";
import { createInvitationAction } from "../actions";
import type { InvitationStatus } from "../invitation-status";

const STATUS_COPY: Record<InvitationStatus["state"], string> = {
  NONE: "Sin invitar",
  PENDING: "Invitación pendiente",
  LINKED: "Vinculado",
  REVOKED_BY_PATIENT: "Acceso revocado por el paciente",
};

export function InvitePatientPanel({
  patientId,
  patientFirstName,
  status,
}: {
  patientId: string;
  patientFirstName: string;
  status: InvitationStatus;
}) {
  const [link, setLink] = useState<{ url: string; expiresAt: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const message = link
    ? `Hola ${patientFirstName}, te invito a Vianda para seguir tu plan nutricional. Crea tu cuenta con este enlace (vence el ${formatDate(link.expiresAt)}): ${link.url}`
    : "";

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createInvitationAction(patientId);
      if ("error" in result) setError(result.error);
      else setLink(result);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "Invitación a Vianda", text: message }).catch(() => undefined);
    } else {
      await copy();
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3" aria-labelledby="invite-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="invite-title" className="font-semibold text-text flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
          Portal del paciente
        </h3>
        <Badge variant={status.state === "LINKED" ? "success" : "default"}>{STATUS_COPY[status.state]}</Badge>
      </div>

      {status.state === "PENDING" && !link && (
        <p className="text-sm text-muted">Hay un enlace vigente hasta el {formatDate(status.expiresAt)}. Si lo perdiste, genera uno nuevo.</p>
      )}

      {status.state !== "LINKED" && !link && (
        <Button className="w-full min-h-11" onClick={generate} disabled={isPending}>
          {status.state === "PENDING" ? "Generar nuevo enlace" : "Invitar al portal"}
        </Button>
      )}

      {link && (
        <div className="space-y-3">
          <label htmlFor="invite-link" className="block text-sm font-medium text-text">
            Enlace de invitación
          </label>
          <input
            ref={inputRef}
            id="invite-link"
            readOnly
            value={link.url}
            className="w-full min-h-11 rounded-xl border border-border bg-background px-3 text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="text-xs text-muted">Sólo se muestra una vez. Vence el {formatDate(link.expiresAt)}.</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="min-h-11 gap-1" onClick={share}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Compartir
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border-2 border-primary text-sm font-medium text-primary"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
            <Button variant="outline" className="min-h-11 gap-1" onClick={copy}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 6: Integrar en `src/app/(dashboard)/dashboard/patients/[id]/page.tsx`**

Agregar imports:

```ts
import { getInvitationStatusAction } from "@/features/invitations/actions";
import { InvitePatientPanel } from "@/features/invitations/components/invite-patient-panel";
```

Reemplazar `const patient = await getPatient(id);` por:

```ts
  const [patient, invitationStatus] = await Promise.all([getPatient(id), getInvitationStatusAction(id)]);
```

Reemplazar `<PatientDetailTabs patient={patient} />` por:

```tsx
      {invitationStatus && (
        <InvitePatientPanel patientId={patient.id} patientFirstName={patient.firstName} status={invitationStatus} />
      )}

      <PatientDetailTabs patient={patient} />
```

Responsive: en el mismo archivo, reemplazar `<div className="flex items-start justify-between gap-4">` (cabecera) por `<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">` y `<div className="flex gap-2 shrink-0">` por `<div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">`.

- [ ] **Step 7: Ejecutar** — Run: `pnpm test && pnpm build` → Expected: todo pasa.

- [ ] **Step 8: Verificación manual móvil** — `dev@gmail.com` → Pacientes → Carlos Ruiz → "Invitar al portal": aparece el enlace con Compartir/WhatsApp/Copiar en una fila; WhatsApp abre `wa.me` con el texto; María muestra "Vinculado" sin botón. Capturas.

- [ ] **Step 9: Commit**

```bash
git add src/features/invitations src/app/\(dashboard\)/dashboard/patients/\[id\]/page.tsx tests/integration/create-invitation.test.ts
git commit -m "feat(invitations): enlace de invitación compartible por WhatsApp desde la ficha"
```

---

### Task 13: Aceptar invitación y otorgar consentimiento

**Files:**
- Create: `src/features/consent/consent-documents.ts`
- Create: `src/features/invitations/invitation-preview.ts`
- Create: `src/features/invitations/invite-account.ts`
- Create: `src/features/invitations/accept-invitation.ts`
- Modify: `src/features/invitations/actions.ts` (agregar 2 actions)
- Create: `src/features/invitations/components/invite-sign-up.tsx`, `src/features/invitations/components/consent-step.tsx`
- Create: `src/app/invite/[token]/page.tsx`
- Test: `tests/integration/accept-invitation.test.ts`

**Interfaces:**
- Consumes: `hashInvitationToken`, `invitationState` (T4); `recordAudit` (T5); `createInvitation` (T12).
- Produces: `INVALID_INVITATION_MESSAGE`; `getCurrentConsentDocument(now: Date)`; `getInvitationPreview(token: string, now: Date): Promise<{ state: "NOT_FOUND" | "EXPIRED" | "USED" | "REVOKED" } | { state: "VALID"; patientFirstName: string; professionalName: string }>`; `createInviteAccount(input: unknown, token: string, now: Date): Promise<{ ok: true; email: string } | { ok: false; error: string }>`; `acceptInvitation(input: { token: string; userId: string; consentChecked: boolean; now: Date; ip: string | null; userAgent: string | null }): Promise<{ ok: true; patientId: string } | { ok: false; error: string }>`; server actions `createInviteAccountAction(token: string, formData: FormData)`, `acceptInvitationAction(token: string, formData: FormData)`.

- [ ] **Step 1: Escribir `tests/integration/accept-invitation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { acceptInvitation } from "@/features/invitations/accept-invitation";
import { createInvitation } from "@/features/invitations/create-invitation";
import { createInviteAccount } from "@/features/invitations/invite-account";
import { INVALID_INVITATION_MESSAGE, getInvitationPreview } from "@/features/invitations/invitation-preview";
import { prisma } from "../support/db";
import { createAccount, createConsentDocument, createPatientRecord, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

async function invited() {
  await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const patient = await createPatientRecord(pro.id, { firstName: "Carlos" });
  const result = await createInvitation({ actor: proActor(pro.id), patientId: patient.id, now, ip: null });
  if (!result.ok) throw new Error(result.error);
  return { pro, patient, token: result.token };
}

const accept = (token: string, userId: string, consentChecked = true, at = now) =>
  acceptInvitation({ token, userId, consentChecked, now: at, ip: "203.0.113.7", userAgent: "vitest" });

describe("aceptar invitación", () => {
  it("previsualiza una invitación válida", async () => {
    const { token } = await invited();
    expect(await getInvitationPreview(token, now)).toEqual({ state: "VALID", patientFirstName: "Carlos", professionalName: "Dra. Ruiz" });
    expect(await getInvitationPreview("token-falso", now)).toEqual({ state: "NOT_FOUND" });
  });

  it("vincula, agrega PATIENT, guarda consentimiento y audita atómicamente", async () => {
    const { patient, token } = await invited();
    const account = await createAccount();
    expect(await accept(token, account.id)).toEqual({ ok: true, patientId: patient.id });

    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBe(account.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).roles).toEqual(["PATIENT"]);
    const consent = await prisma.patientConsent.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(consent).toMatchObject({ userId: account.id, ip: "203.0.113.7", userAgent: "vitest", revokedAt: null });
    expect(await prisma.auditLog.count({ where: { action: { in: ["INVITATION_ACCEPTED", "CONSENT_GRANTED"] } } })).toBe(2);
  });

  it("sin consentimiento no vincula", async () => {
    const { patient, token } = await invited();
    const account = await createAccount();
    expect(await accept(token, account.id, false)).toEqual({ ok: false, error: "Debes aceptar la autorización para continuar" });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })).userId).toBeNull();
  });

  it("el enlace es de un solo uso y vence", async () => {
    const { token } = await invited();
    await accept(token, (await createAccount()).id);
    expect(await accept(token, (await createAccount()).id)).toEqual({ ok: false, error: INVALID_INVITATION_MESSAGE });

    const second = await invited();
    expect(await accept(second.token, (await createAccount()).id, true, new Date("2026-12-01T00:00:00Z"))).toEqual({
      ok: false,
      error: INVALID_INVITATION_MESSAGE,
    });
  });

  it("el profesional no puede aceptar su propia invitación", async () => {
    const { pro, token } = await invited();
    expect(await accept(token, pro.id)).toEqual({ ok: false, error: "No puedes vincular tu propia cuenta a una ficha de tu consulta" });
  });

  it("una cuenta no se vincula a dos fichas del mismo profesional", async () => {
    await createConsentDocument("v-extra");
    const pro = await createProfessional();
    const account = await createAccount();
    const first = await createPatientRecord(pro.id);
    const second = await createPatientRecord(pro.id);
    const t1 = await createInvitation({ actor: proActor(pro.id), patientId: first.id, now, ip: null });
    const t2 = await createInvitation({ actor: proActor(pro.id), patientId: second.id, now, ip: null });
    if (!t1.ok || !t2.ok) throw new Error("setup");
    await accept(t1.token, account.id);
    expect(await accept(t2.token, account.id)).toEqual({ ok: false, error: "Tu cuenta ya está vinculada a otra ficha de este profesional" });
  });

  it("crea cuenta de invitado sin roles y rechaza email existente", async () => {
    const { token } = await invited();
    const input = { name: "Carlos Ruiz", email: "Carlos@Test.co", password: "Secreta1" };
    expect(await createInviteAccount(input, token, now)).toEqual({ ok: true, email: "carlos@test.co" });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "carlos@test.co" } })).roles).toEqual([]);
    expect(await createInviteAccount(input, token, now)).toEqual({
      ok: false,
      error: "Ya existe una cuenta con este email. Inicia sesión para continuar.",
    });
    expect(await createInviteAccount(input, "token-falso", now)).toEqual({ ok: false, error: INVALID_INVITATION_MESSAGE });
  });
});
```

Run: `pnpm test:int` → Expected: FAIL por imports inexistentes.

- [ ] **Step 2: Crear `src/features/consent/consent-documents.ts`**

```ts
import { prisma } from "@/infrastructure/database/prisma";

export async function getCurrentConsentDocument(now: Date) {
  return prisma.consentDocument.findFirst({
    where: { effectiveAt: { lte: now } },
    orderBy: { effectiveAt: "desc" },
  });
}
```

- [ ] **Step 3: Crear `src/features/invitations/invitation-preview.ts`**

```ts
import { hashInvitationToken, invitationState } from "@/core/invitations/invitation-token";
import { prisma } from "@/infrastructure/database/prisma";

export const INVALID_INVITATION_MESSAGE = "Este enlace ya no es válido. Pide un enlace nuevo a tu nutricionista.";

export type InvitationPreview =
  | { state: "NOT_FOUND" | "EXPIRED" | "USED" | "REVOKED" }
  | { state: "VALID"; patientFirstName: string; professionalName: string };

export async function findInvitationByToken(token: string) {
  return prisma.patientInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      patient: {
        select: { id: true, firstName: true, professionalId: true, userId: true, professional: { select: { name: true } } },
      },
    },
  });
}

export async function getInvitationPreview(token: string, now: Date): Promise<InvitationPreview> {
  const invitation = await findInvitationByToken(token);
  if (!invitation) return { state: "NOT_FOUND" };
  const state = invitationState(invitation, now);
  if (state !== "VALID") return { state };
  return {
    state: "VALID",
    patientFirstName: invitation.patient.firstName,
    professionalName: invitation.patient.professional.name ?? "Tu nutricionista",
  };
}
```

- [ ] **Step 4: Crear `src/features/invitations/invite-account.ts`**

```ts
import bcrypt from "bcryptjs";
import { z } from "zod";
import { invitationState } from "@/core/invitations/invitation-token";
import { prisma } from "@/infrastructure/database/prisma";
import { INVALID_INVITATION_MESSAGE, findInvitationByToken } from "./invitation-preview";

const inviteAccountSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function createInviteAccount(
  input: unknown,
  token: string,
  now: Date
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const invitation = await findInvitationByToken(token);
  if (!invitation || invitationState(invitation, now) !== "VALID") return { ok: false, error: INVALID_INVITATION_MESSAGE };

  const parsed = inviteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "Ya existe una cuenta con este email. Inicia sesión para continuar." };

  await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 12), roles: [] },
  });
  return { ok: true, email };
}
```

- [ ] **Step 5: Crear `src/features/invitations/accept-invitation.ts`**

```ts
import { invitationState } from "@/core/invitations/invitation-token";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";
import { getCurrentConsentDocument } from "@/features/consent/consent-documents";
import { INVALID_INVITATION_MESSAGE, findInvitationByToken } from "./invitation-preview";

class InvitationClaimError extends Error {}

export async function acceptInvitation(input: {
  token: string;
  userId: string;
  consentChecked: boolean;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ ok: true; patientId: string } | { ok: false; error: string }> {
  if (!input.consentChecked) return { ok: false, error: "Debes aceptar la autorización para continuar" };

  const invitation = await findInvitationByToken(input.token);
  if (!invitation || invitationState(invitation, input.now) !== "VALID") return { ok: false, error: INVALID_INVITATION_MESSAGE };

  const { patient } = invitation;
  if (patient.professionalId === input.userId) {
    return { ok: false, error: "No puedes vincular tu propia cuenta a una ficha de tu consulta" };
  }
  if (patient.userId) return { ok: false, error: "Esta ficha ya está vinculada a una cuenta" };

  const alreadyLinked = await prisma.patient.findFirst({
    where: { professionalId: patient.professionalId, userId: input.userId },
    select: { id: true },
  });
  if (alreadyLinked) return { ok: false, error: "Tu cuenta ya está vinculada a otra ficha de este profesional" };

  const document = await getCurrentConsentDocument(input.now);
  if (!document) return { ok: false, error: "No hay un documento de consentimiento vigente. Contacta a soporte." };

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.patientInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: input.now } },
        data: { acceptedAt: input.now, acceptedById: input.userId },
      });
      if (claimed.count !== 1) throw new InvitationClaimError();

      await tx.patient.update({ where: { id: patient.id }, data: { userId: input.userId } });

      const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { roles: true } });
      await tx.user.update({
        where: { id: input.userId },
        data: { lastArea: "PATIENT", ...(user.roles.includes("PATIENT") ? {} : { roles: { push: "PATIENT" } }) },
      });

      const consent = await tx.patientConsent.create({
        data: { patientId: patient.id, userId: input.userId, documentId: document.id, ip: input.ip, userAgent: input.userAgent },
        select: { id: true },
      });

      await recordAudit(
        { actorId: input.userId, actorRole: "PATIENT", action: "INVITATION_ACCEPTED", entityType: "PatientInvitation", entityId: invitation.id, patientId: patient.id, ip: input.ip },
        tx
      );
      await recordAudit(
        {
          actorId: input.userId,
          actorRole: "PATIENT",
          action: "CONSENT_GRANTED",
          entityType: "PatientConsent",
          entityId: consent.id,
          patientId: patient.id,
          metadata: { documentVersion: document.version },
          ip: input.ip,
        },
        tx
      );
    });
  } catch (error) {
    if (error instanceof InvitationClaimError) return { ok: false, error: INVALID_INVITATION_MESSAGE };
    throw error;
  }

  return { ok: true, patientId: patient.id };
}
```

- [ ] **Step 6: Agregar a `src/features/invitations/actions.ts`**

Imports adicionales:

```ts
import { redirect } from "next/navigation";
import { getSessionActor } from "@/infrastructure/access/access-context";
import { acceptInvitation } from "./accept-invitation";
import { createInviteAccount } from "./invite-account";
```

Funciones al final del archivo:

```ts
export async function createInviteAccountAction(token: string, formData: FormData): Promise<{ email?: string; error?: string }> {
  const result = await createInviteAccount(
    { name: formData.get("name"), email: formData.get("email"), password: formData.get("password") },
    token,
    new Date()
  );
  return result.ok ? { email: result.email } : { error: result.error };
}

export async function acceptInvitationAction(token: string, formData: FormData): Promise<{ error?: string }> {
  const actor = await getSessionActor();
  if (!actor) return { error: "Inicia sesión para continuar" };
  const { ip, userAgent } = await getRequestMeta();
  const result = await acceptInvitation({
    token,
    userId: actor.userId,
    consentChecked: formData.get("consent") === "on",
    now: new Date(),
    ip,
    userAgent,
  });
  if (!result.ok) return { error: result.error };
  redirect("/portal");
}
```

(`createInviteAccountAction` no consulta `prisma` directamente: el guardián no lo exige. `acceptInvitationAction` usa la sesión, no un área, porque quien acepta aún puede no tener rol.)

- [ ] **Step 7: Crear `src/features/invitations/components/invite-sign-up.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/shared/ui/components";
import { createInviteAccountAction } from "../actions";

export function InviteSignUp({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createInviteAccountAction(token, formData);
    if (result.error || !result.email) {
      setError(result.error ?? "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }
    const login = await signIn("credentials", { email: result.email, password: formData.get("password"), redirect: false });
    setLoading(false);
    if (login?.error) {
      setError("Cuenta creada. Inicia sesión para continuar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-text">Crea tu cuenta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nombre completo" id="name" name="name" defaultValue={defaultName} autoComplete="name" className="min-h-11" required />
        <Input label="Email" id="email" name="email" type="email" inputMode="email" autoComplete="email" className="min-h-11" required />
        <Input label="Contraseña" id="password" name="password" type="password" autoComplete="new-password" minLength={6} className="min-h-11" required />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" className="w-full min-h-11" disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta y continuar"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="text-primary font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Crear `src/features/invitations/components/consent-step.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/ui/components";
import { acceptInvitationAction } from "../actions";

export function ConsentStep({
  token,
  professionalName,
  documentVersion,
  documentBody,
}: {
  token: string;
  professionalName: string;
  documentVersion: string;
  documentBody: string;
}) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitationAction(token, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text">Autorización de tratamiento de datos</h1>
        <p className="text-sm text-muted mt-1">Para que {professionalName} pueda acompañarte en Vianda. Versión {documentVersion}.</p>
      </div>
      <div className="max-h-[45dvh] overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm text-text whitespace-pre-line" tabIndex={0}>
        {documentBody}
      </div>
      <label className="flex items-start gap-3 min-h-11 cursor-pointer">
        <input
          type="checkbox"
          name="consent"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span className="text-sm text-text">Autorizo el tratamiento de mis datos personales y de salud</span>
      </label>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" className="w-full min-h-11" disabled={!checked || isPending}>
        {isPending ? "Guardando..." : "Acepto"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 9: Crear `src/app/invite/[token]/page.tsx`**

```tsx
import { LinkIcon } from "lucide-react";
import { getCurrentConsentDocument } from "@/features/consent/consent-documents";
import { ConsentStep } from "@/features/invitations/components/consent-step";
import { InviteSignUp } from "@/features/invitations/components/invite-sign-up";
import { INVALID_INVITATION_MESSAGE, getInvitationPreview } from "@/features/invitations/invitation-preview";
import { auth } from "@/infrastructure/auth/auth";
import { Logo } from "@/shared/ui/brand/logo";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const now = new Date();
  const [preview, session, document] = await Promise.all([getInvitationPreview(token, now), auth(), getCurrentConsentDocument(now)]);

  return (
    <main className="flex min-h-dvh items-start sm:items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 sm:p-8 shadow-sm border border-border">
        <Logo />
        <div className="mt-6">
          {preview.state !== "VALID" ? (
            <div className="text-center space-y-3 py-6">
              <LinkIcon className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
              <p className="text-text font-medium">{INVALID_INVITATION_MESSAGE}</p>
            </div>
          ) : !session?.user?.id ? (
            <>
              <p className="text-sm text-muted mb-4">{preview.professionalName} te invitó a Vianda.</p>
              <InviteSignUp token={token} defaultName={preview.patientFirstName} />
            </>
          ) : document ? (
            <ConsentStep
              token={token}
              professionalName={preview.professionalName}
              documentVersion={document.version}
              documentBody={document.body}
            />
          ) : (
            <p className="text-sm text-danger">No hay un documento de consentimiento vigente. Contacta a soporte.</p>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 10: Ejecutar** — Run: `pnpm test && pnpm build` → Expected: todo pasa.

- [ ] **Step 11: Verificación manual móvil** — abrir el enlace de Carlos (Tarea 12) en una ventana privada a 390×844 (o en el teléfono por Wi‑Fi): crear cuenta → aparece el consentimiento con scroll → "Acepto" deshabilitado hasta marcar → al aceptar va a `/portal` (404 hasta la Tarea 14; esperado). Reabrir el enlace muestra el mensaje de enlace inválido.

- [ ] **Step 12: Commit**

```bash
git add src/features/consent src/features/invitations src/app/invite tests/integration/accept-invitation.test.ts
git commit -m "feat(invitations): aceptación con cuenta nueva y consentimiento versionado"
```

---

### Task 14: Portal mínimo y revocación de consentimiento

**Files:**
- Create: `src/features/consent/revoke-consent.ts`
- Create: `src/features/portal/my-professionals.ts`, `src/features/portal/actions.ts`
- Create: `src/features/portal/components/revoke-consent-button.tsx`
- Create: `src/app/(portal)/portal/layout.tsx`, `src/app/(portal)/portal/page.tsx`
- Test: `tests/integration/revoke-consent.test.ts`

**Interfaces:**
- Consumes: `canRevokeConsent` (T3), `recordAudit` (T5), `getActorFor` (T6), `AppShell`, `PATIENT_NAV`, `areaLinks` (T8), `ConfirmModal`.
- Produces: `revokeConsent(input: { actor: Actor; patientId: string; now: Date; ip: string | null }): Promise<{ ok: true } | { ok: false; error: string }>`; `getMyProfessionals(userId: string): Promise<{ patientId: string; professionalName: string; grantedAt: Date | null }[]>`; actions `getMyProfessionalsAction()`, `revokeConsentAction(patientId: string)`.

- [ ] **Step 1: Escribir `tests/integration/revoke-consent.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { revokeConsent } from "@/features/consent/revoke-consent";
import { getInvitationStatus } from "@/features/invitations/invitation-status";
import { getMyProfessionals } from "@/features/portal/my-professionals";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T12:00:00Z");
const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function linked() {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  return { pro, account, patient };
}

describe("revocar consentimiento", () => {
  it("el portal lista los profesionales vinculados", async () => {
    const { account, patient } = await linked();
    const list = await getMyProfessionals(account.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ patientId: patient.id, professionalName: "Dra. Ruiz" });
  });

  it("revocar desvincula, marca el consentimiento y audita; la ficha se conserva", async () => {
    const { account, patient } = await linked();
    expect(await revokeConsent({ actor: patientActor(account.id), patientId: patient.id, now, ip: null })).toEqual({ ok: true });

    const after = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.userId).toBeNull();
    expect((await prisma.patientConsent.findFirstOrThrow({ where: { patientId: patient.id } })).revokedAt).toEqual(now);
    expect(await prisma.auditLog.count({ where: { action: "CONSENT_REVOKED", patientId: patient.id } })).toBe(1);
    expect(await getMyProfessionals(account.id)).toEqual([]);
    expect(await getInvitationStatus(patient.id, now)).toEqual({ state: "REVOKED_BY_PATIENT" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).roles).toEqual(["PATIENT"]);
  });

  it("no se revoca el consentimiento de otra cuenta", async () => {
    const { patient } = await linked();
    const intruder = await createPatientUser();
    expect(await revokeConsent({ actor: patientActor(intruder.id), patientId: patient.id, now, ip: null })).toEqual({
      ok: false,
      error: "No autorizado",
    });
  });
});
```

Run: `pnpm test:int` → Expected: FAIL por imports inexistentes.

- [ ] **Step 2: Crear `src/features/consent/revoke-consent.ts`**

```ts
import { canRevokeConsent } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

export async function revokeConsent(input: {
  actor: Actor;
  patientId: string;
  now: Date;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, professionalId: true, userId: true },
  });
  if (!patient || !canRevokeConsent(input.actor, { ...patient, consentActive: true })) {
    return { ok: false, error: "No autorizado" };
  }

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.patientConsent.updateMany({
      where: { patientId: patient.id, userId: input.actor.userId, revokedAt: null },
      data: { revokedAt: input.now },
    });
    await tx.patient.update({ where: { id: patient.id }, data: { userId: null } });
    await recordAudit(
      {
        actorId: input.actor.userId,
        actorRole: "PATIENT",
        action: "CONSENT_REVOKED",
        entityType: "PatientConsent",
        patientId: patient.id,
        metadata: { revokedCount: revoked.count },
        ip: input.ip,
      },
      tx
    );
  });

  return { ok: true };
}
```

- [ ] **Step 3: Crear `src/features/portal/my-professionals.ts`**

```ts
import { prisma } from "@/infrastructure/database/prisma";

export async function getMyProfessionals(
  userId: string
): Promise<{ patientId: string; professionalName: string; grantedAt: Date | null }[]> {
  const records = await prisma.patient.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      professional: { select: { name: true } },
      consents: { where: { userId, revokedAt: null }, orderBy: { grantedAt: "desc" }, take: 1, select: { grantedAt: true } },
    },
  });
  return records.map((r) => ({
    patientId: r.id,
    professionalName: r.professional.name ?? "Tu nutricionista",
    grantedAt: r.consents[0]?.grantedAt ?? null,
  }));
}
```

- [ ] **Step 4: Crear `src/features/portal/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { revokeConsent } from "@/features/consent/revoke-consent";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { getMyProfessionals } from "./my-professionals";

export async function getMyProfessionalsAction() {
  const actor = await requireActorFor("PATIENT");
  return getMyProfessionals(actor.userId);
}

export async function revokeConsentAction(patientId: string): Promise<{ error?: string }> {
  const actor = await getActorFor("PATIENT");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await revokeConsent({ actor, patientId, now: new Date(), ip });
  revalidatePath("/portal");
  return result.ok ? {} : { error: result.error };
}
```

- [ ] **Step 5: Crear `src/features/portal/components/revoke-consent-button.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, ConfirmModal } from "@/shared/ui/components";
import { revokeConsentAction } from "../actions";

export function RevokeConsentButton({ patientId, professionalName }: { patientId: string; professionalName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await revokeConsentAction(patientId);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" className="w-full min-h-11" onClick={() => setOpen(true)}>
        Revocar autorización
      </Button>
      {error && <p className="text-sm text-danger mt-2" role="alert">{error}</p>}
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        title="Revocar autorización"
        message={`${professionalName} dejará de compartir tu información contigo en Vianda. Tu nutricionista conserva tu ficha clínica.`}
        confirmLabel="Sí, revocar"
        cancelLabel="Cancelar"
        variant="danger"
        isPending={isPending}
      />
    </>
  );
}
```

- [ ] **Step 6: Layout y página del portal**

`src/app/(portal)/portal/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AREA_LABELS, PATIENT_NAV, areaLinks } from "@/features/identity/navigation";
import { signOutAction, switchAreaAction } from "@/features/identity/session-actions";
import { getActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { AppShell } from "@/shared/ui/navigation/app-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = await getActorFor("PATIENT");
  if (!actor) redirect("/start");

  return (
    <AppShell
      areaLabel={AREA_LABELS.PATIENT}
      items={PATIENT_NAV}
      areas={areaLinks(actor, "PATIENT")}
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      switchAreaAction={switchAreaAction}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
```

`src/app/(portal)/portal/page.tsx`:

```tsx
import { Stethoscope } from "lucide-react";
import { getMyProfessionalsAction } from "@/features/portal/actions";
import { RevokeConsentButton } from "@/features/portal/components/revoke-consent-button";
import { formatDate } from "@/shared/lib/utils";

export default async function PortalHome() {
  const professionals = await getMyProfessionalsAction();

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold text-text">Mis profesionales</h1>
      {professionals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
          <Stethoscope className="h-10 w-10 text-muted mx-auto" aria-hidden="true" />
          <p className="font-medium text-text mt-3">No tienes profesionales vinculados</p>
          <p className="text-sm text-muted mt-1">Pide a tu nutricionista un enlace de invitación.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {professionals.map((p) => (
            <li key={p.patientId} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <div>
                <p className="font-semibold text-text">{p.professionalName}</p>
                {p.grantedAt && <p className="text-sm text-muted">Autorización otorgada el {formatDate(p.grantedAt)}</p>}
              </div>
              <RevokeConsentButton patientId={p.patientId} professionalName={p.professionalName} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Ejecutar** — Run: `pnpm test && pnpm build` → Expected: todo pasa.

- [ ] **Step 8: Verificación manual móvil** — `paciente@emuj.health` a 390×844: aterriza en `/portal`, ve a "Dr. Desarrollador"; barra inferior con "Inicio" + "Cuenta"; revocar con confirmación → estado vacío. Con `dev@gmail.com`, la ficha de María muestra "Acceso revocado por el paciente" y conserva sus valoraciones. Ejecutar `pnpm db:seed` para restaurar el demo.

- [ ] **Step 9: Commit**

```bash
git add src/features/consent src/features/portal src/app/\(portal\) tests/integration/revoke-consent.test.ts
git commit -m "feat(portal): portal mínimo con revocación de consentimiento"
```

---

### Task 15: E2E móvil con Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts`
- Create: `tests/e2e/professional-onboarding.spec.ts`, `tests/e2e/patient-invitation.spec.ts`, `tests/e2e/mobile-navigation.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: textos y roles accesibles definidos en las Tareas 8, 9, 11, 12, 13 y 14; datos del seed (Tarea 2).

- [ ] **Step 1: Instalar**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: `.gitignore`** — agregar:

```
# playwright
/test-results
/playwright-report
```

- [ ] **Step 3: Crear `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";
import { testDatabaseUrl } from "./tests/setup/test-database-url";

process.loadEnvFile(".env");
const PORT = 3100;
const testDb = testDatabaseUrl();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: testDb,
      DIRECT_URL: testDb,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      AUTH_TRUST_HOST: "true",
    },
  },
});
```

- [ ] **Step 4: Crear `tests/e2e/global-setup.ts`**

```ts
import { execSync } from "node:child_process";
import { testDatabaseUrl } from "../setup/test-database-url";

export default function globalSetup(): void {
  process.loadEnvFile(".env");
  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("pnpm exec prisma db push --force-reset --accept-data-loss --skip-generate", { stdio: "inherit", env });
  execSync("pnpm db:seed", { stdio: "inherit", env });
}
```

- [ ] **Step 5: Crear `tests/e2e/helpers.ts`**

```ts
import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

export async function openAccount(page: Page) {
  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("button", { name: "Cuenta" }).click();
  return page.getByRole("dialog", { name: "Cuenta" });
}

export async function logout(page: Page) {
  const account = await openAccount(page);
  await account.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
}
```

- [ ] **Step 6: `tests/e2e/mobile-navigation.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { login, logout, openAccount } from "./helpers";

test("navegación móvil con etiquetas, cambio de área y cierre de sesión", async ({ page }) => {
  await login(page, "dev@gmail.com", "Dev123!");
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const label of ["Inicio", "Pacientes", "Citas", "Herramientas", "Cuenta"]) {
    await expect(nav.getByText(label, { exact: true })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Pacientes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/patients$/);
  await expect(nav.getByRole("link", { name: "Pacientes" })).toHaveAttribute("aria-current", "page");

  const account = await openAccount(page);
  await account.getByRole("button", { name: "Administración" }).click();
  await expect(page).toHaveURL(/\/admin\/professionals$/);

  await logout(page);
});
```

- [ ] **Step 7: `tests/e2e/professional-onboarding.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { login, logout, openAccount } from "./helpers";

test("registro → pendiente → aprobación → acceso", async ({ page }) => {
  const email = `nueva-${Date.now()}@test.co`;

  await page.goto("/register");
  await page.getByLabel("Nombre completo").fill("Laura Gómez");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("Secreta1");
  await page.getByLabel("Número de tarjeta profesional").fill("TP-998877");
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page.getByRole("heading", { name: "Tu cuenta está en revisión" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/pending$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();

  await login(page, "dev@gmail.com", "Dev123!");
  const account = await openAccount(page);
  await account.getByRole("button", { name: "Administración" }).click();
  await page.getByRole("article", { name: "Laura Gómez" }).getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByRole("article", { name: "Laura Gómez" }).getByText("Aprobado")).toBeVisible();
  await logout(page);

  await login(page, email, "Secreta1");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByText("Pacientes")).toBeVisible();
});
```

- [ ] **Step 8: `tests/e2e/patient-invitation.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test("invitar → crear cuenta en móvil → consentir → portal → revocar", async ({ page }) => {
  await login(page, "dev@gmail.com", "Dev123!");
  await page.goto("/dashboard/patients/seed-patient-carlos");
  await page.getByRole("button", { name: "Invitar al portal" }).click();
  const inviteUrl = await page.getByLabel("Enlace de invitación").inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await logout(page);

  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
  await page.getByLabel("Email").fill(`carlos-${Date.now()}@test.co`);
  await page.getByLabel("Contraseña").fill("Secreta1");
  await page.getByRole("button", { name: "Crear cuenta y continuar" }).click();

  await expect(page.getByRole("heading", { name: "Autorización de tratamiento de datos" })).toBeVisible();
  const accept = page.getByRole("button", { name: "Acepto" });
  await expect(accept).toBeDisabled();
  await page.getByLabel("Autorizo el tratamiento de mis datos personales y de salud").check();
  await accept.click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Dr. Desarrollador")).toBeVisible();
  await page.getByRole("button", { name: "Revocar autorización" }).click();
  await page.getByRole("button", { name: "Sí, revocar" }).click();
  await expect(page.getByText("No tienes profesionales vinculados")).toBeVisible();

  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByText("Este enlace ya no es válido")).toBeVisible();
});
```

- [ ] **Step 9: Ejecutar** (con `pnpm dev` detenido)

Run: `pnpm test:e2e` → Expected: `3 passed`.

- [ ] **Step 10: Commit**

```bash
git add playwright.config.ts tests/e2e .gitignore package.json pnpm-lock.yaml
git commit -m "test(e2e): recorridos móviles de onboarding, invitación y navegación"
```

---

### Task 16: Verificación final

- [ ] **Step 1: Suite completa** — `pnpm test && pnpm test:e2e` → todo en verde.
- [ ] **Step 2: Lint y build** — `pnpm lint && pnpm build` → sin errores.
- [ ] **Step 3: Restaurar demo de desarrollo** — `pnpm db:seed`.
- [ ] **Step 4: Recorrido manual con capturas a 390×844** (y una a ≥1280 px por área para confirmar que escritorio no se degradó): `/login`, `/register`, `/pending`, `/dashboard`, ficha de Carlos con el panel de invitación, `/invite/[token]` (cuenta y consentimiento), `/portal`, `/admin/professionals`, hoja "Cuenta". Adjuntar las capturas al resumen para el usuario.
- [ ] **Step 5: Funcionalidad previa** — con `dev@gmail.com`: pacientes (crear, editar, buscar, desactivar), valoración nueva con IMC en vivo, evolución, plan manual y automático, citas, herramientas.
- [ ] **Step 6: Actualizar spec** — en `docs/superpowers/specs/2026-11-04-identidad-acceso-design.md` cambiar `**Estado:**` a `Implementado`.
- [ ] **Step 7: Commit final**

```bash
git add docs/superpowers/specs/2026-11-04-identidad-acceso-design.md
git commit -m "docs: subproyecto A implementado"
```
