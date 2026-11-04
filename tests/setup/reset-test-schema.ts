import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database-url";

/**
 * Recrea únicamente el esquema Postgres `test` y le aplica el esquema Prisma.
 * Nunca toca `public`. Requiere que DIRECT_URL esté en process.env.
 */
export function resetTestSchema(): void {
  const url = testDatabaseUrl();
  if (new URL(url).searchParams.get("schema") !== "test") {
    throw new Error("resetTestSchema: la URL no apunta al esquema 'test'");
  }
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };

  // La URL llega sólo por el entorno del hijo (DATABASE_URL/DIRECT_URL), nunca por argv.
  execSync("pnpm exec prisma db execute --schema prisma/schema.prisma --stdin", {
    input: 'DROP SCHEMA IF EXISTS "test" CASCADE; CREATE SCHEMA "test";',
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });
  execSync("pnpm exec prisma db push --skip-generate", { stdio: "inherit", env });
}
