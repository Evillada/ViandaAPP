# Antropometría OMS + Historial — Diseño

**Fecha:** 2026-08-28  
**Estado:** Implementado

## Objetivo

Ampliar valoraciones con antropometría completa OMS, composición corporal calculada e historial visual por paciente.

## Alcance

| Módulo | Funcionalidad |
|--------|---------------|
| Valoración | Tipo consulta, fecha, snapshot clínico (alergias, condiciones, medicamentos) |
| Perímetros | Cintura, cadera, brazo relajado/contraído, muslo, pantorrilla, cuello |
| Pliegues | 8 sitios ISAK/OMS (todos opcionales) |
| Cálculos | IMC+OMS, ICC, % grasa (Durnin-Womersley / Jackson-Pollock 3), masa grasa/magra, área muscular brazo |
| Historial | Pestaña Evolución: gráficos peso/IMC/%grasa/cintura + tabla con deltas |
| Inmutabilidad | Valoraciones no editables; nueva consulta = nueva valoración |

## Arquitectura

```
core/anthropometry/
  bmi-classifier.ts
  perimeters.ts
  body-composition.ts
  evolution.ts

features/assessments/
  actions.ts
  components/
    assessment-form.tsx
    form-section.tsx
    evolution-charts.tsx
    evolution-table.tsx
    patient-tabs.tsx
```

## Fuera de alcance

- Bioimpedancia, laboratorios, PDF evolución, gráficos por pliegue individual
