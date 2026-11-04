import { describe, expect, it } from "vitest";
import { areaLinks } from "@/features/identity/navigation";

describe("areaLinks", () => {
  it("lista sólo áreas disponibles y marca la actual", () => {
    expect(
      areaLinks({ userId: "u", roles: ["PROFESSIONAL", "ADMIN"], activeArea: "ADMIN", professionalStatus: "APPROVED" }, "ADMIN")
    ).toEqual([
      { area: "PROFESSIONAL", label: "Consulta", active: false },
      { area: "ADMIN", label: "Administración", active: true },
    ]);
  });
});
