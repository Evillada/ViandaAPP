import { describe, expect, it } from "vitest";
import { availableAreas, resolveLandingPath } from "@/core/access/landing";

describe("availableAreas", () => {
  it("ordena profesional, paciente, admin", () => {
    expect(availableAreas({ roles: ["ADMIN", "PATIENT", "PROFESSIONAL"], professionalStatus: "APPROVED" })).toEqual([
      "PROFESSIONAL",
      "PATIENT",
      "ADMIN",
    ]);
  });
  it("excluye el área profesional si no está aprobado", () => {
    expect(availableAreas({ roles: ["PROFESSIONAL", "ADMIN"], professionalStatus: "SUSPENDED" })).toEqual(["ADMIN"]);
  });
});

describe("resolveLandingPath", () => {
  it("usa lastArea si sigue disponible", () => {
    expect(resolveLandingPath({ roles: ["PROFESSIONAL", "ADMIN"], professionalStatus: "APPROVED", lastArea: "ADMIN" })).toBe("/admin");
  });
  it("ignora lastArea no disponible", () => {
    expect(resolveLandingPath({ roles: ["PATIENT"], professionalStatus: null, lastArea: "ADMIN" })).toBe("/portal");
  });
  it("prioriza el área profesional", () => {
    expect(resolveLandingPath({ roles: ["PATIENT", "PROFESSIONAL"], professionalStatus: "APPROVED", lastArea: null })).toBe("/dashboard");
  });
  it("sin áreas disponibles va a /pending", () => {
    expect(resolveLandingPath({ roles: [], professionalStatus: "PENDING", lastArea: null })).toBe("/pending");
    expect(resolveLandingPath({ roles: [], professionalStatus: null, lastArea: null })).toBe("/pending");
  });
});
