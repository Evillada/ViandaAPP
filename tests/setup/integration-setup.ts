import { beforeEach, vi } from "vitest";
import { testDatabaseUrl } from "./test-database-url";

process.loadEnvFile(".env");
process.env.DATABASE_URL = testDatabaseUrl();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "vitest",
        host: "localhost:3000",
      })
  ),
}));
vi.mock("@/infrastructure/auth/auth", () => ({
  auth: vi.fn(async () => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

beforeEach(async () => {
  const { resetDatabase } = await import("../support/db");
  await resetDatabase();
});
