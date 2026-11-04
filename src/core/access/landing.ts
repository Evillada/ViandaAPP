import { canAccessArea } from "./policies";
import type { Actor, Area } from "./types";

export const AREA_PATHS: Record<Area, string> = {
  PROFESSIONAL: "/dashboard",
  PATIENT: "/portal",
  ADMIN: "/admin",
};

const AREA_PRIORITY: readonly Area[] = ["PROFESSIONAL", "PATIENT", "ADMIN"];

export function availableAreas(actor: Pick<Actor, "roles" | "professionalStatus">): Area[] {
  return AREA_PRIORITY.filter((area) => canAccessArea(actor, area));
}

export function resolveLandingPath(input: Pick<Actor, "roles" | "professionalStatus"> & { lastArea: Area | null }): string {
  const areas = availableAreas(input);
  if (input.lastArea && areas.includes(input.lastArea)) return AREA_PATHS[input.lastArea];
  const first = areas[0];
  return first ? AREA_PATHS[first] : "/pending";
}
