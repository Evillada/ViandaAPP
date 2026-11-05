import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { createServicePackage, deleteServicePackage, updateServicePackage } from "@/features/patients/service-packages";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";

const proActor = (userId: string): Actor => ({ userId, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" });

const valid = { name: "Plan 6 consultas", includedSessions: "6", startsAt: "2026-11-01", endsAt: "2026-12-31", status: "ACTIVE" };

describe("paquetes contratados en la ficha", () => {
  it("crea un paquete con fechas en hora de Bogotá y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    const result = await createServicePackage(proActor(pro.id), patient.id, { ...valid, name: "  Plan 6 consultas  " }, null);
    expect(result).toEqual({ ok: true });
    const pkg = await prisma.servicePackage.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(pkg.name).toBe("Plan 6 consultas");
    expect(pkg.includedSessions).toBe(6);
    expect(pkg.status).toBe("ACTIVE");
    expect(pkg.professionalId).toBe(pro.id);
    expect(pkg.startsAt.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(pkg.endsAt?.toISOString()).toBe("2027-01-01T04:59:59.999Z");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SERVICE_PACKAGE_CHANGED", patientId: patient.id } });
    expect(audit.metadata).toEqual({ change: "created" });
  });

  it("permite sesiones y fin vacíos (sin tope ni vencimiento) y estado por defecto ACTIVE", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    expect(await createServicePackage(proActor(pro.id), patient.id, { name: "Seguimiento", includedSessions: "", startsAt: "2026-11-01", endsAt: "" }, null)).toEqual({ ok: true });
    const pkg = await prisma.servicePackage.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(pkg.includedSessions).toBeNull();
    expect(pkg.endsAt).toBeNull();
    expect(pkg.status).toBe("ACTIVE");
  });

  it("edita un paquete y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await createServicePackage(proActor(pro.id), patient.id, valid, null);
    const pkg = await prisma.servicePackage.findFirstOrThrow({ where: { patientId: patient.id } });
    const result = await updateServicePackage(proActor(pro.id), pkg.id, { name: "Plan 8 consultas", includedSessions: "8", startsAt: "2026-11-02", endsAt: "", status: "COMPLETED" }, null);
    expect(result).toEqual({ ok: true });
    const after = await prisma.servicePackage.findUniqueOrThrow({ where: { id: pkg.id } });
    expect(after.name).toBe("Plan 8 consultas");
    expect(after.includedSessions).toBe(8);
    expect(after.endsAt).toBeNull();
    expect(after.status).toBe("COMPLETED");
    const audits = await prisma.auditLog.findMany({ where: { action: "SERVICE_PACKAGE_CHANGED", patientId: patient.id }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.metadata)).toEqual([{ change: "created" }, { change: "updated" }]);
  });

  it("elimina un paquete y audita", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await createServicePackage(proActor(pro.id), patient.id, valid, null);
    const pkg = await prisma.servicePackage.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(await deleteServicePackage(proActor(pro.id), pkg.id, null)).toEqual({ ok: true });
    expect(await prisma.servicePackage.count({ where: { patientId: patient.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "SERVICE_PACKAGE_CHANGED", patientId: patient.id } })).toBe(2);
  });

  it("valida nombre, sesiones, fechas y estado", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    const actor = proActor(pro.id);
    const create = (over: Partial<typeof valid>) => createServicePackage(actor, patient.id, { ...valid, ...over }, null);
    expect(await create({ name: "x" })).toEqual({ ok: false, error: "El nombre debe tener entre 2 y 80 caracteres" });
    expect(await create({ name: "x".repeat(81) })).toEqual({ ok: false, error: "El nombre debe tener entre 2 y 80 caracteres" });
    expect(await create({ includedSessions: "0" })).toEqual({ ok: false, error: "Las consultas incluidas deben ser un entero entre 1 y 200" });
    expect(await create({ includedSessions: "201" })).toEqual({ ok: false, error: "Las consultas incluidas deben ser un entero entre 1 y 200" });
    expect(await create({ includedSessions: "2.5" })).toEqual({ ok: false, error: "Las consultas incluidas deben ser un entero entre 1 y 200" });
    expect(await create({ startsAt: "" })).toEqual({ ok: false, error: "Fecha de inicio inválida" });
    expect(await create({ startsAt: "01/11/2026" })).toEqual({ ok: false, error: "Fecha de inicio inválida" });
    expect(await create({ endsAt: "31/12/2026" })).toEqual({ ok: false, error: "Fecha de fin inválida" });
    expect(await create({ startsAt: "2026-12-31", endsAt: "2026-11-01" })).toEqual({ ok: false, error: "La fecha de fin no puede ser anterior al inicio" });
    expect(await create({ status: "PAUSED" })).toEqual({ ok: false, error: "Estado inválido" });
    expect(await prisma.servicePackage.count({ where: { patientId: patient.id } })).toBe(0);
    // mismo día de inicio y fin es válido
    expect(await create({ startsAt: "2026-11-01", endsAt: "2026-11-01" })).toEqual({ ok: true });
  });

  it("una edición con datos inválidos no modifica el paquete", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await createServicePackage(proActor(pro.id), patient.id, valid, null);
    const pkg = await prisma.servicePackage.findFirstOrThrow({ where: { patientId: patient.id } });
    expect(await updateServicePackage(proActor(pro.id), pkg.id, { ...valid, name: "" }, null)).toEqual({ ok: false, error: "El nombre debe tener entre 2 y 80 caracteres" });
    expect((await prisma.servicePackage.findUniqueOrThrow({ where: { id: pkg.id } })).name).toBe(valid.name);
  });

  it("otro profesional no puede crear, editar ni eliminar", async () => {
    const pro = await createProfessional();
    const patient = await createPatientRecord(pro.id);
    await createServicePackage(proActor(pro.id), patient.id, valid, null);
    const pkg = await prisma.servicePackage.findFirstOrThrow({ where: { patientId: patient.id } });
    const intruder = proActor((await createProfessional()).id);
    expect(await createServicePackage(intruder, patient.id, valid, null)).toEqual({ ok: false, error: "Paciente no encontrado" });
    expect(await updateServicePackage(intruder, pkg.id, { ...valid, name: "Hackeado" }, null)).toEqual({ ok: false, error: "Paquete no encontrado" });
    expect(await deleteServicePackage(intruder, pkg.id, null)).toEqual({ ok: false, error: "Paquete no encontrado" });
    expect(await updateServicePackage(proActor(pro.id), "no-existe", valid, null)).toEqual({ ok: false, error: "Paquete no encontrado" });
    const after = await prisma.servicePackage.findMany({ where: { patientId: patient.id } });
    expect(after).toHaveLength(1);
    expect(after[0]!.name).toBe(valid.name);
    expect(await prisma.auditLog.count({ where: { action: "SERVICE_PACKAGE_CHANGED", patientId: patient.id } })).toBe(1);
  });
});
