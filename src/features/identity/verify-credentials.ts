import bcrypt from "bcryptjs";
import { recordAuditBestEffort } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash("vianda-dummy-password", 12);
  return dummyHashPromise;
}

export async function verifyCredentials(
  email: string,
  password: string,
  ip: string | null
): Promise<{ id: string; email: string; name: string | null } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  // Always run a bcrypt comparison so response time does not reveal whether the email exists.
  const matches = await bcrypt.compare(password, user?.password ?? (await dummyHash()));
  const valid = Boolean(user?.password) && matches;

  if (!user || !valid) {
    await recordAuditBestEffort({
      actorId: user?.id ?? null,
      actorRole: null,
      action: "AUTH_LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id ?? null,
      metadata: { email: normalizedEmail },
      ip,
    });
    return null;
  }

  await recordAuditBestEffort({
    actorId: user.id,
    actorRole: null,
    action: "AUTH_LOGIN",
    entityType: "User",
    entityId: user.id,
    ip,
  });
  return { id: user.id, email: user.email, name: user.name };
}
