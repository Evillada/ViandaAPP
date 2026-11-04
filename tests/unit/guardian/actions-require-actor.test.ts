import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../../../src", import.meta.url));

/** Funciones que consultan sólo el catálogo público de alimentos (sin datos clínicos). */
const ALLOWED_WITHOUT_ACTOR = new Set(["getFoods"]);

const ACTOR_CALL = /\b(getActorFor|requireActorFor)\(/;

function topLevelFunctions(source: string): { name: string; exported: boolean; body: string }[] {
  const matches = [...source.matchAll(/^(export )?(?:async )?function (\w+)/gm)];
  return matches.map((match, index) => ({
    name: match[2]!,
    exported: Boolean(match[1]),
    body: source.slice(match.index!, matches[index + 1]?.index ?? source.length),
  }));
}

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return serverActionFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return /^["']use server["']/m.test(readFileSync(full, "utf8")) ? [full] : [];
  });
}

const actionFiles = serverActionFiles(SRC_DIR);

it("encuentra los archivos de server actions", () => {
  expect(actionFiles.length).toBeGreaterThanOrEqual(4);
});

describe.each(actionFiles)("%s", (file) => {
  const source = readFileSync(file, "utf8");

  it("sólo exporta funciones declaradas (formas que el guardián puede inspeccionar)", () => {
    expect(source).not.toMatch(/^export\s+(const|let|var|default|\{|\*)/m);
  });

  const guarded = topLevelFunctions(source).filter(
    (fn) => fn.exported && fn.body.includes("prisma.") && !ALLOWED_WITHOUT_ACTOR.has(fn.name)
  );

  if (guarded.length === 0) return;

  it.each(guarded.map((fn) => [fn.name, fn.body] as const))("%s obtiene el actor antes de consultar", (_name, body) => {
    const actorAt = body.search(ACTOR_CALL);
    expect(actorAt).toBeGreaterThanOrEqual(0);
    expect(actorAt).toBeLessThan(body.indexOf("prisma."));
  });
});
