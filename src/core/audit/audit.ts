import type { Role } from "@/core/access/types";

export const AUDIT_ACTIONS = [
  "AUTH_LOGIN",
  "AUTH_LOGIN_FAILED",
  "PATIENT_RECORD_VIEWED",
  "PATIENT_CREATED",
  "PATIENT_UPDATED",
  "ASSESSMENT_CREATED",
  "MEAL_PLAN_CHANGED",
  "APPOINTMENT_CHANGED",
  "INVITATION_CREATED",
  "INVITATION_REVOKED",
  "INVITATION_ACCEPTED",
  "CONSENT_GRANTED",
  "CONSENT_REVOKED",
  "PROFESSIONAL_REGISTERED",
  "PROFESSIONAL_APPROVED",
  "PROFESSIONAL_REJECTED",
  "PROFESSIONAL_SUSPENDED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  actorId: string | null;
  actorRole: Role | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}
