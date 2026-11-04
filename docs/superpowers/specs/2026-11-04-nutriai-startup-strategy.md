# NutriAI / Vianda — Estrategia de Startup (v1)

**Fecha:** 2026-11-04
**Estado:** Propuesta — línea base de decisión
**Base de código actual:** `emuj-health` (Vianda), Next.js 16 + Prisma + PostgreSQL (Supabase)

> Este documento fija el norte estratégico y el alcance de la v1. No es un spec técnico; es la base de la que saldrá el spec funcional (ver §9).

---

## 0. La verdad incómoda primero

Dos cosas que hay que corregir antes de construir:

1. **"Hacer algo para que los gigantes me negocien" no es una estrategia, es un deseo.** Diseñar para ser adquirido produce un producto peor que diseñar para que un profesional no pueda trabajar sin él. La adquisición es un *subproducto* de tracción real + un activo propietario, no una meta de diseño. En este documento la meta es: **que un nutricionista colombiano no pueda volver a su Excel.** Si eso pasa, los gigantes llaman solos.
2. **"Todo para el profesional, el paciente Y el usuario normal" son tres productos.** No caben en v1. El "usuario normal" sin profesional es la cancha de MyFitnessPal — exactamente donde no queremos competir. Decisión: en v1 el paciente/usuario entra **a través de un profesional** (invitación) o como tier gratuito limitado que embudona hacia uno.

---

## 1. Posicionamiento

**NutriAI no es "una app de nutrición con IA". Es la plataforma donde el nutricionista colombiano trabaja — y el paciente vive entre consultas.** B2B2C clínico, no B2C de consumo.

- **Mercado inicial:** Colombia.
- **Cliente que paga primero:** el profesional (nutricionista). El paciente llega gratis, invitado por él.
- **Lo auténtico = profundidad, no paridad de funciones.** No competimos por tener más pantallas; competimos por que los datos produzcan mejores decisiones.

### El moat (lo que nos hace defendibles)
1. **Rigor clínico real** — ya codificado: TMB (3 fórmulas), antropometría ISAK/OMS, pliegues, somatotipo Heath-Carter, composición corporal, diagnóstico + CIE-10.
2. **El profesional dentro del loop** — el sistema propone y calcula; el profesional valida y aprueba. Esto nos mantiene fuera de la zona de "dispositivo médico/prescripción automática".
3. **Catálogo ICBF + preparaciones colombianas** — activo propietario que ningún gigante gringo va a construir. *(likely: este es el activo que más vale en una negociación futura.)*
4. **Continuidad clínica** — lo que el paciente registra entre citas alimenta la valoración del profesional. Resuelve el abandono por falta de acompañamiento.

---

## 2. Decisión sobre IA (v1 SÍ / NO)

**La v1 NO lleva IA.** No es recorte de ambición, es foco y control de costos/riesgo.

| En v1 (NO IA) | Diferido (v2+, con IA) |
|---------------|------------------------|
| Cálculos clínicos deterministas (ya hechos) | Lectura de foto de comida → veredicto |
| Catálogo y búsqueda de alimentos | Escáner de código de barras |
| Planes construidos por el profesional | Asistente conversacional / RAG |
| Reglas de seguridad como lógica, no como modelo | Sugerencia automática de menús |

*(certain: el motor de reglas clínicas no necesita IA; es lógica determinista versionada. La IA sólo entra después como interfaz de explicación, nunca como prescriptor.)*

---

## 3. Los tres entornos y el alcance v1

### 3.1. Profesional (el núcleo — gran parte ya existe)
- Panel de pacientes, valoraciones con antropometría, cálculos automáticos (IMC/TMB/macros/agua). **[existe]**
- Planes alimentarios vs. metas, versionados. **[existe]**
- Citas. **[existe]**
- **Nuevo v1:** invitar paciente, revisar su diario, aprobar/activar plan como indicación, reportes exportables (PDF).

### 3.2. Paciente (portal responsive — nuevo en v1)
- Acceso **por invitación** del profesional.
- Ver su plan activo y recetas/porciones.
- Diario alimentario **manual** (sin foto, sin escáner).
- Progreso: peso y adherencia básica.
- Ver próximas citas.
- Educación: contenido general (no clínico personalizado sin profesional).

### 3.3. Administración (nuevo v1, mínimo)
- Gestión de usuarios y validación de profesionales.
- Gestión del catálogo de alimentos (ICBF + preparaciones).
- Auditoría de operaciones sensibles.
- **Separado del portal clínico** — permisos independientes.

### Diferido explícito (NO v1)
Marketplace · videoconsultas · integraciones con wearables · planes familiares · escáner · foto IA · asistente IA · usuario standalone sin profesional.

---

## 4. Clasificación de recomendaciones (motor de reglas, sin IA)

El valor único. Cada recomendación cae en un nivel:

| Nivel | Comportamiento |
|-------|----------------|
| Orientación general | Consejo educativo, sin personalizar. |
| Personalización básica | Ajuste por preferencias/objetivos. |
| Personalización especializada | Reglas revisadas para condiciones específicas. |
| Supervisión profesional | Requiere aprobación del profesional. |
| Riesgo / incertidumbre | No se emite recomendación; se advierte y se deriva. |

**Regla dura:** el sistema nunca asume etapa de enfermedad, resultados de laboratorio ni indicaciones médicas que el usuario no haya aportado y validado.

---

## 5. Tecnología — decisiones

- **Mantener Next.js** (lo que ya hay). **Responsive-first obligatorio:** cada pantalla se diseña pensando en móvil, porque la v2 migra a **Flutter** para App Store / Play Store.
- **API-first desde ya:** la lógica de negocio no vive en los componentes; vive en `core/` + server actions con fronteras limpias, para que Flutter consuma la misma API después sin reescribir el dominio. *(likely: esta es la decisión técnica que más barato te sale ahora y más caro si la ignoras.)*
- **Base de datos: PostgreSQL en Supabase** (migrada desde SQLite el 2026-11-04). Pendiente antes de datos reales: región del proyecto y transferencia internacional de datos sensibles (ver §6).
- Arquitectura hexagonal ligera ya existente — respetarla. No microservicios: monolito modular.

---

## 6. Seguridad y regulación (Colombia)

- Datos de salud = dato sensible bajo **Ley 1581 de 2012** → consentimiento explícito, cifrado en tránsito y reposo, control de acceso por rol **y** por relación profesional-paciente.
- Separar información clínica de la comercial.
- Auditoría de operaciones sensibles desde v1.
- **Pendiente con asesoría especializada:** determinar si alguna función cae bajo software como dispositivo médico o prestación de servicios de salud (Ley 2015 de 2020, interoperabilidad de historia clínica). No asumir que "app de nutrición" está automáticamente fuera.

---

## 7. Modelo de negocio

| Línea | Modelo | Cuándo |
|-------|--------|--------|
| Profesional | Suscripción mensual/anual | **v1 — primera fuente de ingreso** |
| Paciente | Gratis (invitado por profesional) | v1 |
| Clínicas | Licenciamiento | v2 |
| Empresas / bienestar | B2B | v2+ |

- Nunca monetizar datos de salud. La publicidad nunca altera una recomendación clínica.
- Precios: hipótesis a validar, no cerrados.

---

## 8. Riesgos principales

| Riesgo | Mitigación |
|--------|-----------|
| Perseguir 3 públicos en v1 | Foco: profesional primero, paciente por invitación |
| "Construir para ser adquirido" | Construir para retención del profesional; adquisición = subproducto |
| Datos nutricionales incorrectos | Fuente + trazabilidad por alimento (nivel de confianza) |
| Salto a Flutter mal preparado | API-first y responsive desde v1 |
| Regulación de salud | Asesoría legal antes de funciones clínicas personalizadas |
| Datos de salud alojados fuera de Colombia (Supabase `us-west-2`) | Validar transferencia internacional bajo Ley 1581 antes de cargar pacientes reales |

---

## 9. Siguiente entregable

Convertir este documento en un **spec funcional ejecutable**: historias de usuario, modelo E-R partiendo del Prisma actual, matriz de roles/permisos, contratos de API (pensando en Flutter), y backlog priorizado P0/P1 del portal paciente y del admin — que es lo único verdaderamente nuevo de la v1.

---

## Decisiones de línea base

| Decisión | Definición |
|----------|------------|
| Producto | Plataforma clínica de nutrición, profesional-first |
| Mercado inicial | Colombia |
| Público v1 | Profesional (paga) + paciente por invitación |
| IA en v1 | No |
| Plataforma v1 | Web responsive (Next.js) → Flutter en v2 |
| Diferenciador | Rigor clínico + profesional-in-loop + catálogo ICBF + continuidad |
| Negocio | Suscripción profesional → B2B clínicas/empresas |
| Meta real | Que el nutricionista no pueda volver a su Excel |
