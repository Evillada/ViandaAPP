const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Bogotá es UTC-5 todo el año (sin horario de verano). Devuelve null si no es un "YYYY-MM-DD" real. */
function parseDateKey(value: string): { y: number; m: number; d: number } | null {
  if (!DATE_KEY.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(check.getTime()) || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** "YYYY-MM-DD" → primer instante de ese día en Bogotá (05:00 UTC). */
export function startOfDayBogota(value: string): Date | null {
  const parts = parseDateKey(value);
  return parts ? new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 5, 0, 0, 0)) : null;
}

/** "YYYY-MM-DD" → último milisegundo de ese día en Bogotá (04:59:59.999 UTC del día siguiente). */
export function endOfDayBogota(value: string): Date | null {
  const parts = parseDateKey(value);
  return parts ? new Date(Date.UTC(parts.y, parts.m - 1, parts.d + 1, 4, 59, 59, 999)) : null;
}
