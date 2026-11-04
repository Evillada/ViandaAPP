import { prisma } from "@/infrastructure/database/prisma";

export async function getMyProfessionals(
  userId: string
): Promise<{ patientId: string; professionalName: string; grantedAt: Date | null }[]> {
  const records = await prisma.patient.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      professional: { select: { name: true } },
      consents: { where: { userId, revokedAt: null }, orderBy: { grantedAt: "desc" }, take: 1, select: { grantedAt: true } },
    },
  });
  return records.map((r) => ({
    patientId: r.id,
    professionalName: r.professional.name ?? "Tu nutricionista",
    grantedAt: r.consents[0]?.grantedAt ?? null,
  }));
}
