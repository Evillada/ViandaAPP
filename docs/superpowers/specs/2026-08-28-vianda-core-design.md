# Vianda Core — Diseño (sin organizaciones)

**Fecha:** 2026-08-28  
**Estado:** Implementado

## Objetivo

Evolucionar emuj-health hacia **Vianda**: plataforma de gestión nutricional clínica con vertical slice completo, sin multi-tenant/organizaciones.

## Principio rector

> El sistema propone, calcula, organiza y documenta. El profesional valida, modifica, aprueba y decide.

## Alcance implementado

| Módulo | Funcionalidad |
|--------|---------------|
| Rebrand | Vianda en toda la UI |
| Pacientes | CRUD extendido (documento, sexo, fecha nacimiento) |
| Valoraciones | Motivo, antropometría, actividad física |
| Motor nutricional | IMC, TMB (Mifflin-St Jeor), macros 25/50/25 |
| Catálogo | 20 alimentos ICBF + 8 nutrientes + categorías |
| Plan alimentario | 3 comidas/día, items, totales vs metas |
| Citas | Mantenido como módulo secundario |
| Auth | Sin cambios (NextAuth) |

## Excluido

- Organizaciones / multi-tenant
- Procesos clínicos (Fase 2)
- PDF reportes
- Portal paciente
- MFA / Supabase

## Arquitectura

- Next.js monolito, hexagonal ligera
- `core/nutrition/` — dominio puro (calculadoras)
- `features/` — server actions + UI
- SQLite local (`prisma/dev.db`)

## Flujo principal

```
Login → Paciente → Valoración → Cálculo automático → Plan alimentario → Comparar vs metas → Aprobar
```
