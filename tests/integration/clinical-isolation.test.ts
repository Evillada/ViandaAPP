import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "@/infrastructure/access/access-context";
import { createAppointment } from "@/features/appointments/actions";
import { getAssessment } from "@/features/assessments/actions";
import { getMealPlan } from "@/features/nutrition/actions";
import { getPatient, getPatients, updatePatient } from "@/features/patients/actions";
import { prisma } from "../support/db";
import { createAdmin, createPatientRecord, createProfessional } from "../support/factories";
import { signInAs } from "../support/session";

async function setup() {
  const proA = await createProfessional({ name: "Pro A" });
  const proB = await createProfessional({ name: "Pro B" });
  const patientB = await createPatientRecord(proB.id, { firstName: "Beatriz" });
  const assessmentB = await prisma.assessment.create({
    data: { reason: "Control", patientId: patientB.id, professionalId: proB.id },
  });
  const planB = await prisma.mealPlan.create({
    data: { name: "Plan B", patientId: patientB.id, professionalId: proB.id },
  });
  return { proA, proB, patientB, assessmentB, planB };
}

describe("aislamiento clínico entre profesionales", () => {
  it("A no lee la ficha, valoración ni plan de B", async () => {
    const { proA, patientB, assessmentB, planB } = await setup();
    signInAs(proA.id);
    expect(await getPatient(patientB.id)).toBeNull();
    expect(await getAssessment(assessmentB.id)).toBeNull();
    expect(await getMealPlan(planB.id)).toBeNull();
    expect((await getPatients()).map((p) => p.id)).not.toContain(patientB.id);
  });

  it("A no edita la ficha de B ni le agenda citas", async () => {
    const { proA, patientB } = await setup();
    signInAs(proA.id);
    const form = new FormData();
    form.set("firstName", "Hack");
    form.set("lastName", "Hack");
    expect(await updatePatient(patientB.id, form)).toEqual({ error: "Paciente no encontrado" });

    const appointment = new FormData();
    appointment.set("patientId", patientB.id);
    appointment.set("date", "2026-12-01");
    appointment.set("time", "10:00");
    expect(await createAppointment(appointment)).toEqual({ error: "Paciente no encontrado" });
  });

  it("abrir la ficha propia audita PATIENT_RECORD_VIEWED", async () => {
    const { proB, patientB } = await setup();
    signInAs(proB.id);
    expect((await getPatient(patientB.id))?.id).toBe(patientB.id);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "PATIENT_RECORD_VIEWED" } });
    expect(log).toMatchObject({ actorId: proB.id, actorRole: "PROFESSIONAL", patientId: patientB.id });
  });

  it("admin y profesional pendiente no acceden a datos clínicos", async () => {
    const { patientB } = await setup();
    const admin = await createAdmin();
    signInAs(admin.id);
    await expect(getPatients()).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(getPatient(patientB.id)).rejects.toBeInstanceOf(AccessDeniedError);

    const pending = await createProfessional({ status: "PENDING" });
    signInAs(pending.id);
    await expect(getPatients()).rejects.toBeInstanceOf(AccessDeniedError);
  });
});
