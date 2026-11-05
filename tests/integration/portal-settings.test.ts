import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { updatePortalSettings } from "@/features/patients/portal-settings";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

describe("configuración del portal en la ficha", () => {
  it("guarda mensaje, vigencia e interruptor de progreso, y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    expect(await updatePortalSettings(proActor(pro.id), patient.id, { message: "  Agua primero  ", until: "2026-11-30", progressEnabled: false }, null)).toEqual({ ok: true });
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.portalMessage).toBe("Agua primero");
    expect(after.portalMessageUntil?.toISOString()).toBe("2026-12-01T04:59:59.999Z"); // fin del 30-nov en Bogotá
    expect(after.progressMessagesEnabled).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "PATIENT_UPDATED", patientId: patient.id } })).toBe(1);
  });

  it("mensaje vacío borra el mensaje y la vigencia", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await updatePortalSettings(proActor(pro.id), patient.id, { message: "Hola", until: "", progressEnabled: true }, null);
    await updatePortalSettings(proActor(pro.id), patient.id, { message: "  ", until: "2026-11-30", progressEnabled: true }, null);
    const after = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.portalMessage).toBeNull();
    expect(after.portalMessageUntil).toBeNull();
  });

  it("valida longitud y fecha, y bloquea a otro profesional", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    expect(await updatePortalSettings(proActor(pro.id), patient.id, { message: "x".repeat(281), until: "", progressEnabled: true }, null)).toEqual({ ok: false, error: "El mensaje admite máximo 280 caracteres" });
    expect(await updatePortalSettings(proActor(pro.id), patient.id, { message: "Hola", until: "30/11/2026", progressEnabled: true }, null)).toEqual({ ok: false, error: "Fecha de vigencia inválida" });
    const intruder = await createProfessional();
    expect(await updatePortalSettings(proActor(intruder.id), patient.id, { message: "Hola", until: "", progressEnabled: true }, null)).toEqual({ ok: false, error: "Paciente no encontrado" });
  });
});
