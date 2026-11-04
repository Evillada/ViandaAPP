"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageInvitations } from "@/core/access/policies";
import { getActorFor, getSessionActor } from "@/infrastructure/access/access-context";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta, getRequestOrigin } from "@/infrastructure/http/request-meta";
import { acceptInvitation } from "./accept-invitation";
import { createInvitation } from "./create-invitation";
import { createInviteAccount } from "./invite-account";
import { getInvitationStatus, type InvitationStatus } from "./invitation-status";

export async function createInvitationAction(patientId: string): Promise<{ url: string; expiresAt: Date } | { error: string }> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await createInvitation({ actor, patientId, now: new Date(), ip });
  if (!result.ok) return { error: result.error };
  const origin = await getRequestOrigin();
  revalidatePath(`/dashboard/patients/${patientId}`);
  return { url: `${origin}/invite/${result.token}`, expiresAt: result.expiresAt };
}

export async function getInvitationStatusAction(patientId: string): Promise<InvitationStatus | null> {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return null;
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { professionalId: true, userId: true },
  });
  if (!patient || !canManageInvitations(actor, { ...patient, consentActive: false })) return null;
  return getInvitationStatus(patientId, new Date());
}

// Runs WITHOUT an actor (anonymous sign-up): the DB access lives in invite-account.ts (not a "use server" module),
// so the actor guardian keeps checking this file's prisma-touching exports.
export async function createInviteAccountAction(token: string, formData: FormData): Promise<{ email?: string; error?: string }> {
  const result = await createInviteAccount(
    { name: formData.get("name"), email: formData.get("email"), password: formData.get("password") },
    token,
    new Date()
  );
  return result.ok ? { email: result.email } : { error: result.error };
}

// Uses the session (not an area): the account may not hold the PATIENT role until it accepts.
export async function acceptInvitationAction(token: string, formData: FormData): Promise<{ error?: string }> {
  const actor = await getSessionActor();
  if (!actor) return { error: "Inicia sesión para continuar" };
  const { ip, userAgent } = await getRequestMeta();
  const result = await acceptInvitation({
    token,
    userId: actor.userId,
    consentChecked: formData.get("consent") === "on",
    documentVersion: String(formData.get("documentVersion") ?? ""),
    now: new Date(),
    ip,
    userAgent,
  });
  if (!result.ok) return { error: result.error };
  redirect("/portal");
}
