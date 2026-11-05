import { canEditPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import { endOfDayBogota } from "@/core/portal/bogota-dates";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

const MAX_MESSAGE = 280;

export async function updatePortalSettings(
  actor: Actor,
  patientId: string,
  input: { message: string; until: string; progressEnabled: boolean },
  ip: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { professionalId: true, userId: true } });
  if (!patient || !canEditPatientRecord(actor, { ...patient, consentActive: false })) return { ok: false, error: "Paciente no encontrado" };

  const message = input.message.trim();
  if (message.length > MAX_MESSAGE) return { ok: false, error: `El mensaje admite máximo ${MAX_MESSAGE} caracteres` };
  let until: Date | null = null;
  if (message && input.until.trim()) {
    until = endOfDayBogota(input.until.trim());
    if (!until) return { ok: false, error: "Fecha de vigencia inválida" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: { portalMessage: message || null, portalMessageUntil: message ? until : null, progressMessagesEnabled: input.progressEnabled },
    });
    await recordAudit(
      { actorId: actor.userId, actorRole: "PROFESSIONAL", action: "PATIENT_UPDATED", entityType: "Patient", entityId: patientId, patientId, metadata: { change: "portal_settings" }, ip },
      tx
    );
  });
  return { ok: true };
}
