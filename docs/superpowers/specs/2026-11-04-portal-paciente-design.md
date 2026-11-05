# Subproyecto B — Portal del paciente

**Fecha:** 2026-11-04
**Estado:** Diseño aprobado en conversación — pendiente de revisión del documento
**Depende de:** Subproyecto A (identidad, invitaciones, consentimiento) — implementado.

## 1. Objetivo

Que el paciente, desde el teléfono, sepa **qué comer hoy y esta semana**, vea **su progreso** según lo que registra su profesional, administre **su cuenta**, y que al entrar reciba un **saludo que lo motive** sin riesgo clínico.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Navegación | 5 pestañas inferiores: **Hoy**, **Plan**, **Citas**, **Progreso**, **Cuenta** (mismo patrón y cantidad que el área profesional). Mobile-first 390×844, iconos lucide, targets ≥ 44 px, sin emojis. |
| Semana | El ciclo de días del plan activo se repite desde `activatedAt`. La app calcula qué día del ciclo toca en cada fecha real. |
| Citas | Sólo lectura: próximas e historial. El paciente no agenda ni cancela desde la app en esta versión (lo hace el profesional). |
| Editar datos | El paciente edita **teléfono** y **contraseña**. Nombre, cédula, sexo y fecha de nacimiento: sólo lectura (los corrige el profesional; afectan cálculos clínicos). |
| Notas | Campo nuevo **Indicaciones para el paciente** en valoración y plan. Los campos `notes` existentes son internos y **nunca** se muestran al paciente. |
| Plan contratado | **Paquete de servicio** que el profesional registra a mano en la ficha (sin pagos en la app). |
| Saludo | Saludo por hora y nombre + un dato real positivo + frase del día de una **lista curada** (hábitos/autocuidado, nunca peso como meta). Mensaje personal opcional del profesional que reemplaza la frase mientras esté vigente. El profesional puede **apagar los mensajes de progreso** por paciente. |
| Eliminar cuenta | **Anonimización**, no borrado físico: la historia clínica pertenece al profesional y se conserva (Res. 839/2017), y `PatientConsent` tiene `onDelete: Restrict` como prueba legal. |
| Varios profesionales | Si el paciente está vinculado a más de uno, un selector arriba elige de quién ve plan y progreso (por defecto, el vínculo más reciente). |

## 3. Pantallas

### 3.1 Hoy (`/portal`)
1. **Saludo** (§4).
2. **Próxima cita**, si existe (fecha, hora, profesional).
3. **Menú de hoy**: comidas del día del ciclo que corresponde a hoy, cada una con alimentos, cantidad y porción; total de kcal del día vs. meta (`NutritionalGoal.targetKcal` de la valoración del plan).
4. **Indicaciones vigentes** del plan (`MealPlan.patientInstructions`).
5. Sin plan activo: estado vacío "Tu profesional aún no ha activado un plan".

### 3.2 Plan (`/portal/plan`)
El plan alimentario que el profesional armó para el paciente, con dos vistas (control segmentado arriba):
- **Esta semana** (por defecto): 7 fechas reales (lunes a domingo; navegación a semana anterior/siguiente). Cada fecha muestra el día del ciclo que le toca y sus kcal; al tocar se expande el menú. Hoy queda resaltado. Fechas anteriores a `activatedAt` muestran "Plan aún no activo".
- **Plan completo**: la lista de todos los días del plan (Día 1…Día N) con todas sus comidas — desayuno, media mañana, almuerzo, onces, cena, etc. — y por cada comida sus alimentos con cantidad, porción en gramos y kcal; total de kcal y macros por día frente a la meta. Encabezado con nombre del plan, profesional, fecha de activación e **indicaciones para el paciente**.

### 3.3 Citas (`/portal/citas`)
- **Próximas**: fecha, hora, duración, profesional, motivo y estado (programada). La más cercana arriba y destacada.
- **Historial**: citas pasadas con estado (completada / cancelada), de la más reciente a la más antigua.
- Sólo de vínculos con autorización vigente. Estado vacío: "No tienes citas programadas".

### 3.4 Progreso (`/portal/progreso`)
- **Una sola gráfica de línea** con selector de medida (Cintura, Peso, IMC, % grasa; en ese orden, la cintura abierta por defecto), un punto por valoración, de la más antigua a la más reciente. Si sólo hay una valoración, se muestran los valores sin gráfica.
- **Tarjeta "Tu última valoración"**: valores y cambio frente a la anterior en lenguaje neutro ("1,2 cm menos que la valoración anterior"), sin colores verde/rojo ni juicios de mejor/peor.
- **Metas actuales**: kcal, proteína/carbohidratos/grasa (g y %), agua (ml/día). Salen del plan activo y, si no hay, de la última valoración con metas.
- Lista de valoraciones → detalle (`/portal/progreso/[assessmentId]`): fecha, tipo, antropometría registrada, diagnóstico nutricional y CIE-10, **indicaciones para el paciente** = `MealPlan.patientInstructions` del plan más reciente (no borrador ni cancelado) ligado a esa valoración, aunque esté vacío; no se agrega campo nuevo. Nunca `notes`, `anthropometryNotes` ni `DietaryRecall.notes`.
- **Interruptor del profesional** (`Patient.progressMessagesEnabled`): apagado oculta, además de los mensajes del saludo, las gráficas, la tarjeta de última valoración, la antropometría y el diagnóstico del detalle. Metas, lista de valoraciones e indicaciones siguen visibles. Pensado para pacientes con riesgo de trastorno de la conducta alimentaria.

### 3.5 Cuenta (`/portal/cuenta`)
- **Mis datos** (de la ficha vinculada): nombre, cédula, sexo, fecha de nacimiento, email de la cuenta — sólo lectura. **Teléfono** editable.
- **Contraseña**: cambiar (pide la actual).
- **Mis profesionales**: por cada vínculo con autorización vigente — nombre, fecha de autorización, **paquete contratado** (nombre, consultas incluidas, vigencia, estado) y **Revocar autorización** (ya existe; se mueve aquí).
- **Eliminar mi cuenta** (§6), con confirmación escribiendo "ELIMINAR".
- **Cerrar sesión**.

## 4. Saludo de entrada

- **Saludo**: "Buenos días / Buenas tardes / Buenas noches, {primer nombre}" según la hora en `America/Bogota`.
- **Dato real** (uno, el primero que aplique):
  1. Cita en los próximos 7 días → "Tu próxima cita es el {día}".
  2. Plan activo → "Llevas {n} días con tu plan".
  3. Mejora entre las dos últimas valoraciones **en la dirección del objetivo** y mensajes de progreso habilitados → p. ej. "Tu cintura bajó {x} cm desde tu última valoración". La dirección del objetivo se deriva del diagnóstico de IMC de la última valoración (exceso → bajar; bajo peso → subir; normal → no se celebran cambios de peso, sólo de cintura si baja).
- **Frase del día**: lista curada en código (`src/core/portal/daily-phrases.ts`, ≥ 60 frases). Selección determinista por fecha + id de usuario (la misma todo el día, distinta entre pacientes). Reglas de contenido: hábitos, autocuidado, constancia; prohibido mencionar peso, kilos, "dieta", cuerpo ideal o prometer resultados. Un test unitario verifica que ninguna frase contiene términos prohibidos.
- **Mensaje del profesional** (`Patient.portalMessage`, opcional, con `portalMessageUntil`): si está vigente reemplaza la frase del día y se muestra firmado por el profesional.
- Lógica pura y testeable en `src/core/portal/greeting.ts` (entrada: datos ya cargados + fecha; salida: textos).

## 5. Datos (sólo agregados, nada se elimina)

```prisma
model MealPlan {
  // ...
  activatedAt         DateTime?
  patientInstructions String?
}

model Assessment {
  // ...
  patientInstructions String?
}

model Patient {
  // ...
  portalMessage           String?
  portalMessageUntil      DateTime?
  progressMessagesEnabled Boolean   @default(true)
  servicePackages         ServicePackage[]
}

model ServicePackage {
  id                  String               @id @default(cuid())
  name                String               // "Plan trimestral"
  includedSessions    Int?
  startsAt            DateTime
  endsAt              DateTime?
  status              ServicePackageStatus @default(ACTIVE)
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  patientId           String
  patient             Patient              @relation(fields: [patientId], references: [id], onDelete: Cascade)
  professionalId      String
  professional        User                 @relation(fields: [professionalId], references: [id], onDelete: Cascade)
  @@index([patientId])
  @@map("service_packages")
}

enum ServicePackageStatus { ACTIVE COMPLETED CANCELLED }

model User {
  // ...
  deletedAt DateTime?
}
```

- `User` gana la relación inversa `servicePackages ServicePackage[]`. `AuditAction` gana `ACCOUNT_DELETED`, `PATIENT_PHONE_UPDATED`, `PASSWORD_CHANGED`, `SERVICE_PACKAGE_CHANGED`.
- Gráficas: SVG propio (línea simple), sin dependencias nuevas.
- `activatedAt` se fija en `activateMealPlan`. Planes ya activos sin `activatedAt`: se usa `updatedAt` como respaldo.
- El estado del paquete mostrado al paciente se calcula: `ACTIVE` con `endsAt` pasado → "Vencido".
- Aplicación del esquema: `prisma db push` (igual que el subproyecto A). La línea base de migraciones sigue pendiente aparte.

## 6. Eliminar cuenta (anonimización)

En una transacción:
1. Revocar todas las `PatientConsent` vigentes del usuario (`revokedAt = now`).
2. Desvincular sus fichas (`Patient.userId = null`) — la ficha clínica queda con el profesional.
3. Anonimizar el usuario: `email = "deleted-{id}@deleted.invalid"`, `name = null`, `password = null`, `image = null`, `roles = []`, `lastArea = null`, `deletedAt = now`. Borrar `Account`/`Session`.
4. Auditar `ACCOUNT_DELETED` (sin PHI).
5. Cerrar sesión y redirigir a `/login` con aviso "Tu cuenta fue eliminada".

`getActorFor` y el login rechazan usuarios con `deletedAt`. El email queda libre para un registro nuevo.

## 7. Lado del profesional

- **Editor de plan**: agregar día, duplicar día (copia comidas e ítems), renombrar y eliminar día; máximo 7 días; mínimo 1.
- **Valoración y plan**: campo "Indicaciones para el paciente" (textarea, opcional, máx. 2 000 caracteres).
- **Ficha del paciente**: sección "Portal del paciente" (ya existe con la invitación) + mensaje personal con vigencia, interruptor de mensajes de progreso, y CRUD de paquetes contratados.

## 8. Seguridad y acceso

- Política nueva `canPatientViewRecord(actor, record)`: actor con rol PATIENT, `record.userId === actor.userId` y autorización vigente. Toda lectura del portal pasa por ella.
- Lecturas del portal en módulos `src/features/portal/*.ts` (no "use server") con `select` explícito: nunca se seleccionan `notes`, `anthropometryNotes`, `DietaryRecall.notes` ni datos de otros pacientes. Sólo planes `ACTIVE`.
- Server actions nuevas exigen actor (el guardián estático ya lo impone).
- Editar teléfono: sólo `Patient.phone` de fichas vinculadas al actor con autorización vigente; auditado.
- Cambiar contraseña: verifica la actual con bcrypt; auditado.

## 9. Pruebas

- **Unitarias**: `greeting.ts` (hora, prioridad del dato, dirección del objetivo, mensaje del profesional vigente/vencido, progreso apagado), cálculo del día del ciclo (incluye cambio de mes y planes de 1 y 7 días), frases sin términos prohibidos.
- **Integración**: paciente no ve fichas ajenas ni de profesionales con autorización revocada; no ve borradores ni `notes`; eliminar cuenta revoca, desvincula, anonimiza y bloquea el login; editar teléfono sólo en fichas propias; duplicar día copia ítems.
- **E2E móvil**: paciente entra → ve saludo y menú de hoy → plan (semana y completo) → citas → progreso → cuenta (edita teléfono) → elimina cuenta → no puede iniciar sesión.

## 10. Entregas

1. **Hoy, Plan y Citas** (navegación de 5 pestañas incluida): saludo, menú del día, plan (semana y completo), citas, días múltiples en el editor, indicaciones del plan, `activatedAt`.
2. **Cuenta**: datos, teléfono, contraseña, mis profesionales + paquete contratado (incluye CRUD del profesional), eliminar cuenta.
3. **Progreso**: gráficas, metas, detalle de valoración, indicaciones de la valoración.

Cada entrega se publica por separado en `main`.

## 11. Fuera de alcance

Pagos en la app · diario de comidas del paciente y revisión por el profesional · chat · notificaciones push/email · PDF del plan · segundo factor al aceptar invitación (pendiente de A) · modo sin conexión.
