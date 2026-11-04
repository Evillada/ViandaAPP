"use server";

import { redirect } from "next/navigation";
import { AREA_PATHS } from "@/core/access/landing";
import type { Area } from "@/core/access/types";
import { getActorFor } from "@/infrastructure/access/access-context";
import { signOut } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";

function isArea(value: FormDataEntryValue | null): value is Area {
  return value === "PROFESSIONAL" || value === "PATIENT" || value === "ADMIN";
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function switchAreaAction(formData: FormData): Promise<void> {
  const area = formData.get("area");
  if (!isArea(area)) redirect("/start");
  const actor = await getActorFor(area);
  if (!actor) redirect("/start");
  await prisma.user.update({ where: { id: actor.userId }, data: { lastArea: area } });
  redirect(AREA_PATHS[area]);
}
