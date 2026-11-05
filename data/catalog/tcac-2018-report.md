# TCAC 2018 — reporte de extracción

Generado por `scripts/catalog/build-tcac.ts`. Fuente: TCAC 2018 (ICBF, Universidad Nacional), páginas 43–108, OCR de Vision (macOS) con dos lecturas por página y relectura de celdas.

- Filas: 773 (códigos únicos: 773)
- Sin problemas que bloqueen: 773 (100.0 %)
- Por revisar (`needs_review`): 0
- Correcciones manuales aplicadas: 336
- Nombres o partes con errores de OCR o tildes corregidos (`src/core/catalog/names.ts`): 93

## Problemas por tipo

| Tipo | Filas |
|---|---|
| ENERGY_MISMATCH (aviso) | 29 |
| PROXIMATE_SUM (aviso) | 8 |

## Ajustes automáticos

| Tipo | Celdas o filas |
|---|---|
| CORRECTED | 328 |
| CELL_READ | 186 |
| CHECKSUM | 89 |
| CODE_RESOLVED | 30 |
| CODE_REPAIRED | 2 |
| ACCEPTED | 8 |

## Calidad medida

Las sumas sólo detectan errores que las descuadran. Para medir lo que se les escapa:

- **Muestra de control** (semilla 20261105, 30 filas, revisada a mano contra la imagen el 2026-11-05): 5 celdas erradas de ~360. Tres eran sodio o grasa saturada vacíos con una cifra aislada que el OCR no detecta ("2", "0"); dos eran 6 leídos como 5 dentro de tolerancia (70,6 → 70,5 g; 1064 → 1054 kJ). Las cinco quedaron corregidas y los dos patrones se atacaron en todo el catálogo.
- **Celdas vacías**: cada celda vacía se relee sola y se mide si tiene tinta. Una celda con tinta que no se pudo leer bloquea la fila hasta revisarla. Por eso un vacío en el CSV es un vacío de la fuente (nutriente no analizado) o una columna que ese grupo no publica (p. ej. grasa saturada en verduras y frutas).
- **Tercer lector** (cada celda recortada y releída sola): 5346 celdas comparables, 5019 coinciden (93.9 %). Las diferencias de un solo dígito se revisaron en la imagen ampliada: 39 eran errores de los dos lectores principales (casi todos 6 → 5) y se corrigieron. El resto son fallas del tercer lector (pierde la coma o una cifra). 2877 celdas no tuvieron lectura comparable.
- **Error residual estimado** (supuesto, no medido): entre las celdas comparables, el tercer lector destapó 39 errores en 5346 (≈0,7 %). Si las 2877 celdas sin lectura comparable tienen la misma tasa, quedan del orden de 21 celdas con un dígito confundido (5/6, 6/8) que no descuadra ninguna suma. Se concentran en la p. 107, cuya imagen es de baja resolución. Impacto típico: ±0,1 g o ±10 kJ.

| Campo | Celdas vacías |
|---|---|
| moisture | 0 |
| energyKcal | 0 |
| energyKj | 0 |
| protein | 0 |
| fat | 0 |
| carbsTotal | 0 |
| carbsAvailable | 332 |
| fiber | 91 |
| ash | 0 |
| sodium | 139 |
| saturatedFat | 469 |
| edibleFraction | 22 |

Los avisos no bloquean: `ENERGY_MISMATCH` refleja que la TCAC calcula energía con factores distintos a 4/9/4 en algunos alimentos, y `PROXIMATE_SUM` aceptado marca filas cuya composición impresa suma más de 100 g con energía coherente (anotadas en el archivo de correcciones).

## Filas por revisar

| Ref | Código | Alimento | Problemas |
|---|---|---|---|
