import { resolveLandingPath } from "@/core/access/landing";
import { prisma } from "@/infrastructure/database/prisma";

export type PendingStatus =
  | { redirectTo: string }
  | { status: "PENDING" | "REJECTED" | "SUSPENDED" | "NO_ACCESS"; name: string | null; rejectionReason: string | null };

export async function getPendingStatus(userId: string): Promise<PendingStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      roles: true,
      lastArea: true,
      professionalProfile: { select: { status: true, rejectionReason: true } },
    },
  });
  if (!user) return { redirectTo: "/login" };

  const landing = resolveLandingPath({
    roles: user.roles,
    lastArea: user.lastArea,
    professionalStatus: user.professionalProfile?.status ?? null,
  });
  if (landing !== "/pending") return { redirectTo: landing };

  const profileStatus = user.professionalProfile?.status;
  const status = profileStatus === "PENDING" || profileStatus === "REJECTED" || profileStatus === "SUSPENDED" ? profileStatus : "NO_ACCESS";
  return { status, name: user.name, rejectionReason: user.professionalProfile?.rejectionReason ?? null };
}
