import { describe, expect, it } from "vitest";
import { registerProfessional } from "@/features/identity/register-professional";
import { prisma } from "../support/db";

const valid = { name: "Laura Gómez", email: "Laura@Test.co", password: "Secreta1", licenseNumber: "TP-12345" };

describe("registerProfessional", () => {
  it("crea cuenta sin roles con perfil PENDING y audita en la misma operación", async () => {
    const result = await registerProfessional(valid, { ip: "203.0.113.7" });
    expect(result.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "laura@test.co" },
      include: { professionalProfile: true },
    });
    expect(user.roles).toEqual([]);
    expect(user.professionalProfile).toMatchObject({ status: "PENDING", licenseNumber: "TP-12345" });
    expect(await prisma.auditLog.count({ where: { action: "PROFESSIONAL_REGISTERED", actorId: user.id } })).toBe(1);
  });

  it("rechaza email duplicado con 409", async () => {
    await registerProfessional(valid, { ip: null });
    expect(await registerProfessional(valid, { ip: null })).toEqual({
      ok: false,
      status: 409,
      error: "Ya existe una cuenta con este email",
    });
  });

  it("exige tarjeta profesional", async () => {
    const result = await registerProfessional({ ...valid, licenseNumber: "" }, { ip: null });
    expect(result).toEqual({ ok: false, status: 400, error: "Número de tarjeta profesional requerido" });
  });
});
