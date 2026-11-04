export function testDatabaseUrl(): string {
  const base = process.env.DIRECT_URL;
  if (!base) throw new Error("DIRECT_URL no está definido en .env");
  const url = new URL(base);
  url.searchParams.set("schema", "test");
  url.searchParams.set("connection_limit", "5");
  return url.toString();
}
