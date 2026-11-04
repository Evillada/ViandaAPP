# Subproyecto A — Identidad y acceso

**Fecha:** 2026-11-04
**Estado:** Diseño aprobado — pendiente de plan de implementación
**Origen:** `2026-11-04-nutriai-startup-strategy.md` §3, §5, §6, §9
**Reglas del proyecto:** `CLAUDE.md` (pnpm; responsive-first)

## 1. Objetivo

Construir la base de identidad, permisos, consentimiento y auditoría sobre la que dependen el portal paciente (B), las funciones nuevas del profesional (C), el admin (D) y la API para Flutter (E).

Al terminar A:
- Un nutricionista sólo accede a datos clínicos después de ser aprobado.
- Un paciente obtiene cuenta por invitación de su profesional, otorga consentimiento verificable y puede revocarlo.
- Ningún usuario —tampoco un admin— ve fichas clínicas que no le corresponden.
- Las operaciones sensibles quedan auditadas.

## 2. Problemas actuales que A resuelve

| Hoy (verificado en código) | Riesgo |
|---|---|
| `/api/auth/register` crea `PROFESSIONAL` sin validación | Cualquiera accede a funciones clínicas |
| El middleware sólo verifica sesión; no hay chequeo de rol | Un `USER` entra al panel profesional |
| `Patient` no tiene vínculo con `User` | Imposible un portal paciente |
| Filtros `professionalId: session.user.id` repetidos a mano en cada action | Una action que lo olvide filtra datos |
| Sin consentimiento ni auditoría | Incumplimiento Ley 1581 |
| Navegación móvil: sólo emojis, sin etiquetas, sin cerrar sesión | Incumple regla responsive-first |

## 3. Decisiones

| Tema | Decisión |
|---|---|
| Canal de invitación | Enlace de un solo uso, compartido por el profesional (WhatsApp / menú compartir / copiar). Sin servicio de email. |
| Entrada de profesionales | Registro abierto → perfil `PENDING` sin acceso clínico → admin aprueba tras verificar tarjeta profesional (manual). |
| Cuenta paciente | Una cuenta puede vincularse a varias fichas (una por profesional). |
| Consentimiento | Versionado, con fecha, IP y user agent; por ficha (profesional); revocable. |
| Auditoría | Cambios clínicos, consentimiento, invitaciones, aprobaciones/roles, inicios de sesión y apertura de ficha completa. No listados ni búsquedas. |
| Roles | Varios roles por cuenta (`PATIENT`, `PROFESSIONAL`, `ADMIN`). `ADMIN` **no** da acceso a fichas clínicas ajenas. |
| Arquitectura de permisos | Políticas puras en `core/access` + contexto de acceso por petición + rutas por área + auditoría explícita. |
| Pruebas | Vitest + Playwright (viewport móvil por defecto); BD de prueba en esquema `test` de Supabase. |

## 4. Modelo de datos

### 4.1 Cambios a modelos existentes

- `enum Role`: `USER` → `PATIENT`. Valores: `PATIENT`, `PROFESSIONAL`, `ADMIN`.
- `User.role Role` → `User.roles Role[]` (default vacío). Se añade `lastArea` (`PROFESSIONAL` | `PATIENT` | `ADMIN`, opcional) para recordar el área tras el login.
- `Patient`: se añade `userId String?` (relación a `User`, `onDelete: SetNull`) y `@@unique([professionalId, userId])`.

### 4.2 Modelos nuevos

**`ProfessionalProfile`** — 1:1 con `User`
- `userId` (único), `licenseNumber` (tarjeta profesional), `status` (`PENDING` | `APPROVED` | `REJECTED` | `SUSPENDED`), `reviewedById?`, `reviewedAt?`, `rejectionReason?`, `createdAt`, `updatedAt`.

**`PatientInvitation`**
- `patientId`, `tokenHash` (único; SHA-256 del token), `createdById`, `expiresAt` (creación + 7 días), `acceptedAt?`, `acceptedById?`, `revokedAt?`, `createdAt`.
- Una invitación es válida si `acceptedAt`, `revokedAt` son nulos y `expiresAt > now`.
- Generar una nueva invitación para una ficha revoca las vigentes de esa ficha.
- El token en claro (32 bytes aleatorios, base64url) sólo existe en la respuesta al profesional; nunca se persiste.

**`ConsentDocument`**
- `version` (único, ej. `2026-11-v1`), `body` (texto completo mostrado al paciente), `effectiveAt`.
- El documento vigente es el de mayor `effectiveAt` ≤ ahora.

**`PatientConsent`**
- `patientId` (la ficha), `userId`, `documentId`, `grantedAt`, `ip`, `userAgent`, `revokedAt?`.
- Consentimiento vigente = el más reciente de la ficha con `revokedAt` nulo.

**`AuditLog`**
- `actorId?` (nulo en login fallido), `actorRole?` (área con la que actuó), `action` (enum, §6.4), `entityType`, `entityId?`, `patientId?`, `metadata Json?`, `ip?`, `createdAt`.
- Índices: `(patientId, createdAt)`, `(actorId, createdAt)`, `(createdAt)`.
- Sólo inserción: ninguna action actualiza ni borra registros de auditoría.

## 5. Flujos y pantallas (diseñadas primero a 390 px)

### 5.1 Registro profesional — `/register`
Campos: nombre, email, contraseña, número de tarjeta profesional. Crea `User` con `roles: []` y `ProfessionalProfile` `PENDING`. Redirige a `/pending`.

### 5.2 Cuenta pendiente — `/pending`
Mensaje según estado: en revisión, rechazada (con motivo) o suspendida. Incluye cerrar sesión. Sin acceso a datos clínicos.

### 5.3 Aprobación — `/admin/professionals` (mínimo)
Lista de perfiles `PENDING` en tarjetas (nombre, email, tarjeta, fecha). Acciones: **Aprobar** (añade `PROFESSIONAL`, `status APPROVED`) y **Rechazar** (requiere motivo). También **Suspender** un aprobado (quita acceso; no borra fichas). Todas auditadas en la misma transacción.

### 5.4 Invitar paciente — ficha del paciente
- Estado visible: *Sin invitar* · *Invitación pendiente (vence dd/mm)* · *Vinculado* · *Acceso revocado por el paciente*.
- "Invitar al portal" / "Generar nuevo enlace" crea la invitación y muestra el enlace **una sola vez** con: **Compartir** (Web Share API cuando exista), **WhatsApp** (`https://wa.me/?text=` con mensaje prellenado) y **Copiar**.
- La ficha debe tener nombre; email/teléfono no son obligatorios para invitar.
- No se puede invitar una ficha que ya está vinculada a una cuenta (estado *Vinculado*).

### 5.5 Aceptar invitación — `/invite/[token]`
1. Token inválido, vencido, usado o revocado → pantalla "Este enlace ya no es válido. Pide un enlace nuevo a tu nutricionista."
2. Sin sesión → crear cuenta (nombre prellenado desde la ficha, email, contraseña) o iniciar sesión si ya tiene cuenta.
3. Si la cuenta ya está vinculada a otra ficha del **mismo** profesional → error claro, no se vincula.
   Si la cuenta es la del propio profesional dueño de la ficha → error claro, no se vincula.
4. Pantalla de consentimiento: texto completo del documento vigente (scroll), checkbox explícito, botón "Acepto". Sin checkbox, el botón está deshabilitado.
5. Al aceptar, en una sola transacción: vincula `Patient.userId`, añade `PATIENT` a `roles` si falta, crea `PatientConsent`, marca la invitación aceptada, registra auditoría. Redirige a `/portal`.

### 5.6 Portal mínimo — `/portal`
"Mis profesionales": tarjetas con nombre del profesional y fecha de consentimiento. Acción **Revocar autorización** (con confirmación). El portal completo es el subproyecto B.

### 5.7 Revocar consentimiento
En una transacción: `PatientConsent.revokedAt = now`, `Patient.userId = null`, auditoría. Si el paciente ya no tiene fichas vinculadas, conserva el rol `PATIENT` pero `/portal` muestra estado vacío. El profesional conserva la ficha y ve "Acceso revocado por el paciente".

### 5.8 Enrutamiento tras login
- Sin roles y con perfil profesional → `/pending`.
- Un rol → su área (`/dashboard`, `/portal`, `/admin`).
- Varios roles → `lastArea` si sigue siendo válida; si no, prioridad `PROFESSIONAL` → `PATIENT` → `ADMIN`.

### 5.9 Navegación y marca (responsive-first)
- Móvil: barra inferior con iconos SVG (`lucide-react`) + etiqueta + estado activo; destinos ≥ 44 px. Pestaña **Cuenta** con: cambio de área (si hay varios roles), datos de la cuenta y **Cerrar sesión**.
- `md` y superior: barra lateral con los mismos destinos.
- Cada área (`dashboard`, `portal`, `admin`) tiene su layout con su propia navegación.
- Marca: logo SVG, favicon y `apple-touch-icon`/manifest para pantalla de inicio.

## 6. Arquitectura

### 6.1 Capas

```
src/core/access/          políticas puras (Actor, recurso) → boolean; sin Prisma ni Next
src/core/audit/           interfaz AuditLogger + enum de acciones
src/infrastructure/access/get-access-context.ts   construye el Actor de la petición
src/infrastructure/audit/prisma-audit-logger.ts    implementación con Prisma
src/features/*/actions.ts todas usan getAccessContext() + políticas
```

`Actor = { userId, roles, activeArea, professionalStatus? }`. Las políticas nunca reciben la sesión de Next, para que la API REST (subproyecto E) construya el mismo `Actor` desde un token y reutilice las reglas.

### 6.2 Contexto de acceso
- `getAccessContext()` lee la sesión, carga **desde la BD** los roles y el estado del perfil profesional, y memoiza por petición (`React.cache`).
- Leer de BD (no del JWT) garantiza que aprobaciones y suspensiones tengan efecto inmediato. Costo aceptado: una consulta adicional por petición.
- El proxy (antes middleware) sólo verifica que exista sesión en las rutas protegidas; **no** usa roles del JWT. Los roles del JWT quedan obsoletos tras una aprobación o suspensión y provocarían bucles de redirección (`/dashboard` ↔ `/start`). La restricción por área la hace el layout de cada área con `getActorFor(area)`, que lee la BD. El JWT sólo guarda el `id`.

### 6.3 Matriz de permisos

| Acción | PATIENT | PROFESSIONAL (aprobado) | ADMIN |
|---|---|---|---|
| Ver ficha clínica | Sólo las suyas con consentimiento vigente | Sólo las de sus pacientes | No |
| Editar ficha / valoraciones / planes / citas | No | Sólo sus pacientes | No |
| Crear o revocar invitación | No | Sólo sus pacientes | No |
| Revocar consentimiento | Sólo el propio | No | No |
| Aprobar / rechazar / suspender profesionales | No | No | Sí |
| Ver auditoría | No | Sólo de sus fichas | Toda |

Un profesional con perfil distinto de `APPROVED` no tiene ninguna capacidad de la columna PROFESSIONAL aunque conserve el rol.

### 6.4 Auditoría
Acciones: `AUTH_LOGIN`, `AUTH_LOGIN_FAILED`, `PATIENT_RECORD_VIEWED`, `PATIENT_CREATED`, `PATIENT_UPDATED`, `ASSESSMENT_CREATED`, `MEAL_PLAN_CHANGED`, `APPOINTMENT_CHANGED`, `INVITATION_CREATED`, `INVITATION_REVOKED`, `INVITATION_ACCEPTED`, `CONSENT_GRANTED`, `CONSENT_REVOKED`, `PROFESSIONAL_REGISTERED`, `PROFESSIONAL_APPROVED`, `PROFESSIONAL_REJECTED`, `PROFESSIONAL_SUSPENDED`.

- Operaciones legales (consentimiento, invitaciones, aprobaciones): auditoría **en la misma transacción**; si falla, la operación falla.
- Lectura de ficha (`PATIENT_RECORD_VIEWED`): mejor esfuerzo; si falla se registra el error en el log del servidor y la lectura continúa.
- "Ficha completa" = la página de detalle del paciente y el detalle de una valoración. Listados y búsquedas no se auditan.

### 6.5 Migración del código existente
- Todas las actions de `features/patients`, `features/assessments`, `features/nutrition`, `features/appointments` reemplazan el filtro manual por `getAccessContext()` + política.
- `src/app/(dashboard)` se reorganiza en áreas: profesional (`/dashboard`), paciente (`/portal`), admin (`/admin`), más `/pending` e `/invite/[token]`.

### 6.6 Datos
Supabase sólo contiene datos demo: se reinicia el esquema y se re-siembra (sin migración de datos). El seed deja:
- `dev@gmail.com`: roles `PROFESSIONAL` + `ADMIN`, perfil `APPROVED`.
- `paciente@emuj.health`: rol `PATIENT`, vinculado a la ficha de María García con consentimiento vigente.
- `ConsentDocument` versión `2026-11-v1`.

## 7. Pruebas

Herramientas: Vitest (unitario/integración) y Playwright (E2E, viewport 390×844 por defecto), instaladas con `pnpm add -D`. BD de prueba: esquema `test` en el mismo proyecto Supabase, limpiado en cada ejecución.

| Nivel | Cobertura mínima |
|---|---|
| Unitario `core/access` | Cada celda de la matriz §6.3, incluidas combinaciones de roles y perfiles no aprobados |
| Unitario invitaciones | Token vencido/usado/revocado rechazado; el hash no expone el token |
| Integración actions | Profesional A no lee/edita/invita sobre fichas de B; aceptar invitación crea consentimiento + auditoría atómicamente; revocar corta el acceso del paciente |
| Guardián | Falla si una action de `features/*/actions.ts` consulta datos clínicos sin `getAccessContext()` |
| E2E móvil | Registro → pendiente → aprobación → acceso; invitar → abrir enlace en móvil → consentir → `/portal` → revocar; cerrar sesión desde el móvil |

## 8. Criterios de terminado
1. Todas las pruebas de §7 pasan.
2. `pnpm build` sin errores.
3. Verificación manual en vista móvil de cada pantalla nueva y de la navegación, con capturas.
4. Las funciones existentes (pacientes, valoraciones, planes, citas, herramientas) siguen funcionando para `dev@gmail.com`.

## 9. Fuera de alcance
Portal paciente completo (plan, diario, progreso, citas) · revisión del diario por el profesional · PDF · admin completo (catálogo, gestión de usuarios) · envío de emails · verificación automática en ReTHUS · API REST para Flutter · recuperación de contraseña.

## 10. Pendiente de asesoría legal (no bloquea A, sí bloquea datos reales)
- Texto definitivo del documento de consentimiento y de la política de tratamiento de datos.
- Conservación de la ficha clínica tras la revocación del paciente (obligaciones de historia clínica).
- Transferencia internacional de datos de salud (Supabase en `us-west-2`).
