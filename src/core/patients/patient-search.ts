export interface SearchablePatient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  documentId: string | null;
  phone: string | null;
}

const MIN_DIGITS = 3;
const MIN_SUBSTRING = 3;
const MIN_FUZZY = 4;

const SCORE = { exactWord: 4, prefix: 3, digits: 3, substring: 2, fuzzy: 1 } as const;

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");

interface Indexed {
  words: string[];
  fullName: string;
  email: string;
  digits: string[];
}

function index(patient: SearchablePatient): Indexed {
  const fullName = normalizeSearchText(`${patient.firstName} ${patient.lastName}`);
  return {
    words: fullName.split(/\s+/).filter(Boolean),
    fullName,
    email: normalizeSearchText(patient.email ?? ""),
    digits: [patient.documentId, patient.phone].map((v) => onlyDigits(v ?? "")).filter(Boolean),
  };
}

/** Optimal string alignment distance: Levenshtein plus adjacent transpositions. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

function strictScore(token: string, p: Indexed): number {
  const tokenDigits = onlyDigits(token);
  const isNumeric = !/\p{L}/u.test(token);
  if (isNumeric) {
    return tokenDigits.length >= MIN_DIGITS && p.digits.some((d) => d.includes(tokenDigits)) ? SCORE.digits : 0;
  }
  if (p.words.includes(token)) return SCORE.exactWord;
  if (p.words.some((w) => w.startsWith(token)) || p.email.startsWith(token)) return SCORE.prefix;
  if (token.length >= MIN_SUBSTRING && (p.fullName.includes(token) || p.email.includes(token))) return SCORE.substring;
  return 0;
}

function fuzzyScore(token: string, p: Indexed): number {
  const strict = strictScore(token, p);
  if (strict > 0) return strict;
  if (token.length < MIN_FUZZY || !/\p{L}/u.test(token)) return 0;
  const allowed = token.length >= 8 ? 2 : 1;
  const close = p.words.some(
    (w) => editDistance(token, w) <= allowed || editDistance(token, w.slice(0, token.length)) <= allowed
  );
  return close ? SCORE.fuzzy : 0;
}

function rankWith<T extends SearchablePatient>(
  entries: { patient: T; indexed: Indexed; order: number }[],
  tokens: string[],
  scoreToken: (token: string, p: Indexed) => number
): T[] {
  const scored: { patient: T; score: number; order: number }[] = [];
  for (const entry of entries) {
    let total = 0;
    for (const token of tokens) {
      const score = scoreToken(token, entry.indexed);
      if (score === 0) {
        total = 0;
        break;
      }
      total += score;
    }
    if (total > 0) scored.push({ patient: entry.patient, score: total, order: entry.order });
  }
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.patient);
}

/**
 * Accent/case-insensitive multi-word search over name, email, document and phone.
 * Every word must match some field. Typo tolerance applies only when nothing matches exactly,
 * so a precise query never gets diluted with approximate results.
 */
export function rankPatients<T extends SearchablePatient>(patients: readonly T[], query: string): T[] {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...patients];
  const entries = patients.map((patient, order) => ({ patient, indexed: index(patient), order }));
  const strict = rankWith(entries, tokens, strictScore);
  return strict.length > 0 ? strict : rankWith(entries, tokens, fuzzyScore);
}
