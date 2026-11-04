import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { invitationState } from "@/core/invitations/invitation-token";
import { prisma } from "@/infrastructure/database/prisma";
import { INVALID_INVITATION_MESSAGE, findInvitationByToken } from "./invitation-preview";

const inviteAccountSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const EMAIL_TAKEN_MESSAGE = "Ya existe una cuenta con este email. Inicia sesión para continuar.";

export async function createInviteAccount(
  input: unknown,
  token: string,
  now: Date
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const invitation = await findInvitationByToken(token);
  if (!invitation || invitationState(invitation, now) !== "VALID") return { ok: false, error: INVALID_INVITATION_MESSAGE };

  const parsed = inviteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: EMAIL_TAKEN_MESSAGE };

  try {
    await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 12), roles: [] },
    });
  } catch (error) {
    // Concurrent sign-ups with the same email: the unique index decides the winner.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: EMAIL_TAKEN_MESSAGE };
    }
    throw error;
  }
  return { ok: true, email };
}
