/**
 * Nombres de alimentos de la TCAC: corrige errores de OCR verificados contra la imagen (2026-11-05)
 * y unifica tildes que el OCR perdió de forma intermitente.
 */

/** Frases partidas o truncadas por el OCR. */
const PHRASE_FIXES: [RegExp, string][] = [
  [/\bG[ae] letas\b/g, "Galletas"],
  [/\bhojue as\b/g, "hojuelas"],
  [/\bTi apia\b/g, "Tilapia"],
  [/\bsin sa$/g, "sin sal"],
  [/^caco\b/g, "Icaco"],
];

/** Palabras mal leídas → palabra correcta (sólo casos comprobados en la imagen o inequívocos). */
const WORD_FIXES: Record<string, string> = {
  orudo: "crudo",
  oruda: "cruda",
  oruala: "cruda",
  cruas: "cruda",
  homeaao: "horneado",
  deshioratado: "deshidratado",
  alanco: "blanco",
  alando: "blando",
  carezan: "corazón",
  tenera: "ternera",
  Almajabana: "Almojábana",
  Remalacha: "Remolacha",
  Hariña: "Harina",
  Ajonjoll: "Ajonjolí",
  Asal: "Asaí",
  Duotù: "Ductú",
  Name: "Ñame",
  Maracuya: "Maracuyá",
  Sandia: "Sandía",
  Brocoli: "Brócoli",
  Nispero: "Níspero",
  almibar: "almíbar",
  holandes: "holandés",
};

export function fixName(name: string): string {
  let fixed = name.trim();
  for (const [pattern, replacement] of PHRASE_FIXES) fixed = fixed.replace(pattern, replacement);
  return fixed.replace(/[\p{L}®]+/gu, (word) => WORD_FIXES[word] ?? word);
}

const stripAccents = (text: string) => text.normalize("NFD").replace(/(?!\u0303)\p{M}/gu, "").normalize("NFC");
const accentCount = (word: string) => word.normalize("NFD").replace(/[^\p{M}]/gu, "").length;

/** Si la misma palabra aparece con y sin tilde en la fuente, usa en todas partes la forma con más tildes. */
export function unifyAccents(names: string[]): string[] {
  const best = new Map<string, string>();
  for (const name of names) {
    for (const word of name.match(/\p{L}+/gu) ?? []) {
      const key = stripAccents(word).toLowerCase();
      const current = best.get(key);
      if (!current || accentCount(word) > accentCount(current)) best.set(key, word.toLowerCase());
    }
  }
  return names.map((name) =>
    name.replace(/\p{L}+/gu, (word) => {
      const target = best.get(stripAccents(word).toLowerCase());
      if (!target || accentCount(target) <= accentCount(word)) return word;
      return word[0] === word[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target;
    })
  );
}

/** Forma de búsqueda: minúsculas, sin tildes (la ñ se conserva) y espacios colapsados. */
export function normalizeSearch(text: string): string {
  return stripAccents(text.toLowerCase()).replace(/\s+/g, " ").trim();
}

/** Palabras de una búsqueda: todas deben aparecer en el nombre, en cualquier orden. */
export function searchTokens(query: string): string[] {
  return normalizeSearch(query).split(/[^a-z0-9ñ]+/).filter(Boolean).slice(0, 6);
}

/** Primero los nombres que empiezan por la búsqueda, luego los que tienen una palabra que empieza por ella, luego alfabético. */
export function rankByQuery<T extends { searchName: string }>(items: T[], query: string): T[] {
  const tokens = searchTokens(query);
  const first = tokens[0] ?? "";
  const rank = (name: string) => (name.startsWith(first) ? 0 : new RegExp(`(^|[^a-z0-9ñ])${first}`).test(name) ? 1 : 2);
  return [...items].sort((a, b) => rank(a.searchName) - rank(b.searchName) || a.searchName.localeCompare(b.searchName, "es"));
}
