/**
 * Keyless cover matching through the Steam store (no API key needed).
 * A game is matched only when a Steam app has the same normalised title. If several apps share that title,
 * the release year must pick exactly one (within one year). Anything else is refused, so no unrelated art is used.
 */
import { normalizeTitle } from "./title-match.mjs";

const SEARCH = (term) => `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`;
const DETAILS = (id) => `https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`;

/** Steam's release_date.date is text such as "10 Dec, 1993" or "Oct 2016". */
export function steamYear(date) {
  const m = String(date || "").match(/\b(19[7-9]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Pick the one Steam app that is this catalog game.
 * @param title catalog title
 * @param year catalog year (0 or null when unknown)
 * @param items Steam store search results: [{ type, name, id }]
 * @param detailsById function(id) -> { type, releaseYear } for a candidate
 */
export async function pickSteamApp({ title, year }, items, detailsById) {
  const want = normalizeTitle(title);
  if (!want) return null;
  const exact = (items ?? []).filter((i) => i.type === "app" && normalizeTitle(i.name) === want);
  if (!exact.length) return null;
  const candidates = [];
  for (const item of exact) {
    const d = await detailsById(item.id);
    if (!d || d.type !== "game") continue;
    candidates.push({ id: item.id, releaseYear: d.releaseYear });
  }
  const q = Number(year) || null;
  if (q) {
    const inYear = candidates.filter((c) => c.releaseYear && Math.abs(c.releaseYear - q) <= 1);
    return inYear.length === 1 ? inYear[0].id : null;
  }
  // No catalog year: only a single unambiguous exact title is accepted.
  return candidates.length === 1 ? candidates[0].id : null;
}

/** Fetches the Steam search and the details for the candidates, then applies pickSteamApp. */
export async function matchSteamByTitle(game, fetchJson, tally = {}) {
  const bump = (k) => { tally[k] = (tally[k] ?? 0) + 1; };
  const search = await fetchJson(SEARCH(game.title));
  if (!search) bump("searchFailed");
  else if (!(search.items ?? []).length) bump("searchEmpty");
  else if (!(search.items ?? []).some((i) => i.type === "app" && normalizeTitle(i.name) === normalizeTitle(game.title))) bump("noExactTitle");
  const details = new Map();
  const detailsById = async (id) => {
    if (!details.has(id)) {
      const r = await fetchJson(DETAILS(id));
      const data = r?.[String(id)]?.data;
      details.set(id, data ? { type: data.type, releaseYear: steamYear(data.release_date?.date) } : null);
    }
    return details.get(id);
  };
  const id = await pickSteamApp({ title: game.title, year: game.year }, search?.items ?? [], detailsById);
  if (!id && search?.items?.length) bump("exactRejectedByYearOrAmbiguous");
  return id;
}

