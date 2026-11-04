import { vi } from "vitest";
import { auth } from "@/infrastructure/auth/auth";

type AuthFn = () => Promise<unknown>;

export function signInAs(userId: string | null): void {
  const session = userId
    ? { user: { id: userId, email: `${userId}@test.co`, name: "Test" }, expires: "2999-01-01T00:00:00.000Z" }
    : null;
  vi.mocked(auth as unknown as AuthFn).mockResolvedValue(session);
}
