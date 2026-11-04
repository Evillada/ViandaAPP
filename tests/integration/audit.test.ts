import { describe, expect, it, vi } from "vitest";
import { AuditAction as PrismaAuditAction } from "@prisma/client";
import { AUDIT_ACTIONS } from "@/core/audit/audit";
import { recordAudit, recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

describe("auditoría", () => {
  it("la lista de acciones de core coincide con el enum de Prisma", () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual(Object.values(PrismaAuditAction).sort());
  });

  it("registra una entrada con paciente y metadata", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await recordAudit({
      actorId: pro.id,
      actorRole: "PROFESSIONAL",
      action: "PATIENT_RECORD_VIEWED",
      entityType: "Patient",
      entityId: patient.id,
      patientId: patient.id,
      metadata: { source: "test" },
      ip: "203.0.113.7",
    });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(log).toMatchObject({ action: "PATIENT_RECORD_VIEWED", actorRole: "PROFESSIONAL", ip: "203.0.113.7" });
    expect(log.metadata).toEqual({ source: "test" });
  });

  it("recordAudit dentro de una transacción fallida no deja rastro", async () => {
    const pro = await createProfessional();
    await expect(
      prisma.$transaction(async (tx) => {
        await recordAudit({ actorId: pro.id, actorRole: null, action: "INVITATION_CREATED", entityType: "PatientInvitation" }, tx);
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("best effort no lanza si la escritura falla", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAuditBestEffort({ actorId: "no-existe", actorRole: null, action: "AUTH_LOGIN", entityType: "User" })
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
