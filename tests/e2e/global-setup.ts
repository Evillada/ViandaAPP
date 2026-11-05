import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resetTestSchema } from "../setup/reset-test-schema";
import { testDatabaseUrl } from "../setup/test-database-url";

export default function globalSetup(): void {
  process.loadEnvFile(".env");
  const url = testDatabaseUrl();
  if (new URL(url).searchParams.get("schema") !== "test") {
    throw new Error("e2e global-setup: la URL no apunta al esquema 'test'");
  }
  // Sólo recrea el esquema `test`; nunca toca `public`.
  resetTestSchema();
  // Contraseñas desechables por corrida; los workers heredan process.env fijado aquí.
  process.env.SEED_DEV_PASSWORD = randomBytes(18).toString("base64url");
  process.env.SEED_PATIENT_PASSWORD = randomBytes(18).toString("base64url");
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("pnpm db:seed", { stdio: "inherit", env });
}
