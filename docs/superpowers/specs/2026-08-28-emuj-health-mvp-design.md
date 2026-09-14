# Emuj Health MVP — Diseño

**Fecha:** 2026-08-28  
**Estado:** Aprobado e implementado

## Objetivo

MVP para profesionales de salud que gestionan pacientes y citas desde un dashboard web.

## Usuario principal

Profesional de salud (médico, clínica) — rol `PROFESSIONAL` por defecto al registrarse.

## Alcance MVP

| Módulo | Funcionalidad |
|--------|---------------|
| Landing | Página pública con CTA a registro/login |
| Auth | Registro, login con credenciales (bcrypt), sesión JWT |
| Dashboard | Métricas reales: pacientes, consultas hoy, próximas citas |
| Pacientes | CRUD básico (crear, listar, eliminar) |
| Citas | Agendar, listar, completar, cancelar |

## Paleta de diseño (Wellness)

| Token | Color | Uso |
|-------|-------|-----|
| Primary | `#2A9D8F` | Botones, acentos, links |
| Secondary | `#457B9D` | Elementos secundarios |
| Accent | `#F4A261` | Destacados cálidos |
| Background | `#F7FAFA` | Fondo general |
| Text | `#264653` | Texto principal |
| Surface | `#FFFFFF` | Tarjetas, formularios |

## Modelo de datos

```
User (PROFESSIONAL)
  ├── Patient (firstName, lastName, email?, phone?, dateOfBirth?, notes?)
  └── Appointment (date, duration, reason?, status: SCHEDULED|COMPLETED|CANCELLED)
        └── belongs to Patient
```

## Rutas

- `/` — Landing (pública)
- `/login`, `/register` — Auth (pública)
- `/dashboard` — Panel principal (protegida)
- `/dashboard/patients` — Gestión de pacientes (protegida)
- `/dashboard/appointments` — Gestión de citas (protegida)

## Stack

Next.js 16, TypeScript, Tailwind v4, Prisma/PostgreSQL, NextAuth v5, Zod v4.

## Fuera de alcance (post-MVP)

- Historial clínico detallado
- Notificaciones / recordatorios
- Roles ADMIN
- Portal de pacientes
- Integraciones externas
