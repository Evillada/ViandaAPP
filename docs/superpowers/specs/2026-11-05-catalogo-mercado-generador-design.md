# Catálogo de alimentos, mercado y generador de planes — Diseño

**Fecha:** 2026-11-05 · **Estado:** aprobado en conversación, pendiente de revisión escrita.

## 1. Objetivo

Reemplazar el catálogo demo (20 alimentos escritos a mano en `prisma/seed.ts`) por un catálogo colombiano real, permitir que el paciente marque qué compra y qué le gusta, que el especialista defina restricciones por paciente, y generar planes por **porciones equivalentes** de las Guías Alimentarias de Colombia respetando restricciones, alergias y gustos, con variedad. El plan aprobado produce la lista de compras, y lo que el paciente marca al mercar alimenta el siguiente plan.

## 2. Estado actual (verificado en código)

- Catálogo: 20 alimentos, 7 categorías, 8 nutrientes, en `prisma/seed.ts:35-62`. Etiquetados "ICBF referencia" sin fuente; varios valores parecen USDA. Grasa saturada vacía en todos.
- Generador (`src/core/nutrition/meal-plan-generator.ts`): búsqueda voraz que cuadra kcal y macros. Sin azar (Regenerar devuelve lo mismo), ignora alergias (texto libre en `Assessment.allergies`), sin grupos obligatorios, siempre 3 comidas, 1 día.
- Editor de planes: `<select>` con máximo 50 alimentos, sin buscador ni filtros.
- No existe mercado, lista de compras, preferencias ni alergias estructuradas.

## 3. Fuentes (verificadas el 2026-11-05)

| Fuente | Uso | Licencia / estado |
|---|---|---|
| **TCAC 2018** (ICBF + Universidad Nacional), 773 alimentos, 16 grupos, incluye 95 autóctonos y preparaciones típicas | Base del catálogo | Acceso libre, "Requisitos de ley: ninguno", **sin licencia abierta explícita**. Se cita en cada alimento. Antes del lanzamiento comercial: consulta escrita al ICBF (no bloquea desarrollo). Sólo PDF. |
| **USDA FoodData Central, SR Legacy** | Completar nutrientes faltantes cuando la correspondencia es inequívoca | CC0, citar "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central". |
| **GABA Colombia** (documento técnico MinSalud/ICBF) | 6 grupos del plato, intercambios diarios por edad y sexo, listas de intercambio con peso y medida casera | Documento público. |
| **Resolución 2492 de 2022** (Tabla 17) | Marcas ALTO EN: azúcares libres ≥ 10 % de la energía; grasa saturada ≥ 10 % de la energía; sodio ≥ 1 mg/kcal o ≥ 300 mg/100 g (sólidos) | Norma pública. Aplica a procesados con nutriente **añadido**: no se marca fruta o leche natural. |

El PDF original se guarda en `data/sources/` (ignorado por git; el repositorio es público). Sólo se versiona lo extraído.

## 4. Fases (cada una se diseña en detalle en su plan y se publica por separado)

| Fase | Entrega | Depende de |
|---|---|---|
| A. Catálogo | TCAC cargada + USDA, grupo GABA, porción equivalente, alérgenos, ALTO EN; buscador con filtros en el editor | — |
| B. Restricciones y mercado | Restricciones y plantillas (especialista); "Mi mercado" (paciente); pestaña "Alimentación" (especialista) | A |
| C. Generador | Porciones equivalentes + exclusiones + prioridades + azar con semilla + verificación | A, B |
| D. Lista de compras | Desde el plan aprobado; marcar = "lo compro" | C |

## 5. Datos (sólo agregados; nada se elimina)

- **`Food`** (se amplía): `code` (código TCAC, único cuando existe), `source` (`TCAC_2018` | `USDA_SR` | `MANUAL`), `sourceRef`, `gabaGroup` (enum: `CEREALS_TUBERS`, `FRUITS`, `VEGETABLES`, `DAIRY`, `PROTEINS`, `FATS`, `SUGARS`), `isProcessed`, `allergens` (enum[]: `GLUTEN`, `MILK`, `EGG`, `PEANUT`, `TREE_NUTS`, `FISH`, `SHELLFISH`, `SOY`, `SESAME`), `highIn` (enum[]: `SUGAR`, `SODIUM`, `SATURATED_FAT`), `exchangeGrams` (gramos de 1 porción equivalente), `searchName` (minúsculas sin tildes), `needsReview` (bool). `FoodCategory` conserva los 16 grupos TCAC para navegar.
- **`Nutrient`**: se agregan sodio, azúcares totales, grasa saturada y los demás presentes en la TCAC. Cada `FoodNutrient` registra su origen (`TCAC_2018` | `USDA_SR`).
- **`PatientFoodRestriction`**: `patientId`, `targetType` (`GROUP` | `FOOD` | `HIGH_IN`), `target`, `level` (`AVOID` | `LIMIT`), `maxPortionsPerDay` (sólo `LIMIT`), `origin` (`MANUAL` | `TEMPLATE:<id>`), `note`, `createdById`, fechas. Sólo el especialista dueño de la ficha.
- **`PatientAllergy`**: `patientId`, `allergen` o `foodId`, `status` (`DECLARED` | `CONFIRMED` | `DISMISSED`), `declaredBy` (`PATIENT` | `PROFESSIONAL`), `reviewNote`, fechas. `DECLARED` y `CONFIRMED` excluyen.
- **`PatientFoodPreference`**: `patientId`, `foodId`, `kind` (`LIKE` | `DISLIKE`), único por paciente y alimento.
- **`PantryEntry`**: `patientId`, `foodId`, `purchasedAt` (fecha Bogotá), `origin` (`MARKET` | `SHOPPING_LIST`).
- **Plantillas por condición**: en código (`src/core/food-rules/condition-templates.ts`), versionadas y revisables; sólo sugieren.
- **`MealPlan`**: `generatorSeed`, `generatorVersion`. **`MealItem`**: `reason` (código: `PANTRY`, `LIKED`, `FILLS_GROUP`, `NOT_IN_PANTRY`).
- **Lista de compras**: calculada desde el plan (sin tabla); las casillas marcadas se guardan como `PantryEntry` con `origin = SHOPPING_LIST`.
- **Alcance de los datos del paciente**: lo que marca en el portal se aplica a todas sus fichas con autorización vigente (mismo criterio que el teléfono). Cada especialista ve mercado, gustos y alergias de su paciente, y sólo sus propias restricciones.
- RLS: las tablas nuevas quedan cubiertas por el event trigger `ensure_rls_on_new_tables`; verificar tras `db push`.

## 6. Fase A — Catálogo

1. **Prueba inicial obligatoria**: comprobar que el PDF tiene texto extraíble. Si es imagen escaneada, detenerse y proponer plan B (USDA + lista colombiana curada a mano).
2. **Extracción** con script en `scripts/catalog/` → `data/catalog/tcac-2018.csv` versionado. Validación por alimento: |kcal − (4·P + 4·C + 9·G)| dentro de tolerancia; fuera de ella → `needsReview`. Reporte de extracción (totales, marcados, completados con USDA).
3. **USDA** sólo completa nutrientes ausentes con correspondencia inequívoca, registrando el origen por nutriente.
4. **Grupo GABA** por mapeo de los 16 grupos TCAC + excepciones por alimento. **Porción equivalente y medidas caseras** desde las listas del documento técnico; si el alimento no está, se calcula con la porción de referencia del grupo.
5. **Alérgenos** por reglas (grupo + palabras del nombre) y **revisión humana obligatoria** antes del uso clínico: se entrega la lista para revisión de un nutricionista.
6. **ALTO EN** sólo para `isProcessed` con el dato disponible, con los umbrales de la Resolución 2492.
7. **Carga** idempotente por `code` desde un script de catálogo separado del seed demo. Los 20 alimentos actuales quedan como `MANUAL` (los planes existentes los referencian).
8. **Buscador** en el editor de planes: por `searchName`, filtros por grupo GABA, categoría TCAC y ALTO EN; muestra kcal y macros por porción. Reemplaza el `<select>`.

## 7. Fase B — Restricciones y mercado

- **Especialista, pestaña "Alimentación" de la ficha**: catálogo completo por grupo con buscador y filtros, siempre visible aunque el paciente no haya marcado nada. Etiquetas por alimento: compra, le gusta, no le gusta, alergia (declarada/confirmada), restringido. "Aplicar plantilla": la plantilla propone restricciones y el especialista confirma o ajusta cada una; nada se aplica sin confirmación. Confirmar o descartar alergias declaradas, con nota.
- **Paciente, "Mi mercado"** (sección dentro de la pestaña Plan, con selector superior "Mi plan | Mi mercado", para mantener las 5 pestañas del portal): grupos desplegables con lista de casillas ("lo compro") y un selector por alimento (me gusta / no me gusta / alergia). Buscador y filtros "Lo de mi plan", "Lo que compré", "Todo". Restringidos con aviso neutro: "Tu nutricionista te recomienda no comprarlo" o "Con moderación: máximo N porciones al día". Declarar alergia pide confirmación: "Le avisaremos a tu nutricionista". Mobile-first 390×844, objetivos ≥ 44 px.
- **Auditoría**: crear/editar/eliminar restricción, declarar/confirmar/descartar alergia.

## 8. Fase C — Generador

Lógica pura en `src/core/meal-generator/` (sin prisma), entrada y salida tipadas:

1. **Porciones diarias por grupo**: base GABA por edad y sexo, ajustada a la meta (`targetKcal`, `proteinG`, `carbsG`, `fatG`) usando el aporte de referencia por porción de cada grupo; se admiten medias porciones.
2. **Reparto por comida** según el plato: almuerzo y cena con cereal/tubérculo + proteína + verdura; desayuno con cereal + lácteo o proteína + fruta; meriendas con fruta o lácteo. Plantillas para 3, 5 y 6 comidas.
3. **Elección**: excluir alergias (`DECLARED`, `CONFIRMED`), `AVOID`, `DISLIKE` y grupos que alcanzaron su tope `LIMIT`. Ponderar: comprado en los últimos 14 días ×3, `LIKE` ×2, resto ×1. Variedad: no repetir el alimento principal del almuerzo en la semana.
4. **Cantidades**: `exchangeGrams` × porciones, redondeado a medida casera.
5. **Verificación**: kcal ±5 %, macros ±10 %. Si falla, ajustar grasas y cereales; si persiste, devolver advertencias visibles (nunca ocultarlas).
6. **Salida**: plan `DRAFT` de 1 a 7 días (por defecto 7) y 3, 5 o 6 comidas (por defecto 5), con `reason` por ítem. Azar con semilla: el mismo `generatorSeed` reproduce el plan; "Regenerar" usa semilla nueva.
7. **Validación clínica**: el cálculo de porciones por grupo debe revisarlo un nutricionista antes del uso clínico real.

## 9. Fase D — Lista de compras

- Desde el plan `ACTIVE`: suma gramos semanales por alimento, convierte a unidades de compra con `FoodPortion` ("1 libra", "6 unidades") y agrupa por grupo GABA.
- El paciente marca en el portal; cada casilla crea `PantryEntry` (`SHOPPING_LIST`). Desmarcar el mismo día la elimina.
- Lo restringido o con alergia nunca aparece.

## 10. Pruebas y seguridad

- Unitarias: extracción y validación, mapeo GABA, ALTO EN, plantillas, generador (exclusiones, ponderación, topes `LIMIT`, variedad, verificación, semilla reproducible), conversión a unidades de compra.
- Integración: aislamiento entre pacientes y entre especialistas, alcance por autorización vigente, auditoría.
- E2E móvil: una por fase.
- Política de pruebas: durante el trabajo sólo las de lo que cambia; suite completa una vez antes de publicar cada fase.
- Mismas reglas del portal: actor antes de prisma, `select` explícito, páginas sin prisma.

## 11. Fuera de alcance

Asistente de IA (los datos y las razones quedan listos), precios y supermercados, recetas, planes pediátricos.
