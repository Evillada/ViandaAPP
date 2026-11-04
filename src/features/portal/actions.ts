"use server";

import { revalidatePath } from "next/cache";
import { revokeConsent } from "@/features/consent/revoke-consent";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { getMyProfessionals } from "./my-professionals";

export async function getMyProfessionalsAction() {
  const actor = await requireActorFor("PATIENT");
  return getMyProfessionals(actor.userId);
}

export async function revokeConsentAction(patientId: string): Promise<{ error?: string }> {
  const actor = await getActorFor("PATIENT");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await revokeConsent({ actor, patientId, now: new Date(), ip });
  revalidatePath("/portal");
  return result.ok ? {} : { error: result.error };
}
