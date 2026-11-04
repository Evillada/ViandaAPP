import { defineConfig } from "@playwright/test";
import { testDatabaseUrl } from "./tests/setup/test-database-url";

process.loadEnvFile(".env");
const PORT = 3100;
const testDb = testDatabaseUrl();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: testDb,
      DIRECT_URL: testDb,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      AUTH_TRUST_HOST: "true",
    },
  },
});
