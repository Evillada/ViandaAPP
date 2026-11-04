import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "@/features/identity/safe-callback-url";

describe("safeCallbackUrl", () => {
  it("acepta rutas internas con query", () => {
    expect(safeCallbackUrl("/dashboard/patients?x=1")).toBe("/dashboard/patients?x=1");
  });

  it.each([null, "", "dashboard", "https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "\\\\evil.com", "/\t/evil.com"])(
    "rechaza %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/start");
    }
  );
});
