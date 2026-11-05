"use server";

import { revalidatePath } from "next/cache";
import { revokeConsent } from "@/features/consent/revoke-consent";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { getRequestMeta } from "@/infrastructure/http/request-meta";
import { changePassword, deleteAccount, getAccountOverview, updatePatientPhone } from "./account";
import { getMyProfessionals } from "./my-professionals";
import { buildPortalAppointments, buildPortalAssessment, buildPortalHome, buildPortalProgress, buildPortalWeek } from "./portal-view";

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

export async function getPortalProgressAction(requested: string | null = null) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalProgress(actor, requested);
}

export async function getPortalAssessmentAction(assessmentId: string) {
  const actor = await requireActorFor("PATIENT");
  return buildPortalAssessment(actor, assessmentId);
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

export async function getAccountOverviewAction() {
  const actor = await requireActorFor("PATIENT");
  return getAccountOverview(actor.userId, new Date());
}

export async function updatePhoneAction(formData: FormData): Promise<{ error?: string }> {
  const actor = await getActorFor("PATIENT");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await updatePatientPhone(actor, String(formData.get("phone") ?? ""), ip);
  revalidatePath("/portal/cuenta");
  return result.ok ? {} : { error: result.error };
}

export async function changePasswordAction(formData: FormData): Promise<{ error?: string }> {
  const actor = await getActorFor("PATIENT");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await changePassword(
    actor,
    String(formData.get("currentPassword") ?? ""),
    String(formData.get("newPassword") ?? ""),
    ip
  );
  return result.ok ? {} : { error: result.error };
}

export async function deleteAccountAction(formData: FormData): Promise<{ error?: string }> {
  const actor = await getActorFor("PATIENT");
  if (!actor) return { error: "No autorizado" };
  const { ip } = await getRequestMeta();
  const result = await deleteAccount(actor, String(formData.get("confirmation") ?? ""), ip, new Date());
  if (!result.ok) return { error: result.error };
  // signOut throws a Next redirect internally: keep it last, outside any try/catch.
  await signOut({ redirectTo: "/login?deleted=1" });
  return {};
}
