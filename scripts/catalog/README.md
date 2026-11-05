# Catálogo de alimentos — scripts

Fuentes en `data/sources/` (ignorado por git): `tcac_web.pdf` (TCAC 2018, ICBF) y `gaba_tecnico_2015.txt` (documento técnico GABA, FAO/ICBF). Lo derivado y versionado vive en `data/catalog/`.

## 1. OCR de la TCAC (sólo macOS)

El PDF de la TCAC no tiene capa de texto. El OCR usa Vision de macOS y sólo vuelca cajas de texto; la interpretación y la validación están en `src/core/catalog/`.

```bash
python3 -m venv data/sources/.venv
data/sources/.venv/bin/pip install ocrmac pypdfium2
data/sources/.venv/bin/python scripts/catalog/ocr_tcac.py          # páginas 43–108
data/sources/.venv/bin/python scripts/catalog/ocr_tcac.py 46 82    # páginas sueltas
```

Salida: `data/sources/ocr/page-NNN.json`. No hace parte del build ni de las pruebas.

## 2. Construcción del catálogo

```bash
pnpm tsx scripts/catalog/build-tcac.ts     # → data/catalog/tcac-2018.csv y tcac-2018-report.md
pnpm tsx scripts/catalog/build-gaba.ts     # → data/catalog/gaba-exchanges.csv
pnpm tsx scripts/catalog/build-enrich.ts   # → data/catalog/gaba-matches.csv y allergen-review.csv
```

`gaba-matches.csv` propone, para cada alimento de la lista de intercambios GABA, alimentos TCAC del mismo estado (crudo/cocido). Sólo las filas con `confirmed = 1` se usan (`0` = rechazada a propósito); se confirman a mano y se conservan al regenerar. Para agregar una coincidencia que el script no propone, añadir la fila con `confirmed = 1`.

`allergen-review.csv` lista los alimentos con alérgenos propuestos, los procesados y los de grupos con ingredientes ocultos (H, K, L, N, R, S) para que la nutricionista llene `confirmed_allergens`.

Sin coincidencia confirmada, la porción de intercambio se estima con la menor entre la que iguala el macronutriente que define el subgrupo (proteína en carnes y huevos, carbohidratos en cereales, tubérculos y frutas, grasa en grasas) y la que iguala la energía. Queda marcada como estimada.

## 3. Carga en la base

```bash
pnpm tsx scripts/catalog/load-catalog.ts
```

Idempotente: actualiza por `code`, reemplaza nutrientes y porciones de los alimentos TCAC y nunca borra alimentos. Los ítems de planes guardan `foodId` y gramos, no los nutrientes: si una recarga corrige un valor, los planes existentes que usan ese alimento muestran el valor nuevo.
