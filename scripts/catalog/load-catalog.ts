/**
 * Carga data/catalog/tcac-2018.csv (enriquecido con gaba-matches.csv) en la base de .env. Idempotente.
 *
 * Uso: unset DATABASE_URL DIRECT_URL && pnpm tsx scripts/catalog/load-catalog.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogEntry, parseTcacCsv } from "../../src/core/catalog/catalog-entry";
import { confirmedMatches } from "../../src/core/catalog/enrich";

process.loadEnvFile(join(__dirname, "..", "..", ".env"));

async function main() {
  const { loadCatalog } = await import("../../src/features/catalog/load");
  const { prisma } = await import("../../src/infrastructure/database/prisma");
  const catalog = join(__dirname, "..", "..", "data", "catalog");
  const matches = confirmedMatches(readFileSync(join(catalog, "gaba-matches.csv"), "utf8"));
  const entries = parseTcacCsv(readFileSync(join(catalog, "tcac-2018.csv"), "utf8")).map((row) => catalogEntry(row, matches));
  const started = Date.now();
  const result = await loadCatalog(entries, prisma);
  console.log(`${entries.length} alimentos TCAC · ${result.created} nuevos · ${result.updated} actualizados · ${result.manualIndexed} manuales indexados · ${Math.round((Date.now() - started) / 1000)} s`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
