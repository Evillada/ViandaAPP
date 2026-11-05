import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { buildPortalHome, buildPortalWeek, loadPortalContext } from "@/features/portal/portal-view";
import { prisma } from "../support/db";
import { createConsentDocument, createPatientRecord, createPatientUser, createProfessional } from "../support/factories";

const now = new Date("2026-11-04T13:00:00Z");
const patientActor = (userId: string): Actor => ({ userId, roles: ["PATIENT"], activeArea: "PATIENT", professionalStatus: null });

async function linkedWithPlan() {
  const document = await createConsentDocument();
  const pro = await createProfessional({ name: "Dra. Ruiz" });
  const account = await createPatientUser();
  const patient = await createPatientRecord(pro.id, { userId: account.id, firstName: "María" });
  await prisma.patientConsent.create({ data: { patientId: patient.id, userId: account.id, documentId: document.id } });
  await prisma.mealPlan.create({
    data: {
      name: "Plan", patientId: patient.id, professionalId: pro.id, status: "ACTIVE", activatedAt: new Date("2026-11-02T15:00:00Z"),
      days: { create: [{ name: "Día 1", orderNum: 1 }, { name: "Día 2", orderNum: 2 }] },
    },
  });
  return { pro, account, patient };
}

describe("vista del portal", () => {
  it("sin fichas vigentes no hay contexto", async () => {
    const account = await createPatientUser();
    expect(await loadPortalContext(patientActor(account.id), null)).toBeNull();
  });

  it("un actor que no es paciente no obtiene contexto", async () => {
    const { account } = await linkedWithPlan();
    const asPro: Actor = { userId: account.id, roles: ["PATIENT"], activeArea: "PROFESSIONAL", professionalStatus: null };
    expect(await loadPortalContext(asPro, null)).toBeNull();
  });

  it("no permite ver la ficha de otro paciente aunque se pida su id", async () => {
    const mine = await linkedWithPlan();
    const other = await linkedWithPlan();
    const ctx = await loadPortalContext(patientActor(mine.account.id), other.patient.id);
    expect(ctx?.current.patientId).toBe(mine.patient.id);
  });

  it("el inicio calcula el día del ciclo de hoy y el saludo", async () => {
    const { account } = await linkedWithPlan();
    const home = await buildPortalHome(patientActor(account.id), null, now, "María");
    expect(home?.greeting.salutation).toBe("Buenos días, María");
    expect(home?.today.day?.name).toBe("Día 1"); // 2-nov día 0, 3-nov día 1, 4-nov día 0 (ciclo de 2)
    expect(home?.greeting.fact).toBe("Llevas 2 días con tu plan");
  });

  it("la semana asigna días del ciclo y null antes de la activación", async () => {
    const { account } = await linkedWithPlan();
    const week = await buildPortalWeek(patientActor(account.id), null, now, 0);
    expect(week?.week.map((d) => d.dayIndex)).toEqual([0, 1, 0, 1, 0, 1, 0]);
    const previous = await buildPortalWeek(patientActor(account.id), null, now, -1);
    expect(previous?.week.every((d) => d.dayIndex === null)).toBe(true);
    expect(week?.todayKey).toBe("2026-11-04");
  });
});
