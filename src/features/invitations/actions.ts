"use server";

import { revalidatePath } from "next/cache";
import { canManageInvitations } from "@/core/access/policies";
import { getActorFor } from "@/infrastructure/access/access-context";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta, getRequestOrigin } from "@/infrastructure/http/request-meta";
import { createInvitation } from "./create-invitation";
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
