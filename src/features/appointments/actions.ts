"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActorFor, requireActorFor } from "@/infrastructure/access/access-context";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestMeta } from "@/infrastructure/http/request-meta";

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Paciente requerido"),
  date: z.string().min(1, "Fecha requerida"),
  time: z.string().min(1, "Hora requerida"),
  duration: z.coerce.number().min(15).max(180).default(30),
  reason: z.string().optional(),
});

async function auditAppointment(actorId: string, appointmentId: string, patientId: string, metadata: Record<string, unknown>) {
  const { ip } = await getRequestMeta();
  await recordAuditBestEffort({
    actorId,
    actorRole: "PROFESSIONAL",
    action: "APPOINTMENT_CHANGED",
    entityType: "Appointment",
    entityId: appointmentId,
    patientId,
    metadata,
    ip,
  });
}

function todayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

export async function getAppointments() {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.appointment.findMany({
    where: { professionalId: actor.userId },
    include: { patient: true },
    orderBy: { date: "asc" },
  });
}

export async function getTodayAppointments() {
  const actor = await requireActorFor("PROFESSIONAL");
  const { today, tomorrow } = todayRange();

  return prisma.appointment.findMany({
    where: {
      professionalId: actor.userId,
      date: { gte: today, lt: tomorrow },
      status: "SCHEDULED",
    },
    include: { patient: true },
    orderBy: { date: "asc" },
  });
}

export async function getUpcomingAppointments() {
  const actor = await requireActorFor("PROFESSIONAL");

  return prisma.appointment.findMany({
    where: {
      professionalId: actor.userId,
      date: { gte: new Date() },
      status: "SCHEDULED",
    },
    include: { patient: true },
    orderBy: { date: "asc" },
    take: 5,
  });
}

export async function createAppointment(formData: FormData) {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const parsed = appointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    date: formData.get("date"),
    time: formData.get("time"),
    duration: formData.get("duration") || 30,
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { patientId, date, time, duration, reason } = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: actor.userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      professionalId: actor.userId,
      date: new Date(`${date}T${time}`),
      duration,
      reason: reason || null,
    },
  });

  await auditAppointment(actor.userId, appointment.id, patientId, { change: "created" });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: true };
}

export async function updateAppointmentStatus(id: string, status: "SCHEDULED" | "COMPLETED" | "CANCELLED") {
  const actor = await getActorFor("PROFESSIONAL");
  if (!actor) return { error: "No autorizado" };

  const appointment = await prisma.appointment.findFirst({
    where: { id, professionalId: actor.userId },
    select: { id: true, patientId: true },
  });
  if (!appointment) return { error: "Cita no encontrada" };

  await prisma.appointment.updateMany({ where: { id, professionalId: actor.userId }, data: { status } });

  await auditAppointment(actor.userId, id, appointment.patientId, { status });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: true };
}

export async function getDashboardStats() {
  const actor = await requireActorFor("PROFESSIONAL");
  const { today, tomorrow } = todayRange();

  const [patientCount, assessmentCount, planCount, todayCount] = await Promise.all([
    prisma.patient.count({ where: { professionalId: actor.userId } }),
    prisma.assessment.count({ where: { professionalId: actor.userId } }),
    prisma.mealPlan.count({ where: { professionalId: actor.userId } }),
    prisma.appointment.count({
      where: {
        professionalId: actor.userId,
        date: { gte: today, lt: tomorrow },
        status: "SCHEDULED",
      },
    }),
  ]);

  return { patientCount, assessmentCount, planCount, todayCount };
}
