"use server";

import { revalidatePath } from "next/cache";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { listProfessionalsForReview, reviewProfessional } from "./review-professionals";

export async function getProfessionalsForReviewAction() {
  const actor = await requireActorFor("ADMIN");
  return listProfessionalsForReview(actor.userId);
}

async function decide(formData: FormData, decision: "APPROVE" | "REJECT" | "SUSPEND"): Promise<{ error?: string }> {
  const actor = await getActorFor("ADMIN");
  if (!actor) return { error: "No autorizado" };
  const profileId = String(formData.get("profileId") ?? "");
  const reason = formData.get("reason");
  const { ip } = await getRequestMeta();
  const result = await reviewProfessional({
    actor,
    profileId,
    decision,
    reason: typeof reason === "string" ? reason : undefined,
    ip,
  });
  revalidatePath("/admin/professionals");
  return result.ok ? {} : { error: result.error };
}

export async function approveProfessionalAction(formData: FormData) {
  return decide(formData, "APPROVE");
}

export async function rejectProfessionalAction(formData: FormData) {
  return decide(formData, "REJECT");
}

export async function suspendProfessionalAction(formData: FormData) {
  return decide(formData, "SUSPEND");
}