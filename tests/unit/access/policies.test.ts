import { describe, expect, it } from "vitest";
import type { Actor, Area, PatientRecordRef, Role } from "@/core/access/types";
import {
  auditScope,
  canAccessArea,
  canEditPatientRecord,
  canManageInvitations,
  canReviewProfessionals,
  canRevokeConsent,
  canViewPatientRecord,
} from "@/core/access/policies";

function actor(roles: Role[], activeArea: Area | null, professionalStatus: Actor["professionalStatus"] = null): Actor {
  return { userId: "u1", roles, activeArea, professionalStatus };
}

const ownRecord: PatientRecordRef = { professionalId: "u1", userId: null, consentActive: false };
const otherRecord: PatientRecordRef = { professionalId: "u2", userId: null, consentActive: false };
const myPatientRecord: PatientRecordRef = { professionalId: "u2", userId: "u1", consentActive: true };

describe("canAccessArea", () => {
  it("profesional aprobado entra al área profesional", () => {
    expect(canAccessArea(actor(["PROFESSIONAL"], null, "APPROVED"), "PROFESSIONAL")).toBe(true);
  });
  it.each(["PENDING", "REJECTED", "SUSPENDED"] as const)("profesional %s no entra", (status) => {
    expect(canAccessArea(actor(["PROFESSIONAL"], null, status), "PROFESSIONAL")).toBe(false);
  });
  it("paciente entra al portal", () => {
    expect(canAccessArea(actor(["PATIENT"], null), "PATIENT")).toBe(true);
  });
  it("admin entra a administración y no al área profesional", () => {
    expect(canAccessArea(actor(["ADMIN"], null), "ADMIN")).toBe(true);
    expect(canAccessArea(actor(["ADMIN"], null), "PROFESSIONAL")).toBe(false);
  });
  it("cuenta sin roles no entra a ningún área", () => {
    for (const area of ["PATIENT", "PROFESSIONAL", "ADMIN"] as const) {
      expect(canAccessArea(actor([], null), area)).toBe(false);
    }
  });
});

describe("fichas clínicas", () => {
  const pro = actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED");

  it("profesional ve y edita sus fichas", () => {
    expect(canViewPatientRecord(pro, ownRecord)).toBe(true);
    expect(canEditPatientRecord(pro, ownRecord)).toBe(true);
    expect(canManageInvitations(pro, ownRecord)).toBe(true);
  });
  it("profesional no ve ni edita fichas ajenas", () => {
    expect(canViewPatientRecord(pro, otherRecord)).toBe(false);
    expect(canEditPatientRecord(pro, otherRecord)).toBe(false);
    expect(canManageInvitations(pro, otherRecord)).toBe(false);
  });
  it("profesional suspendido no ve sus fichas", () => {
    expect(canViewPatientRecord(actor(["PROFESSIONAL"], "PROFESSIONAL", "SUSPENDED"), ownRecord)).toBe(false);
  });
  it("admin + profesional actuando como admin no ve fichas", () => {
    const both = actor(["PROFESSIONAL", "ADMIN"], "ADMIN", "APPROVED");
    expect(canViewPatientRecord(both, ownRecord)).toBe(false);
    expect(canEditPatientRecord(both, ownRecord)).toBe(false);
  });
  it("admin puro nunca ve fichas", () => {
    expect(canViewPatientRecord(actor(["ADMIN"], "ADMIN"), otherRecord)).toBe(false);
  });
  it("paciente ve su ficha sólo con consentimiento vigente", () => {
    const patient = actor(["PATIENT"], "PATIENT");
    expect(canViewPatientRecord(patient, myPatientRecord)).toBe(true);
    expect(canViewPatientRecord(patient, { ...myPatientRecord, consentActive: false })).toBe(false);
  });
  it("paciente nunca edita ni invita", () => {
    const patient = actor(["PATIENT"], "PATIENT");
    expect(canEditPatientRecord(patient, myPatientRecord)).toBe(false);
    expect(canManageInvitations(patient, myPatientRecord)).toBe(false);
  });
  it("paciente no ve fichas de otra cuenta", () => {
    expect(canViewPatientRecord(actor(["PATIENT"], "PATIENT"), { ...myPatientRecord, userId: "u9" })).toBe(false);
  });
});

describe("consentimiento y revisión", () => {
  it("paciente revoca sólo su propio consentimiento", () => {
    const patient = actor(["PATIENT"], "PATIENT");
    expect(canRevokeConsent(patient, myPatientRecord)).toBe(true);
    expect(canRevokeConsent(patient, { ...myPatientRecord, userId: "u9" })).toBe(false);
    expect(canRevokeConsent(patient, { ...myPatientRecord, userId: null })).toBe(false);
  });
  it("profesional no revoca consentimientos", () => {
    expect(canRevokeConsent(actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED"), myPatientRecord)).toBe(false);
  });
  it("sólo admin actuando como admin revisa profesionales", () => {
    expect(canReviewProfessionals(actor(["ADMIN"], "ADMIN"))).toBe(true);
    expect(canReviewProfessionals(actor(["ADMIN", "PROFESSIONAL"], "PROFESSIONAL", "APPROVED"))).toBe(false);
    expect(canReviewProfessionals(actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED"))).toBe(false);
  });
});

describe("auditScope", () => {
  it("admin ve toda la auditoría, profesional la de sus fichas, paciente nada", () => {
    expect(auditScope(actor(["ADMIN"], "ADMIN"))).toBe("ALL");
    expect(auditScope(actor(["PROFESSIONAL"], "PROFESSIONAL", "APPROVED"))).toBe("OWN_RECORDS");
    expect(auditScope(actor(["PATIENT"], "PATIENT"))).toBe("NONE");
  });
});
