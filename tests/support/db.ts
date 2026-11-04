import { prisma } from "@/infrastructure/database/prisma";

export async function resetDatabase(): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'test'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"test"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

export { prisma };
