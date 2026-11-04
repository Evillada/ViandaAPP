import { cache } from "react";
import { canAccessArea } from "@/core/access/policies";
import type { Actor, Area } from "@/core/access/types";
import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";

export class AccessDeniedError extends Error {
  constructor() {
    super("No autorizado");
    this.name = "AccessDeniedError";
  }
}

export async function loadActor(userId: string, activeArea: Area | null): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: true, professionalProfile: { select: { status: true } } },
  });
  if (!user) return null;
  return {
    userId: user.id,
    roles: user.roles,
    activeArea,
    professionalStatus: user.professionalProfile?.status ?? null,
  };
}

const loadSessionActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? loadActor(userId, null) : null;
});

export async function getSessionActor(): Promise<Actor | null> {
  return loadSessionActor();
}

export async function getActorFor(area: Area): Promise<Actor | null> {
  const base = await loadSessionActor();
  if (!base) return null;
  const actor: Actor = { ...base, activeArea: area };
  return canAccessArea(actor, area) ? actor : null;
}

export async function requireActorFor(area: Area): Promise<Actor> {
  const actor = await getActorFor(area);
  if (!actor) throw new AccessDeniedError();
  return actor;
}
