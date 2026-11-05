import { describe, expect, it } from "vitest";
import { PACKAGE_STATUS_LABELS, packageDisplayStatus } from "@/core/portal/package-status";

const now = new Date("2026-11-04T12:00:00Z");

describe("packageDisplayStatus", () => {
  it("activo sin fecha de fin sigue vigente", () => {
    expect(packageDisplayStatus("ACTIVE", null, now)).toBe("ACTIVE");
  });

  it("activo con fin futuro sigue vigente", () => {
    expect(packageDisplayStatus("ACTIVE", new Date("2026-12-01T00:00:00Z"), now)).toBe("ACTIVE");
  });

  it("activo con fin pasado está vencido", () => {
    expect(packageDisplayStatus("ACTIVE", new Date("2026-10-01T00:00:00Z"), now)).toBe("EXPIRED");
  });

  it("completado y cancelado se mantienen aunque haya pasado el fin", () => {
    const past = new Date("2026-10-01T00:00:00Z");
    expect(packageDisplayStatus("COMPLETED", past, now)).toBe("COMPLETED");
    expect(packageDisplayStatus("CANCELLED", past, now)).toBe("CANCELLED");
  });

  it("tiene etiqueta en español para cada estado", () => {
    expect(PACKAGE_STATUS_LABELS).toEqual({
      ACTIVE: "Vigente",
      EXPIRED: "Vencido",
      COMPLETED: "Finalizado",
      CANCELLED: "Cancelado",
    });
  });
});
