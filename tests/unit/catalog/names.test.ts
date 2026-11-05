import { describe, expect, it } from "vitest";
import { fixName, normalizeSearch, unifyAccents } from "@/core/catalog/names";

describe("fixName", () => {
  it("corrige los errores de OCR verificados en la imagen", () => {
    expect(fixName("Lechuga común, oruala")).toBe("Lechuga común, cruda");
    expect(fixName("Almidón de achira, orudo")).toBe("Almidón de achira, crudo");
    expect(fixName("Ge letas dulces, tipo polvorosas")).toBe("Galletas dulces, tipo polvorosas");
    expect(fixName("Marañón, tostado, sin sa")).toBe("Marañón, tostado, sin sal");
    expect(fixName("caco, crudo")).toBe("Icaco, crudo");
    expect(fixName("Name, con cáscara, crudo")).toBe("Ñame, con cáscara, crudo");
  });

  it("no toca palabras correctas que se parecen a un error", () => {
    expect(fixName("Maíz porva, crudo")).toBe("Maíz porva, crudo");
    expect(fixName("Frijol radical, crudo")).toBe("Frijol radical, crudo");
    expect(fixName("Sal")).toBe("Sal");
  });
});

describe("unifyAccents", () => {
  it("usa la forma con tilde cuando la misma fuente la trae", () => {
    const names = ["Plátano hartón, maduro", "Platano dominico, verde", "Papa, con cascara", "Papa, con cáscara"];
    expect(unifyAccents(names)).toEqual(["Plátano hartón, maduro", "Plátano dominico, verde", "Papa, con cáscara", "Papa, con cáscara"]);
  });

  it("respeta mayúscula inicial y no inventa tildes que la fuente no trae", () => {
    expect(unifyAccents(["cáscara", "Cascara", "Brocoli"])).toEqual(["cáscara", "Cáscara", "Brocoli"]);
  });
});

describe("normalizeSearch", () => {
  it("minúsculas sin tildes, conserva la ñ y colapsa espacios", () => {
    expect(normalizeSearch("  Ñame,  sin Cáscara ")).toBe("ñame, sin cascara");
  });
});
