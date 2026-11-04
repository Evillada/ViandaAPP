"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canViewPatientRecord } from "@/core/access/policies";
import type { Actor } from "@/core/access/types";
import type { AuditAction } from "@/core/audit/audit";
import { rankPatients } from "@/core/patients/patient-search";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta } from "@/infrastructure/http/request-meta";

const patientSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  lastName: z.string().min(1, "Apellido requerido"),
  documentId: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

function parsePatientForm(formData: FormData) {
  return patientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    documentId: formData.get("documentId") || undefined,
    sex: formData.get("sex") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

async function auditPatient(actor: Actor, action: AuditAction, patientId: string, metadata?: Record<string, unknown>) {
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId: actor.userId,
    actorRole: "PROFESSIONAL",
    action,
    entityType: "Patient",
    entityId: patientId,
    patientId,
    metadata,
    ip,
  });
}

function revalidatePatients(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/patients");
  if (id) revalidatePath(`/dashboard/patients/${id}`);
}

export async function getPatients(includeInactive = false) {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.patient.findMany({
    where: {
      professionalId: actor.userId,
      ...(!includeInactive && { status: { not: "INACTIVE" } }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assessments: true, mealPlans: true } },
      assessments: {
        orderBy: { assessmentDate: "desc" },
        take: 2,
        include: { anthropometry: true, nutritionalGoal: true },
      },
    },
  });
}

export async function getPatient(id: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  const patient = await prisma.patient.findFirst({
    where: { id, professionalId: actor.userId },
    include: {
      assessments: {
        orderBy: { assessmentDate: "desc" },
        include: { anthropometry: true, nutritionalGoal: true },
      },
      mealPlans: {
        orderBy: { createdAt: "desc" },
        include: { assessment: { include: { nutritionalGoal: true } } },
      },
    },
  });

  if (!patient || !canViewPatientRecord(actor, { professionalId: patient.professionalId, userId: patient.userId, consentActive: false })) {
    return null;
  }

  await auditPatient(actor, "PATIENT_RECORD_VIEWED", patient.id);
  return patient;
}

export async function createPatient(formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { firstName, lastName, documentId, sex, email, phone, dateOfBirth, notes } = parsed.data;

  const patient = await prisma.patient.create({
    data: {
      firstName,
      lastName,
      documentId: documentId || null,
      sex: sex || null,
      email: email || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      notes: notes || null,
      professionalId: actor.userId,
    },
  });

  await auditPatient(actor, "PATIENT_CREATED", patient.id);
  revalidatePatients();
  return { success: true };
}

async function setPatientStatus(id: string, status: "ACTIVE" | "INACTIVE" | "DISCHARGED") {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const result = await prisma.patient.updateMany({
    where: { id, professionalId: actor.userId },
    data: { status },
  });
  if (result.count === 0) return { error: "Paciente no encontrado" };

  await auditPatient(actor, "PATIENT_UPDATED", id, { status });
  revalidatePatients(id);
  return { success: true };
}

/** Desactiva un paciente (soft delete — nunca se borra de la BD) */
export async function deactivatePatient(id: string) {
  return setPatientStatus(id, "INACTIVE");
}

/** Reactiva un paciente desactivado */
export async function reactivatePatient(id: string) {
  return setPatientStatus(id, "ACTIVE");
}

/** Da de alta a un paciente */
export async function dischargePatient(id: string) {
  return setPatientStatus(id, "DISCHARGED");
}

/** Actualiza la información de un paciente */
export async function updatePatient(id: string, formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { firstName, lastName, documentId, sex, email, phone, dateOfBirth, notes } = parsed.data;

  const result = await prisma.patient.updateMany({
    where: { id, professionalId: actor.userId },
    data: {
      firstName,
      lastName,
      documentId: documentId || null,
      sex: sex || null,
      email: email || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      notes: notes || null,
    },
  });

  if (result.count === 0) return { error: "Paciente no encontrado" };

  await auditPatient(actor, "PATIENT_UPDATED", id);
  revalidatePatients(id);
  return { success: true };
}

/** Búsqueda de pacientes con filtros */
export async function searchPatients(query?: string, status?: string) {
  const actor = await requireActorFor("PROFESSIONAL");

  const where: Record<string, unknown> = { professionalId: actor.userId };

  if (status && status !== "ALL") {
    where.status = status;
  }

  const include = {
    _count: { select: { assessments: true, mealPlans: true } },
    assessments: {
      orderBy: { assessmentDate: "desc" as const },
      take: 2,
      include: { anthropometry: true, nutritionalGoal: true },
    },
  };

  if (!query || query.trim().length === 0) {
    return prisma.patient.findMany({ where, orderBy: { createdAt: "desc" }, include });
  }

  // Accent-insensitive, multi-word and typo-tolerant matching is not expressible as a Prisma filter,
  // so rank the professional's (bounded) patient list in memory and load details only for matches.
  const candidates = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, documentId: true, phone: true },
  });
  const rankedIds = rankPatients(candidates, query).map((p) => p.id);
  if (rankedIds.length === 0) return [];

  const details = await prisma.patient.findMany({ where: { id: { in: rankedIds } }, include });
  const byId = new Map(details.map((p) => [p.id, p]));
  return rankedIds.flatMap((id) => byId.get(id) ?? []);
}
