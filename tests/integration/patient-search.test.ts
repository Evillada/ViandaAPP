import { describe, expect, it } from "vitest";
import { searchPatients } from "@/features/patients/actions";
import { prisma } from "../support/db";
import { createPatientRecord, createProfessional } from "../support/factories";
import { signInAs } from "../support/session";

async function patientFor(professionalId: string, firstName: string, lastName: string, documentId: string) {
  const patient = await createPatientRecord(professionalId, { firstName });
  return prisma.patient.update({ where: { id: patient.id }, data: { lastName, documentId } });
}

describe("searchPatients", () => {
  it("busca por documento, sin tildes y con errores de tipeo, sólo entre los propios pacientes", async () => {
    const pro = await createProfessional();
    const other = await createProfessional();
    const maria = await patientFor(pro.id, "María", "Gómez", "1.020.345.678");
    const mario = await patientFor(pro.id, "Mario", "González", "98765432");
    await patientFor(other.id, "María", "Gómez", "1020345678");

    signInAs(pro.id);
    expect((await searchPatients("1020345678")).map((p) => p.id)).toEqual([maria.id]);
    expect((await searchPatients("maria gomez")).map((p) => p.id)).toEqual([maria.id]);
    expect((await searchPatients("gonzales")).map((p) => p.id)).toEqual([mario.id]);
    expect((await searchPatients("ma")).map((p) => p.id).sort()).toEqual([maria.id, mario.id].sort());
    expect(await searchPatients("zzzz")).toEqual([]);
  });
});
