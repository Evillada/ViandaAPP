import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditEntry } from "@/core/audit/audit";
import { prisma } from "@/infrastructure/database/prisma";

export type AuditDb = Prisma.TransactionClient | PrismaClient;

export async function recordAudit(entry: AuditEntry, db: AuditDb = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      patientId: entry.patientId ?? null,
      metadata: entry.metadata ? (entry.metadata as Prisma.InputJsonValue) : undefined,
      ip: entry.ip ?? null,
    },
  });
}

export async function recordAuditBestEffort(entry: AuditEntry): Promise<void> {
  try {
    await recordAudit(entry);
  } catch (error) {
    console.error(`[audit] no se pudo registrar ${entry.action}`, error);
  }
}
