"use server";

import { revalidatePath } from "next/cache";
import { revokeConsent } from "@/features/consent/revoke-consent";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { auth } from "@/infrastructure/auth/auth";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { getMyProfessionals } from "./my-professionals";
import { buildPortalAppointments, buildPortalHome, buildPortalWeek } from "./portal-view";

export async function getMyProfessionalsAction() {
  const actor = await requireActorFor("PATIENT");
  return getMyProfessionals(actor.userId);
}

export async function getPortalHomeAction(requested: string | null = null) {
  const actor = await requireActorFor("PATIENT");
  const session = await auth();
  const firstName = (session?.user?.name ?? "").trim().split(/\s+/)[0] ?? "";
  return buildPortalHome(actor, requested, new Date(), firstName);
}

export async function getPortalPlanAction(requested: string | null = null, weekOffset = 0) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalWeek(actor, requested, new Date(), weekOffset);
}

export async function getPortalAppointmentsAction(requested: string | null = null) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalAppointments(actor, requested, new Date());
}

export async function revokeConsentAction(patientId: string): Promise<{ error?: string }> {
  const actor = await getActorFor("PATIENT");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await revokeConsent({ actor, patientId, now: new Date(), ip });
  revalidatePath("/portal");
  revalidatePath("/portal/cuenta");
  return result.ok ? {} : { error: result.error };
}
