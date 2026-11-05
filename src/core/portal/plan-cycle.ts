export const PORTAL_TIME_ZONE = "America/Bogota";

const DAY_MS = 86_400_000;

export function localDateKey(date: Date, timeZone: string = PORTAL_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function keyToUtcMidnight(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcMidnight(toKey) - keyToUtcMidnight(fromKey)) / DAY_MS);
}

export function cycleDayIndex(input: { activatedAt: Date; date: Date; dayCount: number }): number | null {
  if (input.dayCount < 1) return null;
  const diff = daysBetweenKeys(localDateKey(input.activatedAt), localDateKey(input.date));
  if (diff < 0) return null;
  return diff % input.dayCount;
}

export function keyToNoonUtc(key: string): Date {
  return new Date(keyToUtcMidnight(key) + DAY_MS / 2);
}

export function weekDateKeys(date: Date, weekOffset = 0): string[] {
  const base = keyToUtcMidnight(localDateKey(date));
  const weekday = new Date(base).getUTCDay(); // 0 = domingo
  const monday = base - ((weekday + 6) % 7) * DAY_MS + weekOffset * 7 * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * DAY_MS).toISOString().slice(0, 10));
}
