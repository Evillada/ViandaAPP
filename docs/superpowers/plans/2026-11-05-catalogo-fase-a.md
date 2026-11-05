# Catálogo — Fase A (TCAC + intercambios GABA + buscador) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Catálogo colombiano real en la base: alimentos de la TCAC 2018 (análisis proximal + sodio, grasa saturada y parte comestible) extraídos por OCR validado, con grupo GABA, porción equivalente y medida casera de las Guías, alérgenos y ALTO EN; buscador con filtros en el editor de planes; el generador actual protegido hasta la fase C.

**Spec:** `docs/superpowers/specs/2026-11-05-catalogo-mercado-generador-design.md` §3, §5, §6.

**Tech:** Next.js 16, Prisma 6, Supabase Postgres, Vitest (unit + integración en esquema `test`), Playwright móvil, pnpm. OCR: Vision de macOS vía Python (`ocrmac`, `pypdfium2`) sólo en la máquina del desarrollador; todo lo demás en TypeScript.

## Reglas globales

- Fuentes en `data/sources/` (ignorado por git; repositorio público). Se versiona sólo lo derivado en `data/catalog/`.
- El OCR sólo vuelca cajas de texto; **toda la lógica** (filas, columnas, números, validación) es TypeScript puro en `src/core/catalog/` con pruebas.
- Cambios de esquema **sólo aditivos** (la misma base sirve a Vercel). Nada se elimina ni renombra.
- Toda función exportada de `"use server"` resuelve actor antes de prisma (guardián). Páginas sin prisma.
- Antes de prisma/pruebas: `unset DATABASE_URL DIRECT_URL`; nunca dos procesos de pruebas a la vez.
- Pruebas por tarea: sólo los archivos de la tarea. Suite completa una vez al final.
- Mobile-first 390×844, objetivos ≥ 44 px, lucide, sin emojis, textos en español.

## Hechos medidos (2026-11-05)

- `tcac_web.pdf`: 147 páginas, sin capa de texto, 623,25 × 623,25 pt. Tablas nutricionales en páginas 43–108 (impares: proximal; pares: minerales/vitaminas/ácidos grasos con el código al final).
- Página proximal, centro x relativo de cada columna (medido en páginas 45 y 81, coincide ±0,005): código 0,089 · nombre 0,20 · humedad 0,586 · kcal 0,630 · kJ 0,668 · proteína 0,710 · lípidos 0,752 · carb. totales 0,792 · carb. disponibles 0,833 · fibra 0,873 · cenizas 0,916.
- Página derecha: columnas **varían por página** (sodio en 0,180 en p. 46 y 0,209 en p. 82); se calibran con el encabezado vertical (recorte rotado 90°).
- OCR con errores reales observados: dígito cambiado (62→52), código cambiado (H006→H005), celda perdida, carácter extraño ("0.т"), dos celdas en una caja ("6 30"), filas con y ligeramente distinta.
- GABA, documento técnico (texto): tablas 26–45 listas de intercambio (`Alimento Peso(g) Medida casera`), tabla 46 aporte por intercambio, tabla 56 intercambios/día.

---

### Task 1: Volcado OCR (script local)

**Files:**
- Create: `scripts/catalog/ocr_tcac.py`, `scripts/catalog/README.md`
- Output (no versionado): `data/sources/ocr/page-043.json` … `page-108.json`

- [ ] **Step 1:** Script que, para cada página 43–108, renderiza a escala 4 con `pypdfium2`, ejecuta `ocrmac.OCR(img, recognition_level="accurate", language_preference=["es-ES"])` y escribe `{ page, width, height, boxes: [{ text, conf, x, y, w, h }] }` con coordenadas relativas y **y medida desde arriba** (`1 - y - h`). Para páginas pares, además OCR del encabezado (franja superior 0,08–0,26 de alto) rotado 90° y guardado como `headerBoxes` con x relativa a la página (deshacer la rotación).
- [ ] **Step 2:** README: crear venv en `data/sources/.venv`, `pip install ocrmac pypdfium2`, comando de ejecución, y aclaración de que sólo corre en macOS y no hace parte del build.
- [ ] **Step 3:** Ejecutar y comprobar: 66 archivos, cada página impar con ≥ 10 cajas que cumplen `/^[A-Z]\d{3}$/`.
- [ ] **Step 4:** Commit (sólo `scripts/catalog/`).

### Task 2: Análisis de páginas (TypeScript puro)

**Files:**
- Create: `src/core/catalog/ocr-types.ts`, `src/core/catalog/tcac-parse.ts`
- Test: `tests/unit/catalog/tcac-parse.test.ts` (cajas sintéticas que reproducen los errores medidos)

**Interfaces:**
- `parseNumber(raw: string): number | null | "INVALID"`: coma o punto decimal; vacío → `null`; cualquier carácter no numérico (`т`, `O`, `l`) → `"INVALID"` (nunca adivinar).
- `groupRows(boxes, codeColumnX, tolerance)`: filas ancladas a cada caja-código; las demás cajas van a la fila cuyo centro y está más cerca, si la distancia ≤ mitad de la separación mediana entre códigos.
- `splitMergedBox(box, columns)`: una caja con espacios que abarca varias columnas se reparte en partes proporcionales a su ancho.
- `assignColumns(row, columns)`: cada valor a la columna de centro más cercano dentro de ± la mitad de la distancia entre columnas; fuera de rango → `"UNASSIGNED"`.
- `PROXIMAL_COLUMNS` (centros medidos arriba), `calibrateRightColumns(headerBoxes)`: reconoce por texto Sodio, Grasa Saturada, Parte Comestible y Código (insensible a tildes) y devuelve sus centros.
- `parseProximalPage(page) → ProximalRow[]`, `parseRightPage(page) → RightRow[]` (código, sodio, grasa saturada, parte comestible).

- [ ] **Step 1:** Pruebas que fallan: número con coma, vacío, inválido; filas con y desalineada; caja "6 30" repartida en dos columnas; celda perdida queda `null` (y la fila se marca después por validación); calibración del encabezado con dos disposiciones distintas.
- [ ] **Step 2:** Implementar hasta verde. `pnpm vitest run --config vitest.config.mts tests/unit/catalog/tcac-parse.test.ts`.
- [ ] **Step 3:** Commit.

### Task 3: Validación por fila

**Files:**
- Create: `src/core/catalog/tcac-validate.ts`
- Test: `tests/unit/catalog/tcac-validate.test.ts`

**Interfaces:** `validateRow(row): Issue[]` y `validateCatalog(rows): Issue[]`, con `Issue = { code, field?, message }`:
- `PROXIMATE_SUM`: |humedad + proteína + lípidos + carb. totales + cenizas − 100| > 1,5 (sólo si los cinco existen).
- `KJ_MISMATCH`: |kJ − kcal × 4,184| > max(4, 1 %).
- `ENERGY_MISMATCH`: kcal vs 4·P + 4·C + 9·G (+ 2·fibra si hay carb. disponibles; si no, carb. totales) fuera de ±10 % y ±8 kcal. Alcoholes (nombre con "alcohol") exentos: el etanol aporta 7 kcal/g no declarados.
- `INVALID_CELL`, `UNASSIGNED_CELL`, `MISSING_CORE` (sin kcal, proteína, lípidos o carb. totales).
- `DUPLICATE_CODE`, `CODE_GAP_SUSPECT` (código fuera de orden respecto a vecinos), `UNPAIRED` (izquierda sin derecha o viceversa).
- `OUT_OF_RANGE`: sodio > 40 000 mg, grasa saturada > lípidos, parte comestible fuera de 1–100.

- [ ] **Step 1:** Pruebas con filas reales de la p. 81 (H003 válida; H010 con 52 kcal → `ENERGY_MISMATCH` y `KJ_MISMATCH`; duplicado H005; cerveza exenta).
- [ ] **Step 2:** Implementar hasta verde. Commit.

### Task 4: Construcción del CSV, correcciones y reporte

**Files:**
- Create: `scripts/catalog/build-tcac.ts`, `src/core/catalog/corrections.ts`
- Test: `tests/unit/catalog/corrections.test.ts`
- Output versionado: `data/catalog/tcac-2018.csv`, `data/catalog/tcac-2018-corrections.csv`, `data/catalog/tcac-2018-report.md`

- [ ] **Step 1:** `applyCorrections(rows, corrections)` con correcciones `code,field,value,note` (value vacío = celda vacía real); una corrección para un código o campo inexistente es error. Pruebas.
- [ ] **Step 2:** Script (`pnpm tsx scripts/catalog/build-tcac.ts`): lee OCR, analiza, une izquierda/derecha por código, aplica correcciones, valida, escribe CSV (código, nombre, grupo TCAC por letra, parte analizada, nutrientes, `needsReview`) y reporte (totales, issues por tipo, lista de filas abiertas).
- [ ] **Step 3: Revisión de filas marcadas.** Para cada fila con issues, renderizar el recorte de esa fila a escala 4, leerlo y escribir la corrección con nota. Repetir hasta que las filas abiertas sean sólo las ilegibles de verdad. Objetivo: ≥ 95 % de filas sin issues; el resto con `needsReview`.
- [ ] **Step 4: Muestreo de columnas sin suma de control.** 30 filas al azar (semilla fija, anotada en el reporte): comparar sodio, grasa saturada y parte comestible contra la imagen. Si hay > 1 error, revisar la calibración y repetir.
- [ ] **Step 5:** Commit de script, CSVs y reporte. Mostrar al usuario el resumen del reporte.

### Task 5: Intercambios GABA

**Files:**
- Create: `scripts/catalog/build-gaba.ts`, `src/core/catalog/gaba.ts`, `src/core/catalog/gaba-parse.ts`
- Test: `tests/unit/catalog/gaba-parse.test.ts`, `tests/unit/catalog/gaba.test.ts`
- Output versionado: `data/catalog/gaba-exchanges.csv`

- [ ] **Step 1:** `parseExchangeTable(lines)`: líneas `Alimento <peso> <medida>`, incluidas medidas partidas en dos líneas (caso "Arroz integral, cocido 81" con la medida en la línea anterior); grupo y subgrupo desde el encabezado; ignora encabezados repetidos y números de página. Pruebas con el texto real de la tabla 26 (arroz blanco cocido = 80 g, "6 cucharadas soperas colmadas"; arroz integral cocido = 81 g).
- [ ] **Step 2:** `gaba.ts` con constantes tipadas transcritas del documento y citadas: `EXCHANGE_AVERAGES` (tabla 46, por subgrupo: kcal, proteína, grasa, carbohidratos) y `DAILY_EXCHANGES` (tabla 56: 2–5, 6–9, 10–13, 14–17 por sexo, 18–59 por sexo, > 60). Prueba de que la tabla 56 está completa (8 columnas × 6 grupos) y del valor 18–59 hombres cereales = 8,0.
- [ ] **Step 3:** Script → `gaba-exchanges.csv`. Commit.

### Task 6: Enriquecimiento (grupo GABA, porción, alérgenos, ALTO EN)

**Files:**
- Create: `src/core/catalog/enrich.ts`, `data/catalog/gaba-matches.csv` (coincidencias TCAC ↔ lista de intercambio confirmadas), `data/catalog/allergen-review.csv` (salida para el nutricionista)
- Test: `tests/unit/catalog/enrich.test.ts`

**Interfaces:**
- `gabaGroupFor(tcacGroupLetter, name, overrides)`: mapeo de los 16 grupos TCAC (A cereales → `CEREALS_TUBERS`; B verduras → `VEGETABLES`; C frutas → `FRUITS`; D grasas → `FATS`; E pescados, F carnes, J huevos, T leguminosas → `PROTEINS`; G leche → `DAIRY`; K azucarados → `SUGARS`; H bebidas, L misceláneos, N regímenes especiales, P nativos, R manufacturados, S preparados → sin grupo salvo excepción por alimento). Raíces, tubérculos y plátanos de B/P → `CEREALS_TUBERS` por excepción.
- `exchangeFor(food, matches, averages)`: gramos y medida de la lista confirmada; si no hay coincidencia, gramos = kcal del intercambio del subgrupo ÷ kcal por gramo del alimento, sin medida casera, marcado `exchangeEstimated`.
- `allergensFor(food)`: reglas por grupo (G → `MILK`, J → `EGG`, E pescados → `FISH`, mariscos por nombre → `SHELLFISH`) y por palabras (trigo, cebada, centeno, avena → `GLUTEN`; maní → `PEANUT`; soya → `SOY`; nueces/almendra/marañón → `TREE_NUTS`; ajonjolí → `SESAME`). Todo alimento con alérgeno o con grupo S/R → `needsReview` hasta revisión.
- `highInFor(food)`: sólo si `isProcessed` (grupos K, R, S y nombres con "con azúcar", "con sal", "frito"; editable por excepción). Sodio ≥ 300 mg/100 g o ≥ 1 mg/kcal → `SODIUM`; grasa saturada × 9 ≥ 10 % de kcal → `SATURATED_FAT`. `SUGAR` no se calcula en la fase A (la TCAC no separa azúcares libres; se documenta).

- [ ] **Step 1:** Pruebas: harina de trigo → `GLUTEN`; leche → `MILK` y `DAIRY`; plátano → `CEREALS_TUBERS`; néctar con azúcar procesado; fruta natural nunca ALTO EN; arroz blanco cocido toma 80 g de la lista.
- [ ] **Step 2:** Implementar. Coincidencias de nombre: proponer automáticamente (normalizado sin tildes, palabras clave) y escribir `gaba-matches.csv` con columna `confirmed`; revisar a mano las propuestas y confirmar. Sólo las confirmadas se usan.
- [ ] **Step 3:** Commit.

### Task 7: Esquema aditivo

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1:** Enums `FoodSource (TCAC_2018, USDA_SR, MANUAL)`, `GabaGroup (CEREALS_TUBERS, FRUITS, VEGETABLES, DAIRY, PROTEINS, FATS, SUGARS)`, `Allergen (GLUTEN, MILK, EGG, PEANUT, TREE_NUTS, FISH, SHELLFISH, SOY, SESAME)`, `HighIn (SUGAR, SODIUM, SATURATED_FAT)`.
- [ ] **Step 2:** `Food` agrega (todos opcionales o con default, para no tocar filas existentes): `code String? @unique`, `catalogSource FoodSource @default(MANUAL)`, `sourceRef String?`, `gabaGroup GabaGroup?`, `isProcessed Boolean @default(false)`, `allergens Allergen[]`, `highIn HighIn[]`, `exchangeGrams Float?`, `exchangeMeasure String?`, `exchangeEstimated Boolean @default(false)`, `edibleFraction Float?`, `searchName String @default("")`, `needsReview Boolean @default(false)`; índices en `searchName` y `gabaGroup`. `FoodNutrient` agrega `source FoodSource @default(MANUAL)`. Se conserva `source String` existente (no se renombra).
- [ ] **Step 3:** `unset DATABASE_URL DIRECT_URL && pnpm prisma db push` en la base pública (aditivo; avisar al usuario antes) y en el esquema `test` como hacen las pruebas de integración. Verificar RLS de tablas (no hay tablas nuevas en esta fase). `pnpm prisma generate`.
- [ ] **Step 4:** Commit.

### Task 8: Carga idempotente

**Files:**
- Create: `scripts/catalog/load-catalog.ts`, `src/features/catalog/load.ts` (funciones de escritura, sin `"use server"`)
- Test: `tests/integration/catalog-load.test.ts`

- [ ] **Step 1:** Prueba de integración: cargar 3 filas de ejemplo dos veces → 3 alimentos (upsert por `code`), nutrientes con `source = TCAC_2018`, porción "1 intercambio" (`isDefault`) más la medida casera; los alimentos `MANUAL` existentes no cambian; un alimento ya usado en un `MealItem` nunca se borra.
- [ ] **Step 2:** Implementar: crea nutrientes faltantes (Humedad, Cenizas, Carbohidratos disponibles, Sodio, Grasas saturadas ya existe), categorías por grupo TCAC (`slug` = `tcac-a`, …), `searchName` normalizado. "Carbohidratos" = carbohidratos totales. Marca los 20 actuales con `catalogSource = MANUAL` y su `searchName`.
- [ ] **Step 3:** Ejecutar en la base pública (es de pruebas; el usuario lo autorizó) y comprobar conteos con una consulta de solo lectura. Commit.

### Task 9: Proteger el generador actual

**Files:**
- Modify: `src/features/nutrition/actions.ts` (`loadFoodsForGenerator`)
- Test: `tests/integration/generator-manual-only.test.ts`

- [ ] **Step 1:** Prueba que falla: con un alimento `TCAC_2018` en la base, `loadFoodsForGenerator` no lo incluye. (Exportar la función desde un módulo de features sin `"use server"` para poder probarla.)
- [ ] **Step 2:** Filtro `where: { catalogSource: "MANUAL" }`. Verde. Commit.

### Task 10: Buscador en el editor de planes

**Files:**
- Create: `src/features/catalog/search.ts` (lectura), `src/features/catalog/components/food-search.tsx` (cliente)
- Modify: `src/features/nutrition/actions.ts` (`searchFoodsAction`), `src/features/nutrition/components/meal-plan-editor.tsx`, `src/app/(dashboard)/dashboard/meal-plans/[id]/page.tsx`, `tests/unit/guardian/actions-require-actor.test.ts` sólo si cambia la lista permitida
- Test: `tests/integration/catalog-search.test.ts`, `tests/unit/catalog/search-name.test.ts`

- [ ] **Step 1:** `normalizeSearch(text)` (minúsculas, sin tildes, espacios colapsados) con pruebas ("Fríjol" encuentra "frijol").
- [ ] **Step 2:** `searchFoods({ query, gabaGroup?, highIn?, limit = 20 })`: `searchName contains`, filtros, orden: coincidencia al inicio primero, luego alfabético; `select` explícito (id, nombre, grupo, porción por defecto, kcal/proteína/carb./grasa por 100 g). `searchFoodsAction` exige actor `PROFESSIONAL`. Integración: filtro por grupo, búsqueda sin tildes, límite.
- [ ] **Step 3:** `FoodSearch`: campo con búsqueda diferida (300 ms), chips de grupo GABA (≥ 44 px), resultados con kcal y macros por porción equivalente; al elegir, fija gramos = porción por defecto. Reemplaza el `<select>` del editor; la página deja de cargar `getFoods()` completo.
- [ ] **Step 4:** Verificación visual a 390×844 con captura (servidor del usuario en :3000). `pnpm lint` en los archivos tocados. Commit.

### Task 11: Revisión de alérgenos y verificación final

- [ ] **Step 1:** Generar `data/catalog/allergen-review.csv` (alimento, alérgenos propuestos, motivo) para que el usuario lo pase a un nutricionista. Documentarlo en el reporte.
- [ ] **Step 2:** Suite completa una sola vez: `pnpm test:unit`, `pnpm test:int`, `pnpm build` y E2E (pedir permiso para detener el servidor de :3000).
- [ ] **Step 3:** Revisión de código del conjunto. Actualizar el registro en `.superpowers/sdd/progress.md`.
- [ ] **Step 4:** Pedir autorización para publicar (push a `main` y despliegue a Vercel).

## Fuera de esta fase

USDA (cuando una fase lo necesite), vitaminas y demás minerales, `SUGAR` de ALTO EN, restricciones/mercado (fase B), generador nuevo (fase C), lista de compras (fase D).

## Riesgos

- Precisión del OCR: mitigada con 5 comprobaciones por fila, revisión de filas marcadas y muestreo; lo no resuelto queda `needsReview` y visible.
- Alérgenos por reglas: no aptos para uso clínico sin revisión humana.
- Coincidencias TCAC ↔ intercambio: sólo las confirmadas; el resto con gramos estimados y marcados.
- Licencia TCAC: consulta escrita al ICBF antes del lanzamiento comercial.
