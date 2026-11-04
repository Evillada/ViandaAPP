import { prisma } from "@/infrastructure/database/prisma";

export async function getCurrentConsentDocument(now: Date) {
  return prisma.consentDocument.findFirst({
    where: { effectiveAt: { lte: now } },
    orderBy: { effectiveAt: "desc" },
  });
}
