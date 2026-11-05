# Portal del paciente — Entrega 2 (Cuenta) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/portal/cuenta` completa: mis datos (sólo lectura) + teléfono editable, cambiar contraseña, mis profesionales con paquete contratado y revocar, eliminar cuenta (anonimización) y cerrar sesión. Del lado del profesional: CRUD de paquetes contratados en la ficha.

**Spec:** `docs/superpowers/specs/2026-11-04-portal-paciente-design.md` §3.5, §5 (ServicePackage, User.deletedAt, AuditActions), §6, §7 (paquetes), §8, §9.

**Tech:** Next.js 16 App Router, Prisma 6, Supabase Postgres, NextAuth v5 (**sesión JWT**), Vitest (unit + integración en esquema `test`), Playwright móvil. pnpm siempre.

## Reglas globales

- Toda función exportada de un archivo `"use server"` obtiene actor antes de prisma (guardián). Páginas en `src/app` no importan prisma.
- Lógica de dominio en módulos sin `"use server"` (testeables), las actions sólo resuelven actor/IP y delegan.
- `select` explícito en todo lo que lee el portal; nunca `notes`.
- Mobile-first 390×844, targets ≥ 44 px, iconos lucide, sin emojis, textos en español.
- Esquema: sólo agregados, `prisma db push` (nunca `--force-reset` ni `--accept-data-loss`), luego `pnpm db:security`.
- Antes de comandos prisma/test: `unset DATABASE_URL DIRECT_URL`.

## Correcciones a la spec (decididas al planear)

1. **Sesión JWT:** borrar `Session` no invalida nada. El bloqueo real de una cuenta eliminada es: `loadActor` devuelve `null` si `deletedAt` y `verifyCredentials` rechaza usuarios con `deletedAt`. Así un JWT viejo no obtiene actor en ningún área.
2. **Cuentas con rol profesional o admin no se eliminan desde el portal** (borraría el acceso a todas las fichas del profesional). Error: "Esta cuenta también tiene acceso profesional. Escríbenos para eliminarla."
3. **Teléfono único por persona:** el paciente edita un teléfono y se aplica a todas sus fichas vinculadas con autorización vigente (una auditoría por ficha).
4. Contraseña nueva: mínimo 6 caracteres (mismo criterio que registro e invitación).

---

### Task 1: Esquema — paquetes, `deletedAt`, acciones de auditoría

**Files:** `prisma/schema.prisma`, `src/core/audit/audit.ts`

- [ ] En `prisma/schema.prisma`:

```prisma
enum ServicePackageStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

model ServicePackage {
  id               String               @id @default(cuid())
  name             String
  includedSessions Int?
  startsAt         DateTime
  endsAt           DateTime?
  status           ServicePackageStatus @default(ACTIVE)
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  patientId      String
  patient        Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  professionalId String
  professional   User    @relation("PackageProfessional", fields: [professionalId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("service_packages")
}
```

  - `model User`: agregar `deletedAt DateTime?` y `servicePackages ServicePackage[] @relation("PackageProfessional")`.
  - `model Patient`: agregar `servicePackages ServicePackage[]`.
  - `enum AuditAction`: agregar `ACCOUNT_DELETED`, `PATIENT_PHONE_UPDATED`, `PASSWORD_CHANGED`, `SERVICE_PACKAGE_CHANGED`.
- [ ] En `src/core/audit/audit.ts` agregar las mismas 4 acciones a `AUDIT_ACTIONS`.
- [ ] `pnpm exec prisma format && pnpm exec prisma generate && pnpm test:int` (el setup recrea `test`). Esperado: todo pasa.
- [ ] Aplicar a `public`: `pnpm exec prisma db push --skip-generate` (si avisa pérdida de datos: DETENERSE). Luego `pnpm db:security` y verificar que `service_packages` tiene RLS.
- [ ] Commit: `feat(portal): esquema de paquetes contratados, borrado lógico de cuenta y nuevas acciones de auditoría`

### Task 2: Cuentas eliminadas no obtienen actor ni inician sesión

**Files:** `src/infrastructure/access/access-context.ts`, `src/features/identity/verify-credentials.ts`, tests `tests/integration/access-context.test.ts`, `tests/integration/verify-credentials.test.ts`

- [ ] Tests primero:
  - access-context: usuario PATIENT con `deletedAt` y sesión (`signInAs(id)`) → `getSessionActor()` y `getActorFor("PATIENT")` devuelven `null`.
  - verify-credentials: usuario con contraseña válida (hash bcrypt real) y `deletedAt` → `null` y se audita `AUTH_LOGIN_FAILED`.
- [ ] `loadActor`: seleccionar `deletedAt`; `if (!user || user.deletedAt) return null;`.
- [ ] `verifyCredentials`: `const valid = Boolean(user?.password) && matches && !user?.deletedAt;` (mantener la comparación bcrypt siempre, por tiempo constante).
- [ ] Commit: `feat(identity): las cuentas eliminadas no obtienen actor ni inician sesión`

### Task 3: Dominio de la cuenta del paciente

**Files:** crear `src/core/portal/package-status.ts`, `src/features/portal/account.ts`; tests `tests/unit/portal/package-status.test.ts`, `tests/integration/portal-account.test.ts`

- [ ] `src/core/portal/package-status.ts`:

```ts
export type PackageDisplayStatus = "ACTIVE" | "EXPIRED" | "COMPLETED" | "CANCELLED";
export function packageDisplayStatus(status: "ACTIVE" | "COMPLETED" | "CANCELLED", endsAt: Date | null, now: Date): PackageDisplayStatus {
  if (status === "ACTIVE" && endsAt && endsAt.getTime() < now.getTime()) return "EXPIRED";
  return status;
}
export const PACKAGE_STATUS_LABELS: Record<PackageDisplayStatus, string> = { ACTIVE: "Vigente", EXPIRED: "Vencido", COMPLETED: "Finalizado", CANCELLED: "Cancelado" };
```

  Unit test: activo sin fin → ACTIVE; activo con fin futuro → ACTIVE; activo con fin pasado → EXPIRED; COMPLETED/CANCELLED se mantienen.

- [ ] `src/features/portal/account.ts` (sin `"use server"`), con estas funciones:

  - `getAccountOverview(userId: string, now: Date)` →
    `{ email: string; records: { patientId; professionalName; grantedAt: Date | null; firstName; lastName; documentId; sex; dateOfBirth; phone; packages: { id; name; includedSessions; startsAt; endsAt; status: PackageDisplayStatus }[] }[] }`.
    Sólo fichas con `userId` = usuario **y** consentimiento vigente (`consents: { some: { userId, revokedAt: null } }`), orden `createdAt desc`. `select` explícito (nunca `notes`). Paquetes ordenados `startsAt desc`.
  - `updatePatientPhone(actor: Actor, rawPhone: string, ip: string | null)` → `{ ok: true } | { ok: false; error }`.
    Requiere `actor.activeArea === "PATIENT"`. Normaliza: trim; vacío → `null`; si no vacío debe cumplir `/^\+?[0-9 ()-]{7,20}$/` → si no, `"Teléfono inválido"`. Actualiza `phone` de todas las fichas vinculadas con consentimiento vigente; si no hay ninguna → `"No tienes fichas vinculadas"`. En transacción, una auditoría `PATIENT_PHONE_UPDATED` por ficha (`entityType: "Patient"`, `patientId`, sin el número en metadata).
  - `changePassword(actor: Actor, current: string, next: string, ip: string | null)`.
    Carga `password`; si no coincide (bcrypt) → `"La contraseña actual no es correcta"`; `next.length < 6` → `"La contraseña debe tener al menos 6 caracteres"`; `next === current` → `"La nueva contraseña debe ser diferente"`. Guarda hash bcrypt (12) y audita `PASSWORD_CHANGED` (`entityType: "User"`, `entityId: actor.userId`, `actorRole: "PATIENT"`).
  - `deleteAccount(actor: Actor, confirmation: string, ip: string | null, now: Date)`.
    `confirmation.trim() !== "ELIMINAR"` → `"Escribe ELIMINAR para confirmar"`. Si el usuario tiene rol `PROFESSIONAL` o `ADMIN` o `professionalProfile` → `"Esta cuenta también tiene acceso profesional. Escríbenos para eliminarla."`. En transacción:
    1. `patientConsent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })`
    2. `patient.updateMany({ where: { userId }, data: { userId: null } })`
    3. `account.deleteMany` y `session.deleteMany` del usuario
    4. `user.update`: `email: \`deleted-${id}@deleted.invalid\``, `name: null`, `password: null`, `image: null`, `emailVerified: null`, `roles: []`, `lastArea: null`, `deletedAt: now`
    5. `recordAudit` `ACCOUNT_DELETED` (`entityType: "User"`, `entityId: id`, metadata `{ revokedConsents, unlinkedRecords }`, sin PHI).
- [ ] Tests de integración (`portal-account.test.ts`), usando factories existentes (`createProfessional`, `createPatientUser`, `createPatientRecord`, `createConsentDocument`) y un `patientActor`:
  1. overview devuelve datos de la ficha vinculada, email, profesional y paquete con estado calculado (crear un paquete vencido → `EXPIRED`); no incluye fichas sin consentimiento vigente ni de otras cuentas.
  2. teléfono: actualiza todas las fichas vinculadas, audita una vez por ficha; inválido → error; vacío → `null`; cuenta sin fichas → error; no toca fichas de otra cuenta.
  3. contraseña: actual incorrecta → error; corta → error; igual → error; correcta → hash cambia, `bcrypt.compare(next)` true, audita.
  4. eliminar: sin "ELIMINAR" → error y nada cambia; con "ELIMINAR" → consentimientos revocados, fichas desvinculadas (la ficha y sus valoraciones siguen existiendo), usuario anonimizado con `deletedAt`, auditado; el email original queda libre (`user.findUnique({ email })` → null); `verifyCredentials(emailOriginal, pass)` → null.
  5. eliminar con rol profesional → error y nada cambia.
- [ ] Commit: `feat(portal): dominio de cuenta del paciente (datos, teléfono, contraseña, eliminar cuenta)`

### Task 4: Paquetes contratados — lado del profesional

**Files:** crear `src/features/patients/service-packages.ts`, `src/features/patients/components/service-packages-panel.tsx`; modificar `src/features/patients/actions.ts` (actions + `getPatient` incluye `servicePackages: { orderBy: { startsAt: "desc" } }`), `src/app/(dashboard)/dashboard/patients/[id]/page.tsx`; test `tests/integration/service-packages.test.ts`

- [ ] `service-packages.ts` (sin `"use server"`): `createServicePackage(actor, patientId, input, ip)`, `updateServicePackage(actor, packageId, input, ip)`, `deleteServicePackage(actor, packageId, ip)`.
  - `input`: `{ name: string; includedSessions: string; startsAt: string; endsAt: string; status?: string }` (strings de formulario). Validación: nombre 2–80; sesiones vacío → null, si no entero 1–200; `startsAt` requerido `YYYY-MM-DD` (inicio del día Bogotá = `T05:00:00Z`); `endsAt` opcional `YYYY-MM-DD` (fin del día Bogotá, como `endOfDayBogota` de `portal-settings.ts`; extraer ese helper a un módulo compartido `src/core/portal/bogota-dates.ts` con `startOfDayBogota`/`endOfDayBogota` y reutilizarlo en `portal-settings.ts`); `endsAt >= startsAt`; status ∈ ACTIVE|COMPLETED|CANCELLED.
  - Autorización: `canEditPatientRecord(actor, { professionalId, userId, consentActive: false })` sobre la ficha (para update/delete, la ficha del paquete). Errores: `"Paciente no encontrado"` / `"Paquete no encontrado"`.
  - Audita `SERVICE_PACKAGE_CHANGED` con metadata `{ change: "created" | "updated" | "deleted" }`, `patientId`.
- [ ] Actions en `patients/actions.ts`: `createServicePackageAction(patientId, formData)`, `updateServicePackageAction(packageId, patientId, formData)`, `deleteServicePackageAction(packageId, patientId)` → `{ error?: string }`, cada una con `getActorFor("PROFESSIONAL")` primero y `revalidatePath` de la ficha.
- [ ] `ServicePackagesPanel` (client): título "Plan contratado" con icono `BadgeCheck`; lista de paquetes (nombre, sesiones, vigencia, estado con `PACKAGE_STATUS_LABELS`); botón "Agregar paquete" abre formulario (`Modal`) con nombre, consultas incluidas, inicio, fin, estado; editar y eliminar (`ConfirmModal`) por paquete. Targets ≥ 44 px.
- [ ] Ficha: renderizar `ServicePackagesPanel` debajo de `PortalSettingsPanel`, pasando paquetes serializados (fechas como `YYYY-MM-DD` con `localDateKey`).
- [ ] Tests integración: crear/editar/eliminar con auditoría; validaciones (nombre, fechas invertidas, sesiones); otro profesional no puede crear/editar/eliminar.
- [ ] Commit: `feat(patients): paquetes contratados en la ficha del paciente`

### Task 5: Actions del portal para la cuenta

**Files:** `src/features/portal/actions.ts`, `src/features/identity/components/login-form.tsx`

- [ ] Agregar:
  - `getAccountOverviewAction()` → `requireActorFor("PATIENT")` → `getAccountOverview(actor.userId, new Date())`.
  - `updatePhoneAction(formData)` → `{ error?: string }`; revalida `/portal/cuenta`.
  - `changePasswordAction(formData)` → `{ error?: string }` (campos `currentPassword`, `newPassword`).
  - `deleteAccountAction(formData)` → si error devuelve `{ error }`; si ok: `await signOut({ redirectTo: "/login?deleted=1" })` (import de `@/infrastructure/auth/auth`).
  Todas con `getActorFor("PATIENT")` / `requireActorFor("PATIENT")` primero e IP de `getRequestMeta()`.
- [ ] `LoginForm`: si `searchParams.get("deleted") === "1"` mostrar arriba un aviso `role="status"`: "Tu cuenta fue eliminada. Tu nutricionista conserva tu historia clínica."
- [ ] `pnpm test:unit` (guardián) y `tsc`.
- [ ] Commit: `feat(portal): acciones de cuenta del paciente`

### Task 6: Pantalla `/portal/cuenta`

**Files:** reescribir `src/app/(portal)/portal/cuenta/page.tsx`; crear en `src/features/portal/components/`: `account-details.tsx`, `phone-form.tsx`, `change-password-form.tsx`, `professional-card.tsx`, `delete-account-section.tsx`

- [ ] Orden de secciones (cada una tarjeta `rounded-2xl border bg-surface p-4`):
  1. **Mis datos** (`UserRound`): de la ficha más reciente — nombre completo, CC (`documentId` o "Sin registrar"), sexo (`SEX_LABELS`), fecha de nacimiento, email de la cuenta. Nota pequeña: "Si algún dato está mal, pídele a tu nutricionista que lo corrija." Debajo `PhoneForm` (input `type="tel"`, `autoComplete="tel"`, label "Teléfono", botón "Guardar teléfono", mensaje `role="status"` "Teléfono actualizado").
  2. **Contraseña** (`KeyRound`): `ChangePasswordForm` con dos `PasswordInput` ("Contraseña actual", "Nueva contraseña"), botón "Cambiar contraseña", éxito "Contraseña actualizada" y limpia el formulario.
  3. **Mis profesionales** (`Stethoscope`): por ficha, `ProfessionalCard` — nombre, "Autorización otorgada el …", bloque "Plan contratado": paquete vigente más reciente (nombre, "N consultas incluidas" si hay, "Vigente hasta …" o "Sin fecha de fin", badge de estado); si no hay: "Tu nutricionista no ha registrado un plan contratado". Si hay más paquetes, `<details>` "Ver historial". Luego `RevokeConsentButton` existente. Estado vacío actual se conserva.
  4. **Eliminar mi cuenta** (`Trash2`, tono peligro): texto que explica que se cierra la cuenta, se revocan las autorizaciones y la historia clínica la conserva el profesional; botón "Eliminar mi cuenta" abre `Modal` con input "Escribe ELIMINAR para confirmar", botón de confirmar deshabilitado hasta que el texto sea exactamente ELIMINAR, muestra error si la action lo devuelve.
  5. **Cerrar sesión**: `form` con `signOutAction` (de `session-actions`), botón ancho con `LogOut`.
- [ ] Sin fichas vinculadas: mostrar Mis datos sólo con email (sin teléfono), Contraseña, el estado vacío de profesionales, Eliminar y Cerrar sesión.
- [ ] `tsc`, `pnpm lint`, `pnpm test:unit`.
- [ ] Commit: `feat(portal): pantalla Mi cuenta con datos, teléfono, contraseña, plan contratado y eliminar cuenta`

### Task 7: Seed, E2E y verificación final

**Files:** `prisma/seed.ts`, `tests/e2e/patient-portal.spec.ts`, `tests/e2e/patient-invitation.spec.ts`

- [ ] Seed: `servicePackage.upsert` id `seed-package-maria`, "Plan trimestral", 6 consultas, inicio hace 30 días, fin en 60 días, ACTIVE, de María y `dev`.
- [ ] `patient-portal.spec.ts`, al final en `/portal/cuenta`: ve "Plan trimestral" y "Vigente"; ve "Mis datos"; cambia teléfono a `300 123 4567` → "Teléfono actualizado".
- [ ] `patient-invitation.spec.ts`, tras revocar: en `/portal/cuenta` → "Eliminar mi cuenta" → escribe ELIMINAR → confirma → URL `/login?deleted=1` y aviso visible → intentar login con las mismas credenciales → sigue en `/login` con error.
- [ ] Verificación: `pnpm test:unit`, `pnpm test:int`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm test:e2e` (requiere puerto 3000 libre).
- [ ] Commit: `test(portal): seed con paquete contratado y E2E de cuenta y eliminación`
