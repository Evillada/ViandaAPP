"use server";

import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

export async function getPatients(includeInactive = false) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  return prisma.patient.findMany({
    where: {
      professionalId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");

  return prisma.patient.findFirst({
    where: { id, professionalId: session.user.id },
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
}

export async function createPatient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  const parsed = patientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    documentId: formData.get("documentId") || undefined,
    sex: formData.get("sex") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { firstName, lastName, documentId, sex, email, phone, dateOfBirth, notes } =
    parsed.data;

  await prisma.patient.create({
    data: {
      firstName,
      lastName,
      documentId: documentId || null,
      sex: sex || null,
      email: email || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      notes: notes || null,
      professionalId: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/patients");
  return { success: true };
}

/** Desactiva un paciente (soft delete — nunca se borra de la BD) */
export async function deactivatePatient(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  await prisma.patient.updateMany({
    where: { id, professionalId: session.user.id },
    data: { status: "INACTIVE" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/patients");
  return { success: true };
}

/** Reactiva un paciente desactivado */
export async function reactivatePatient(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autorizado" };

  await prisma.patient.updateMany({
    where: { id, professionalId: session.user.id },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/patients");
  return { success: true };
}
