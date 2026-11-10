/**
 * Title identity checks for artwork and metadata matching.
 *
 * Method adapted from Taiga Launcher for Steam (Apache-2.0, github.com/GabrielTaiga/Taiga-Launcher-for-Steam),
 * lib/title-match.mjs: normalisation, Roman numerals, sequel/remake/edition conflicts and a confident-choice
 * rule that refuses to guess when two candidates are almost equally good. Re-implemented here for Re:Port.
 */
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15 };
const STOP = new Set(["the", "a", "an", "of", "and", "de", "do", "da", "e", "la", "le", "el", "der", "die", "das"]);
const EDITION = { remake: "remake", reimagined: "remake", remaster: "remaster", remastered: "remaster", hd: "remaster", definitive: "definitive", ultimate: "ultimate", deluxe: "deluxe", goty: "goty", anniversary: "anniversary", collection: "collection", trilogy: "collection", bundle: "collection" };

export function normalizeTitle(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[™®©]/g, "").replace(/['`´’]/g, "").replace(/&/g, " and ").replace(/\+/g, " plus ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
const romanToArabic = (text) => (" " + text + " ").replace(/ (x[iv]{0,3}|i[xv]|v?i{0,3}) /g, (m, r) => (r && ROMAN[r] ? " " + ROMAN[r] + " " : m)).trim();
export const titleTokens = (value) => romanToArabic(normalizeTitle(value)).split(" ").filter((t) => t && !STOP.has(t));
export const compact = (value) => romanToArabic(normalizeTitle(value)).replace(/\s+/g, "");

export function sequelNumber(value) {
  const text = " " + romanToArabic(normalizeTitle(value)) + " ";
  const explicit = text.match(/ (?:part|chapter|episode|vol|volume) (\d+) /);
  if (explicit) return Number(explicit[1]);
  for (const m of text.matchAll(/ (\d{1,2}) /g)) { const n = Number(m[1]); if (n >= 2 && n <= 25) return n; }
  return null;
}
export function editionOf(value) {
  for (const w of normalizeTitle(value).split(" ")) if (EDITION[w]) return EDITION[w];
  return null;
}
export function yearOf(value) { const m = String(value || "").match(/\b(19[7-9]\d|20[0-4]\d)\b/); return m ? Number(m[1]) : null; }

function dice(a, b) {
  const x = new Set(a), y = new Set(b);
  if (!x.size || !y.size) return 0;
  let common = 0; for (const t of x) if (y.has(t)) common++;
  return (2 * common) / (x.size + y.size);
}
function levenshteinRatio(a, b) {
  const x = compact(a), y = compact(b);
  if (!x || !y) return 0; if (x === y) return 1;
  if (Math.abs(x.length - y.length) > Math.max(x.length, y.length) * 0.5) return 0;
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= y.length; j++) { const tmp = prev[j]; prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1)); diag = tmp; }
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}
/** Similarity 0..1, tolerant of punctuation, articles and numerals. */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (normalizeTitle(a) === normalizeTitle(b)) return 1;
  if (compact(a) === compact(b)) return 0.99;
  return Math.max(dice(titleTokens(a), titleTokens(b)), levenshteinRatio(a, b) * 0.97);
}

/** Scores one candidate name against the query, penalising sequel, remake and year conflicts. */
export function scoreCandidate(query, candidate, { queryYear = null, candidateYear = null } = {}) {
  const sim = similarity(query, candidate);
  const sq = sequelNumber(query), sc = sequelNumber(candidate);
  const eq = editionOf(query), ec = editionOf(candidate);
  const yq = queryYear || yearOf(query), yc = candidateYear || yearOf(candidate);
  const exact = normalizeTitle(query) === normalizeTitle(candidate) || compact(query) === compact(candidate);
  let score = sim;
  if ((sq || 1) !== (sc || 1) && (sq !== null || sc !== null)) score -= 0.35;
  if ((eq === "remake") !== (ec === "remake") && (eq === "remake" || ec === "remake")) score -= 0.2;
  if (yq && yc) score -= Math.min(0.2, Math.abs(yq - yc) * 0.05);
  return { score: Math.max(0, Math.min(1, score)), exact, similarity: sim };
}

/** Accept the best candidate only when it is strong and clearly ahead of the runner-up. */
export function confidentChoice(scored, { min = 0.95, gap = 0.1 } = {}) {
  const list = [...scored].sort((a, b) => b.score - a.score);
  if (!list.length || list[0].score < min) return null;
  if (list[1] && list[0].score - list[1].score < gap && !list[0].exact) return null;
  return list[0];
}

/** The game name without a store edition suffix ("Doom: Definitive Edition" → "Doom"). */
export function editionBase(value) {
  return String(value || "").replace(/\s*[:\-–(]\s*(?:the\s+)?(?:\d+\s+years?\s+celebration|(?:goty|game of the year|definitive|deluxe|complete|ultimate|gold|premium|anniversary|collector'?s|director'?s cut|enhanced|legendary)(?:\s+edition)?|edition)\)?\s*$/i, "").trim() || String(value || "").trim();
}
