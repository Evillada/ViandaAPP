"use server";

import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const appointmentSchema = z.object({
  patientId: z.string().min(1, "Paciente requerido"),
  date: z.string().min(1, "Fecha requerida"),
  time: z.string().min(1, "Hora requerida"),
  duration: z.coerce.number().min(15).max(180).default(30),
  reason: z.string().optional(),
});

export async function getAppointments() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  return prisma.appointment.findMany({
    where: { professionalId: session.user.id },
    include: { patient: true },
    orderBy: { date: "asc" },
  });
}

export async function getTodayAppointments() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.appointment.findMany({
    where: {
      professionalId: session.user.id,
      date: { gte: today, lt: tomorrow },
      status: "SCHEDULED",
    },
    include: { patient: true },
    orderBy: { date: "asc" },
  });
}

export async function getUpcomingAppointments() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const now = new Date();

  return prisma.appointment.findMany({
    where: {
      professionalId: session.user.id,
      date: { gte: now },
      status: "SCHEDULED",
    },
    include: { patient: true },
    orderBy: { date: "asc" },
    take: 5,
  });
}

export async function createAppointment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

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
    where: { id: patientId, professionalId: session.user.id },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const appointmentDate = new Date(`${date}T${time}`);

  await prisma.appointment.create({
    data: {
      patientId,
      professionalId: session.user.id,
      date: appointmentDate,
      duration,
      reason: reason || null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: true };
}

export async function updateAppointmentStatus(
  id: string,
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  await prisma.appointment.updateMany({
    where: { id, professionalId: session.user.id },
    data: { status },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: true };
}

export async function getDashboardStats() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [patientCount, assessmentCount, planCount, todayCount] = await Promise.all([
    prisma.patient.count({ where: { professionalId: session.user.id } }),
    prisma.assessment.count({ where: { professionalId: session.user.id } }),
    prisma.mealPlan.count({ where: { professionalId: session.user.id } }),
    prisma.appointment.count({
      where: {
        professionalId: session.user.id,
        date: { gte: today, lt: tomorrow },
        status: "SCHEDULED",
      },
    }),
  ]);

  return { patientCount, assessmentCount, planCount, todayCount };
}
