import type { Game } from "@/data/ports";
import { swrJson } from "./cache";

/** Keyless artwork fallback, used only when a game has no real cover or its cover fails to load.
 *  Steam CDN covers are fetched by AppID first; the title search matches an exact name with a
 *  compatible release year. Wikipedia and unfiltered image searches are not used, because they
 *  returned unrelated images. Results are cached with SWR. All of it is real, free game art. */

interface SteamSearch { items?: { type: string; name: string; id: number; tiny_image?: string }[] }
interface SteamDetail { [key: string]: { success?: boolean; data?: { type?: string; header_image?: string; release_date?: { date?: string } } } }

const clean = (s: string) => s.split(/[:+,]/)[0].replace(/\([^)]*\)/g, "").trim();
const enc = encodeURIComponent;
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Steam CDN portrait covers by AppID. No key needed; the catalog often carries a Steam AppID,
 *  so these work for games whose title match fails, and they are real game art from the source. */
const steamCdnProvider = async (game: Game): Promise<string | null> => {
  if (!game.steamAppId) return null;
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.steamAppId}/`;
  for (const file of ["library_600x900_2x.jpg", "library_600x900.jpg"]) {
    const url = `${base}${file}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return url;
    } catch { /* try the next file */ }
  }
  return null;
};

const steamTitleProvider = async (game: Game): Promise<string | null> => {
  const t = clean(game.title);
  const year = game.year;
  const d = await swrJson<SteamSearch>(`steam:search:${t}`, `https://store.steampowered.com/api/storesearch/?term=${enc(t)}&l=english&cc=us`);
  const exact = (d.items ?? []).filter((i) => i.type === "app" && key(i.name) === key(t));
  for (const hit of exact) {
    const detail = await swrJson<SteamDetail>(`steam:app:${hit.id}`, `https://store.steampowered.com/api/appdetails?appids=${hit.id}&l=english&cc=us`);
    const data = detail[String(hit.id)]?.data;
    if (!data || data.type !== "game") continue;
    // A same-named game from another year is not this game (e.g. Doom 2016 for Doom 1993).
    const steamYear = Number((data.release_date?.date ?? "").match(/\b(19|20)\d{2}\b/)?.[0]);
    if (year && steamYear && Math.abs(steamYear - year) > 1) continue;
    return data.header_image ?? hit.tiny_image ?? null;
  }
  return null;
};

const providers: ((game: Game) => Promise<string | null>)[] = [steamCdnProvider, steamTitleProvider];

const fallbackCache = new Map<string, string | null>();

/** Resolve a replacement URL for a broken artwork; returns null after all sources fail. */
export async function resolveArtwork(game: Game): Promise<string | null> {
  if (fallbackCache.has(game.id)) return fallbackCache.get(game.id) ?? null;
  for (const provider of providers) {
    try {
      const url = await provider(game);
      if (url) {
        fallbackCache.set(game.id, url);
        return url;
      }
    } catch { /* try the next keyless source */ }
  }
  fallbackCache.set(game.id, null);
  return null;
}
