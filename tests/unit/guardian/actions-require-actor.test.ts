import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../../../src", import.meta.url));
const APP_DIR = path.join(SRC_DIR, "app");

/**
 * Server actions que pueden ejecutarse sin actor. Toda entrada nueva necesita una razón:
 * cada export de un archivo "use server" es un endpoint público.
 */
const ALLOWED_WITHOUT_ACTOR: Record<string, string> = {
  signOutAction: "cerrar sesión no lee datos",
  createInviteAccountAction: "alta anónima autorizada por el token de invitación",
};

/** Páginas/layouts que pueden importar prisma directamente. */
const APP_FILES_ALLOWED_PRISMA: Record<string, string> = {
  "start/page.tsx": "sólo lee el propio usuario de la sesión para decidir el aterrizaje",
};

const ACTOR_CALL = /\b(getActorFor|requireActorFor|getSessionActor)\(/;

function topLevelFunctions(source: string): { name: string; exported: boolean; body: string }[] {
  const matches = [...source.matchAll(/^(export )?(?:async )?function (\w+)/gm)];
  return matches.map((match, index) => ({
    name: match[2]!,
    exported: Boolean(match[1]),
    body: source.slice(match.index!, matches[index + 1]?.index ?? source.length),
  }));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const actionFiles = sourceFiles(SRC_DIR).filter((file) => /^["']use server["']/m.test(readFileSync(file, "utf8")));

it("encuentra los archivos de server actions", () => {
  expect(actionFiles.length).toBeGreaterThanOrEqual(4);
});

describe.each(actionFiles)("%s", (file) => {
  const source = readFileSync(file, "utf8");
  const functions = topLevelFunctions(source);

  it("sólo exporta funciones declaradas (formas que el guardián puede inspeccionar)", () => {
    expect(source).not.toMatch(/^export\s+(const|let|var|default|\{|\*)/m);
  });

  /** Obtiene el actor antes de tocar prisma, directamente o delegando en una función del archivo que lo hace. */
  function guards(name: string, seen = new Set<string>()): boolean {
    if (seen.has(name)) return false;
    seen.add(name);
    const fn = functions.find((candidate) => candidate.name === name);
    if (!fn) return false;
    const actorAt = fn.body.search(ACTOR_CALL);
    const prismaAt = fn.body.indexOf("prisma.");
    if (actorAt >= 0 && (prismaAt < 0 || actorAt < prismaAt)) return true;
    if (prismaAt >= 0) return false;
    return functions.some(
      (other) => other.name !== name && new RegExp(`\\b${other.name}\\(`).test(fn.body) && guards(other.name, seen)
    );
  }

  const exported = functions.filter((fn) => fn.exported && !(fn.name in ALLOWED_WITHOUT_ACTOR));

  it.each(exported.map((fn) => [fn.name] as const))("%s exige actor", (name) => {
    expect(guards(name)).toBe(true);
  });
});

describe("páginas y layouts", () => {
  const appFiles = sourceFiles(APP_DIR);

  it.each(appFiles.map((file) => [path.relative(APP_DIR, file)] as const))("%s no importa prisma", (relative) => {
    if (relative in APP_FILES_ALLOWED_PRISMA) return;
    const source = readFileSync(path.join(APP_DIR, relative), "utf8");
    expect(source).not.toMatch(/infrastructure\/database\/prisma|@prisma\/client/);
  });
});
