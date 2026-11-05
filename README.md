# Vianda

Plataforma de gestión nutricional clínica para profesionales.

> El sistema propone, calcula y documenta. El profesional valida y decide.

## Stack

- **Next.js 16** (App Router)
- **TypeScript** + **Tailwind CSS v4**
- **Prisma** (PostgreSQL en Supabase)
- **NextAuth.js v5**

## Funcionalidades

- Pacientes con ficha clínica básica
- Valoraciones con antropometría
- Cálculo automático: IMC, TMB, macros
- Catálogo de alimentos ICBF (~20 alimentos)
- Planes alimentarios con comparación vs metas
- Citas (módulo secundario)

## Setup

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

## Usuarios demo

El seed crea estos usuarios con las contraseñas definidas en `.env` (nunca en el código):

| Rol | Email | Contraseña |
|-----|-------|------------|
| Nutricionista + admin | `dev@gmail.com` | `SEED_DEV_PASSWORD` |
| Paciente | `paciente@emuj.health` | `SEED_PATIENT_PASSWORD` |

## Flujo

1. Login → Dashboard
2. Pacientes → crear o abrir María García (demo)
3. Nueva valoración → ingresar peso/talla → ver TMB y macros
4. Crear plan alimentario → agregar alimentos → comparar totales

Spec: `docs/superpowers/specs/2026-08-28-vianda-core-design.md`
