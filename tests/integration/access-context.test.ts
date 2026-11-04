import { describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  getActorFor,
  getSessionActor,
  requireActorFor,
} from "@/infrastructure/access/access-context";
import { prisma } from "../support/db";
import { createAdmin, createPatientUser, createProfessional } from "../support/factories";
import { signInAs } from "../support/session";

describe("access-context", () => {
  it("sin sesión no hay actor", async () => {
    signInAs(null);
    expect(await getSessionActor()).toBeNull();
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
  });

  it("profesional aprobado obtiene actor con área activa", async () => {
    const pro = await createProfessional();
    signInAs(pro.id);
    expect(await getActorFor("PROFESSIONAL")).toEqual({
      userId: pro.id,
      roles: ["PROFESSIONAL"],
      activeArea: "PROFESSIONAL",
      professionalStatus: "APPROVED",
    });
  });

  it("profesional pendiente no obtiene actor profesional", async () => {
    const pro = await createProfessional({ status: "PENDING" });
    signInAs(pro.id);
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
    await expect(requireActorFor("PROFESSIONAL")).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("la suspensión surte efecto inmediato (lee BD, no JWT)", async () => {
    const pro = await createProfessional();
    signInAs(pro.id);
    expect(await getActorFor("PROFESSIONAL")).not.toBeNull();
    await prisma.professionalProfile.update({ where: { userId: pro.id }, data: { status: "SUSPENDED" } });
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
  });

  it("admin no obtiene actor profesional; paciente no obtiene admin", async () => {
    const admin = await createAdmin();
    signInAs(admin.id);
    expect(await getActorFor("PROFESSIONAL")).toBeNull();
    expect(await getActorFor("ADMIN")).not.toBeNull();

    const patient = await createPatientUser();
    signInAs(patient.id);
    expect(await getActorFor("ADMIN")).toBeNull();
    expect(await getActorFor("PATIENT")).not.toBeNull();
  });
});
