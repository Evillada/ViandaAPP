import { redirect } from "next/navigation";
import { resolveLandingPath } from "@/core/access/landing";
import { auth } from "@/infrastructure/auth/auth";
import { prisma } from "@/infrastructure/database/prisma";

export default async function StartPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true, lastArea: true, professionalProfile: { select: { status: true } } },
  });
  if (!user) redirect("/login");

  redirect(
    resolveLandingPath({
      roles: user.roles,
      lastArea: user.lastArea,
      professionalStatus: user.professionalProfile?.status ?? null,
    })
  );
}
