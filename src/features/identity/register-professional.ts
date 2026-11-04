import bcrypt from "bcryptjs";
import { z } from "zod";
import { recordAudit } from "@/infrastructure/audit/audit-logger";
import { prisma } from "@/infrastructure/database/prisma";

const registerProfessionalSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  licenseNumber: z.string().trim().min(1, "Número de tarjeta profesional requerido").max(40, "Número de tarjeta demasiado largo"),
});

export async function registerProfessional(
  input: unknown,
  meta: { ip: string | null }
): Promise<{ ok: true; userId: string } | { ok: false; status: 400 | 409; error: string }> {
  const parsed = registerProfessionalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, email, password, licenseNumber } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, status: 409, error: "Ya existe una cuenta con este email" };

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roles: [],
        professionalProfile: { create: { licenseNumber } },
      },
      select: { id: true },
    });
    await recordAudit(
      {
        actorId: created.id,
        actorRole: null,
        action: "PROFESSIONAL_REGISTERED",
        entityType: "ProfessionalProfile",
        entityId: created.id,
        metadata: { licenseNumber },
        ip: meta.ip,
      },
      tx
    );
    return created;
  });

  return { ok: true, userId: user.id };
}
