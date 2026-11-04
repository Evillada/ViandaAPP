import { describe, expect, it } from "vitest";
import type { Actor } from "@/core/access/types";
import { listProfessionalsForReview, reviewProfessional } from "@/features/admin/review-professionals";
import { prisma } from "../support/db";
import { createAdmin, createProfessional } from "../support/factories";

function adminActor(userId: string): Actor {
  return { userId, roles: ["ADMIN"], activeArea: "ADMIN", professionalStatus: null };
}

async function profileOf(userId: string) {
  return prisma.professionalProfile.findUniqueOrThrow({ where: { userId } });
}

describe("reviewProfessional", () => {
  it("aprobar agrega el rol PROFESSIONAL y audita", async () => {
    const admin = await createAdmin();
    const pending = await createProfessional({ status: "PENDING" });
    const profile = await profileOf(pending.id);

    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "APPROVE", ip: null })).toEqual({ ok: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: pending.id }, include: { professionalProfile: true } });
    expect(user.roles).toContain("PROFESSIONAL");
    expect(user.professionalProfile).toMatchObject({ status: "APPROVED", reviewedById: admin.id });
    expect(await prisma.auditLog.count({ where: { action: "PROFESSIONAL_APPROVED", entityId: profile.id } })).toBe(1);
  });

  it("rechazar exige motivo", async () => {
    const admin = await createAdmin();
    const profile = await profileOf((await createProfessional({ status: "PENDING" })).id);
    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "REJECT", reason: " ", ip: null })).toEqual({
      ok: false,
      error: "Indica el motivo del rechazo",
    });
    expect(
      await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "REJECT", reason: "Tarjeta no coincide", ip: null })
    ).toEqual({ ok: true });
    expect((await prisma.professionalProfile.findUniqueOrThrow({ where: { id: profile.id } })).rejectionReason).toBe("Tarjeta no coincide");
  });

  it("suspender deja el rol pero quita el estado aprobado", async () => {
    const admin = await createAdmin();
    const pro = await createProfessional();
    const profile = await profileOf(pro.id);
    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "SUSPEND", ip: null })).toEqual({ ok: true });
    expect((await profileOf(pro.id)).status).toBe("SUSPENDED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pro.id } })).roles).toContain("PROFESSIONAL");
  });

  it("reactivar un suspendido lo vuelve a aprobar sin duplicar el rol", async () => {
    const admin = await createAdmin();
    const pro = await createProfessional({ status: "SUSPENDED" });
    const profile = await profileOf(pro.id);
    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "APPROVE", ip: null })).toEqual({ ok: true });
    expect((await profileOf(pro.id)).status).toBe("APPROVED");
    const roles = (await prisma.user.findUniqueOrThrow({ where: { id: pro.id } })).roles;
    expect(roles.filter((r) => r === "PROFESSIONAL")).toHaveLength(1);
  });

  it("no aplica una acción al estado equivocado", async () => {
    const admin = await createAdmin();
    const pro = await createProfessional();
    const profile = await profileOf(pro.id);
    expect(await reviewProfessional({ actor: adminActor(admin.id), profileId: profile.id, decision: "APPROVE", ip: null })).toEqual({
      ok: false,
      error: "Esta acción no aplica al estado actual",
    });
    expect(await prisma.auditLog.count({ where: { entityId: profile.id } })).toBe(0);
  });

  it("un profesional no puede revisar", async () => {
    const pro = await createProfessional();
    const pending = await profileOf((await createProfessional({ status: "PENDING" })).id);
    const actor: Actor = { userId: pro.id, roles: ["PROFESSIONAL"], activeArea: "PROFESSIONAL", professionalStatus: "APPROVED" };
    expect(await reviewProfessional({ actor, profileId: pending.id, decision: "APPROVE", ip: null })).toEqual({ ok: false, error: "No autorizado" });
    expect((await prisma.professionalProfile.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("PENDING");
  });

  it("un admin no puede aprobar ni suspender su propio perfil", async () => {
    const adminPro = await createProfessional({ status: "PENDING", extraRoles: ["ADMIN"] });
    const own = await profileOf(adminPro.id);
    const actor = adminActor(adminPro.id);
    const msg = { ok: false, error: "No puedes revisar tu propio perfil" };
    expect(await reviewProfessional({ actor, profileId: own.id, decision: "APPROVE", ip: null })).toEqual(msg);

    await prisma.professionalProfile.update({ where: { id: own.id }, data: { status: "APPROVED" } });
    expect(await reviewProfessional({ actor, profileId: own.id, decision: "SUSPEND", ip: null })).toEqual(msg);
    expect((await profileOf(adminPro.id)).status).toBe("APPROVED");
  });
});

describe("listProfessionalsForReview", () => {
  it("marca la tarjeta repetida entre perfiles (sin distinguir formato)", async () => {
    const a = await createProfessional({ status: "PENDING" });
    const b = await createProfessional({ status: "PENDING" });
    const c = await createProfessional({ status: "PENDING" });
    const unique = `TP-${Date.now()}`;
    await prisma.professionalProfile.update({ where: { userId: a.id }, data: { licenseNumber: `${unique}-77` } });
    await prisma.professionalProfile.update({ where: { userId: b.id }, data: { licenseNumber: ` ${unique.toLowerCase()} 77 ` } });

    const list = await listProfessionalsForReview();
    const pa = await profileOf(a.id);
    const pb = await profileOf(b.id);
    const pc = await profileOf(c.id);
    expect(list.find((p) => p.profileId === pa.id)?.licenseShared).toBe(true);
    expect(list.find((p) => p.profileId === pb.id)?.licenseShared).toBe(true);
    expect(list.find((p) => p.profileId === pc.id)?.licenseShared).toBe(false);
  });

  it("también cuenta coincidencias con perfiles rechazados", async () => {
    const a = await createProfessional({ status: "PENDING" });
    const b = await createProfessional({ status: "REJECTED" });
    const lic = `DUP-${Date.now()}`;
    await prisma.professionalProfile.update({ where: { userId: a.id }, data: { licenseNumber: lic } });
    await prisma.professionalProfile.update({ where: { userId: b.id }, data: { licenseNumber: lic } });
    const list = await listProfessionalsForReview();
    const pa = await profileOf(a.id);
    expect(list.find((p) => p.profileId === pa.id)?.licenseShared).toBe(true);
  });

  it("marca como propio el perfil del admin que consulta", async () => {
    const adminPro = await createProfessional({ extraRoles: ["ADMIN"] });
    const other = await createProfessional();
    const list = await listProfessionalsForReview(adminPro.id);
    const own = await profileOf(adminPro.id);
    const foreign = await profileOf(other.id);
    expect(list.find((p) => p.profileId === own.id)?.isOwn).toBe(true);
    expect(list.find((p) => p.profileId === foreign.id)?.isOwn).toBe(false);
  });
});
