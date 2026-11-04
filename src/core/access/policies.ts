import type { Actor, Area, AuditScope, PatientRecordRef, Role } from "./types";

export function hasRole(actor: Pick<Actor, "roles">, role: Role): boolean {
  return actor.roles.includes(role);
}

export function isApprovedProfessional(actor: Pick<Actor, "roles" | "professionalStatus">): boolean {
  return hasRole(actor, "PROFESSIONAL") && actor.professionalStatus === "APPROVED";
}

export function canAccessArea(actor: Pick<Actor, "roles" | "professionalStatus">, area: Area): boolean {
  switch (area) {
    case "PROFESSIONAL":
      return isApprovedProfessional(actor);
    case "PATIENT":
      return hasRole(actor, "PATIENT");
    case "ADMIN":
      return hasRole(actor, "ADMIN");
  }
}

function actingAs(actor: Actor, area: Area): boolean {
  return actor.activeArea === area && canAccessArea(actor, area);
}

function ownsRecord(actor: Actor, record: PatientRecordRef): boolean {
  return record.professionalId === actor.userId;
}

export function canViewPatientRecord(actor: Actor, record: PatientRecordRef): boolean {
  if (actingAs(actor, "PROFESSIONAL") && ownsRecord(actor, record)) return true;
  return actingAs(actor, "PATIENT") && record.userId === actor.userId && record.consentActive;
}

export function canEditPatientRecord(actor: Actor, record: PatientRecordRef): boolean {
  return actingAs(actor, "PROFESSIONAL") && ownsRecord(actor, record);
}

export function canManageInvitations(actor: Actor, record: PatientRecordRef): boolean {
  return canEditPatientRecord(actor, record);
}

export function canRevokeConsent(actor: Actor, record: PatientRecordRef): boolean {
  return actingAs(actor, "PATIENT") && record.userId !== null && record.userId === actor.userId;
}

export function canReviewProfessionals(actor: Actor): boolean {
  return actingAs(actor, "ADMIN");
}

export function auditScope(actor: Actor): AuditScope {
  if (actingAs(actor, "ADMIN")) return "ALL";
  if (actingAs(actor, "PROFESSIONAL")) return "OWN_RECORDS";
  return "NONE";
}
