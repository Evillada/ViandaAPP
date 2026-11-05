import { availableAreas } from "@/core/access/landing";
import type { Actor, Area } from "@/core/access/types";

export type NavIconName = "home" | "users" | "calendar" | "calculator" | "shield" | "heart" | "utensils" | "progress";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  exact?: boolean;
}

export const AREA_LABELS: Record<Area, string> = {
  PROFESSIONAL: "Consulta",
  PATIENT: "Mi salud",
  ADMIN: "Administración",
};

export const PROFESSIONAL_NAV: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "home", exact: true },
  { href: "/dashboard/patients", label: "Pacientes", icon: "users" },
  { href: "/dashboard/appointments", label: "Citas", icon: "calendar" },
  { href: "/dashboard/tools", label: "Herramientas", icon: "calculator" },
];

export const PATIENT_NAV: NavItem[] = [
  { href: "/portal", label: "Hoy", icon: "home", exact: true },
  { href: "/portal/plan", label: "Plan", icon: "utensils" },
  { href: "/portal/citas", label: "Citas", icon: "calendar" },
  { href: "/portal/progreso", label: "Progreso", icon: "progress" },
];

export const ADMIN_NAV: NavItem[] = [{ href: "/admin/professionals", label: "Profesionales", icon: "shield" }];

export function areaLinks(actor: Actor, current: Area): { area: Area; label: string; active: boolean }[] {
  return availableAreas(actor).map((area) => ({ area, label: AREA_LABELS[area], active: area === current }));
}
