import type { Game } from "@/data/ports";
import { swrJson } from "./cache";

/** Keyless artwork waterfall. Only used when a bundled cover URL fails to load.
 *  Order: Libretro console art -> Steam Store public search -> Wikipedia REST ->
 *  Steam (year-checked) -> Wikipedia exact article. Unfiltered image searches were removed (unrelated and NSFW results). Every result is cached with SWR. */

interface SteamSearch { items?: { type: string; name: string; id: number; tiny_image?: string }[] }
interface SteamDetail { [key: string]: { data?: { header_image?: string; release_date?: { date?: string } } } }
interface WikiSummary { thumbnail?: { source: string }; originalimage?: { source: string } }

const clean = (s: string) => s.split(/[:+,]/)[0].replace(/\([^)]*\)/g, "").trim();
const enc = encodeURIComponent;

const providers: ((title: string, year: number) => Promise<string | null>)[] = [
  async (t, year) => {
    const d = await swrJson<SteamSearch>(`steam:search:${t}`, `https://store.steampowered.com/api/storesearch/?term=${enc(t)}&l=english&cc=us`);
    const hit = (d.items ?? []).find((i) => i.type === "app" && i.name.toLowerCase() === t.toLowerCase()) ??
      (d.items ?? []).find((i) => i.type === "app");
    if (!hit) return null;
    const detail = await swrJson<SteamDetail>(`steam:app:${hit.id}`, `https://store.steampowered.com/api/appdetails?appids=${hit.id}&l=english&cc=us`);
    const data = detail[String(hit.id)]?.data;
    // Reject a same-named game from another year (e.g. Doom 2016 for Doom 1993).
    const steamYear = Number((data?.release_date?.date ?? "").match(/\b(19|20)\d{2}\b/)?.[0]);
    if (year && steamYear && Math.abs(steamYear - year) > 1) return null;
    return data?.header_image ?? hit.tiny_image ?? null;
  },
  async (t) => {
    const d = await swrJson<WikiSummary>(`wiki:${t}`, `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(t.replace(/ /g, "_"))}`);
    return d.thumbnail?.source ?? d.originalimage?.source ?? null;
  },
];

const fallbackCache = new Map<string, string | null>();

/** Resolve a replacement URL for a broken artwork; returns null after all sources fail. */
export async function resolveArtwork(game: Game): Promise<string | null> {
  if (fallbackCache.has(game.id)) return fallbackCache.get(game.id) ?? null;
  const title = clean(game.title);
  for (const provider of providers) {
    try {
      const url = await provider(title, game.year);
      if (url) {
        fallbackCache.set(game.id, url);
        return url;
      }
    } catch { /* try the next keyless source */ }
  }
  fallbackCache.set(game.id, null);
  return null;
}
