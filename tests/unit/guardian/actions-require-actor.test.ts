import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FEATURES_DIR = fileURLToPath(new URL("../../../src/features", import.meta.url));

/** Funciones que consultan sólo el catálogo público de alimentos (sin datos clínicos). */
const ALLOWED_WITHOUT_ACTOR = new Set(["getFoods"]);

function topLevelFunctions(source: string): { name: string; exported: boolean; body: string }[] {
  const matches = [...source.matchAll(/^(export )?(?:async )?function (\w+)/gm)];
  return matches.map((match, index) => ({
    name: match[2]!,
    exported: Boolean(match[1]),
    body: source.slice(match.index!, matches[index + 1]?.index ?? source.length),
  }));
}

const actionFiles = readdirSync(FEATURES_DIR)
  .map((dir) => path.join(FEATURES_DIR, dir, "actions.ts"))
  .filter((file) => existsSync(file));

describe.each(actionFiles)("%s", (file) => {
  const guarded = topLevelFunctions(readFileSync(file, "utf8")).filter(
    (fn) => fn.exported && fn.body.includes("prisma.") && !ALLOWED_WITHOUT_ACTOR.has(fn.name)
  );

  if (guarded.length === 0) {
    it("no tiene funciones exportadas que consulten prisma", () => {
      expect(guarded).toEqual([]);
    });
    return;
  }

  it.each(guarded.map((fn) => [fn.name, fn.body] as const))("%s obtiene el actor antes de consultar", (_name, body) => {
    expect(body).toMatch(/\b(getActorFor|requireActorFor)\(/);
  });
});
