import { describe, expect, it } from "vitest";
import { prisma } from "../support/db";
import { createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

describe("esquema de identidad", () => {
  it("permite varios roles por cuenta", async () => {
    const pro = await createProfessional({ extraRoles: ["ADMIN"] });
    expect(pro.roles).toEqual(["PROFESSIONAL", "ADMIN"]);
  });

  it("impide dos fichas del mismo profesional vinculadas a la misma cuenta", async () => {
    const pro = await createProfessional();
    const account = await createPatientUser();
    await createPatientRecord(pro.id, { userId: account.id });
    await expect(createPatientRecord(pro.id, { userId: account.id })).rejects.toThrow();
  });

  it("permite varias fichas sin cuenta del mismo profesional", async () => {
    const pro = await createProfessional();
    await createPatientRecord(pro.id);
    await createPatientRecord(pro.id);
    expect(await prisma.patient.count({ where: { professionalId: pro.id } })).toBe(2);
  });
});
