export const ROLES = ["PATIENT", "PROFESSIONAL", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];
export type Area = Role;
export type ProfessionalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface Actor {
  userId: string;
  roles: readonly Role[];
  activeArea: Area | null;
  professionalStatus: ProfessionalStatus | null;
}

export interface PatientRecordRef {
  professionalId: string;
  userId: string | null;
  consentActive: boolean;
}

export type AuditScope = "ALL" | "OWN_RECORDS" | "NONE";
