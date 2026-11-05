import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { verifyCredentials } from "@/features/identity/verify-credentials";
import { prisma } from "../support/db";

describe("verifyCredentials", () => {
  it("acepta credenciales válidas y audita AUTH_LOGIN", async () => {
    const user = await prisma.user.create({
      data: { email: "login@test.co", name: "Login", password: await bcrypt.hash("Secreta1!", 4), roles: [] },
    });
    expect(await verifyCredentials("Login@Test.co ", "Secreta1!", "203.0.113.7")).toEqual({
      id: user.id,
      email: "login@test.co",
      name: "Login",
    });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "AUTH_LOGIN" } });
    expect(log).toMatchObject({ actorId: user.id, ip: "203.0.113.7" });
  });

  it("rechaza contraseña incorrecta y audita AUTH_LOGIN_FAILED", async () => {
    await prisma.user.create({
      data: { email: "fail@test.co", password: await bcrypt.hash("Secreta1!", 4), roles: [] },
    });
    expect(await verifyCredentials("fail@test.co", "otra", null)).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "AUTH_LOGIN_FAILED" } })).toBe(1);
  });

  it("rechaza cuenta eliminada aun con contraseña válida y audita AUTH_LOGIN_FAILED", async () => {
    const user = await prisma.user.create({
      data: {
        email: "gone@test.co",
        password: await bcrypt.hash("Secreta1!", 4),
        roles: [],
        deletedAt: new Date(),
      },
    });
    expect(await verifyCredentials("gone@test.co", "Secreta1!", null)).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "AUTH_LOGIN_FAILED" } });
    expect(log.actorId).toBe(user.id);
    expect(await prisma.auditLog.count({ where: { action: "AUTH_LOGIN" } })).toBe(0);
  });

  it("rechaza email inexistente sin actor", async () => {
    expect(await verifyCredentials("nadie@test.co", "x", null)).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "AUTH_LOGIN_FAILED" } });
    expect(log.actorId).toBeNull();
  });
});
