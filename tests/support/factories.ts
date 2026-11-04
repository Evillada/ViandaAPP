import type { ProfessionalStatus, Role } from "@prisma/client";
import { prisma } from "./db";

let sequence = 0;
const unique = () => `${Date.now()}-${++sequence}`;

export async function createProfessional(
  opts: { status?: ProfessionalStatus; extraRoles?: Role[]; name?: string } = {}
) {
  const status = opts.status ?? "APPROVED";
  const hasProfessionalRole = status === "APPROVED" || status === "SUSPENDED";
  return prisma.user.create({
    data: {
      email: `pro-${unique()}@test.co`,
      name: opts.name ?? "Pro Test",
      password: "x",
      roles: [...(hasProfessionalRole ? (["PROFESSIONAL"] as Role[]) : []), ...(opts.extraRoles ?? [])],
      professionalProfile: { create: { licenseNumber: `LIC-${unique()}`, status } },
    },
  });
}

export async function createAdmin() {
  return prisma.user.create({
    data: { email: `admin-${unique()}@test.co`, name: "Admin Test", password: "x", roles: ["ADMIN"] },
  });
}

export async function createPatientUser() {
  return prisma.user.create({
    data: { email: `pac-${unique()}@test.co`, name: "Paciente Test", password: "x", roles: ["PATIENT"] },
  });
}

export async function createAccount() {
  return prisma.user.create({
    data: { email: `acc-${unique()}@test.co`, name: "Cuenta Test", password: "x", roles: [] },
  });
}

export async function createPatientRecord(
  professionalId: string,
  data: { userId?: string; firstName?: string } = {}
) {
  return prisma.patient.create({
    data: {
      firstName: data.firstName ?? "Ana",
      lastName: "Paciente",
      sex: "FEMALE",
      dateOfBirth: new Date("1990-01-01"),
      professionalId,
      userId: data.userId,
    },
  });
}

export async function createConsentDocument(version = "test-v1") {
  return prisma.consentDocument.upsert({
    where: { version },
    update: {},
    create: { version, body: "Texto de prueba", effectiveAt: new Date("2020-01-01T00:00:00Z") },
  });
}
