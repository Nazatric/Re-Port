import type { Game } from "@/data/ports";
import { readCache, writeCache, swrJson } from "./cache";

/** Keyless artwork resolver, used when a game has no bundled cover or only a generated placeholder.
 *
 *  Every candidate must pass a strict identity check before it is shown:
 *   - Libretro box art (console games): exact No-Intro style file name for the platform,
 *     and the image must actually load.
 *   - Steam Store (PC games): the store name must equal the catalog title after normalising
 *     case, accents and punctuation, and the release year must agree with the catalog year
 *     when both are known (so the 2016 "DOOM" never stands in for the 1993 game).
 *   - Wikipedia: the page must describe itself as a video game and its title must match.
 *
 *  Random search engines (Wikimedia Commons free-text search, Openverse) are deliberately not
 *  used: they return unrelated photos for game titles. Results are cached: hits for 30 days,
 *  misses for 3 days, so a game is not looked up again on every visit. */

interface SteamSearch { items?: { type: string; name: string; id: number; tiny_image?: string }[] }
interface SteamDetail { [key: string]: { success?: boolean; data?: { header_image?: string; release_date?: { date?: string } } } }
interface WikiSummary { title?: string; description?: string; type?: string; thumbnail?: { source: string }; originalimage?: { source: string } }

/** Lower-case, accent-free, letters and digits only. "Pokémon Shield!" → "pokemonshield". */
export function normalizeTitle(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

/** Title without a trailing parenthesised qualifier, e.g. "Doom (2016)" → "Doom". */
export function baseTitle(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function yearFromText(text?: string): number {
  const m = text?.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
}

/** True when both years are known and differ by more than one year. Unknown years never reject. */
export function yearsConflict(catalogYear: number, sourceYear: number): boolean {
  return catalogYear > 0 && sourceYear > 0 && Math.abs(catalogYear - sourceYear) > 1;
}

/** Steam match: exact normalised name and compatible release year. */
export function isSteamMatch(game: { title: string; year: number }, steamName: string, steamYear: number): boolean {
  if (normalizeTitle(steamName) !== normalizeTitle(game.title)) return false;
  return !yearsConflict(game.year, steamYear);
}

/** Wikipedia summaries are accepted only for video-game articles whose title matches the game. */
export function isWikiVideoGame(game: { title: string }, summary: WikiSummary): boolean {
  if (summary.type === "disambiguation") return false;
  if (!/video game/i.test(summary.description ?? "")) return false;
  return normalizeTitle(baseTitle(summary.title ?? "")) === normalizeTitle(baseTitle(game.title));
}

/** Catalog platform → Libretro thumbnail system folder (console libraries only). */
export const LIBRETRO_SYSTEMS: Record<string, string> = {
  "PlayStation": "Sony_-_PlayStation",
  "PlayStation 2": "Sony_-_PlayStation_2",
  "PSP": "Sony_-_PlayStation_Portable",
  "Xbox": "Microsoft_-_Xbox",
  "Xbox 360": "Microsoft_-_Xbox_360",
  "Nintendo 64": "Nintendo_-_Nintendo_64",
  "GameCube": "Nintendo_-_GameCube",
  "Wii": "Nintendo_-_Wii",
  "Wii U": "Nintendo_-_Wii_U",
  "Nintendo DS": "Nintendo_-_Nintendo_DS",
  "Nintendo 3DS": "Nintendo_-_Nintendo_3DS",
  "Game Boy": "Nintendo_-_Game_Boy",
  "Game Boy Color": "Nintendo_-_Game_Boy_Color",
  "Game Boy Advance": "Nintendo_-_Game_Boy_Advance",
  "NES": "Nintendo_-_Nintendo_Entertainment_System",
  "SNES": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "Super Nintendo": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "Sega Saturn": "Sega_-_Saturn",
  "Dreamcast": "Sega_-_Dreamcast",
  "Sega Genesis": "Sega_-_Mega_Drive",
};

/** Libretro file names replace characters that are invalid on Windows with "_". */
export function libretroBaseName(title: string): string {
  return title.replace(/[&*/:`<>?\\|"]/g, "_");
}

/** Candidate box-art URLs for a console game, most common region first. */
export function libretroCandidates(platform: string, title: string): string[] {
  const system = LIBRETRO_SYSTEMS[platform];
  if (!system) return [];
  const base = libretroBaseName(title);
  const names = [`${base} (USA).png`, `${base} (Europe).png`, `${base} (World).png`, `${base} (Japan).png`, `${base}.png`];
  return names.map((n) => `https://thumbnails.libretro.com/${system}/Named_Boxarts/${encodeURIComponent(n)}`);
}

/** Resolves true only if the image actually loads (browser only). */
export function probeImage(url: string, timeoutMs = 6000): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok: boolean) => { window.clearTimeout(timer); img.onload = img.onerror = null; resolve(ok); };
    const timer = window.setTimeout(() => done(false), timeoutMs);
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    img.src = url;
  });
}

async function fromLibretro(game: Game): Promise<string | null> {
  for (const url of libretroCandidates(game.platform, game.title)) {
    if (await probeImage(url)) return url;
  }
  return null;
}

async function fromSteam(game: Game): Promise<string | null> {
  const search = await swrJson<SteamSearch>(`steam:search:${game.title}`, `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.title)}&l=english&cc=us`);
  const matches = (search.items ?? []).filter((i) => i.type === "app" && normalizeTitle(i.name) === normalizeTitle(game.title));
  for (const hit of matches.slice(0, 3)) {
    const detail = await swrJson<SteamDetail>(`steam:app:${hit.id}`, `https://store.steampowered.com/api/appdetails?appids=${hit.id}&l=english&cc=us`);
    const data = detail[String(hit.id)]?.data;
    if (!data?.header_image) continue;
    if (isSteamMatch(game, hit.name, yearFromText(data.release_date?.date))) return data.header_image;
  }
  return null;
}

async function fromWikipedia(game: Game): Promise<string | null> {
  const base = baseTitle(game.title);
  // Year-qualified article first (e.g. "Doom (1993 video game)"), so reboots never shadow the original.
  const titles = [
    ...(game.year ? [`${base} (${game.year} video game)`] : []),
    `${base} (video game)`,
    base,
  ];
  for (const t of titles) {
    const summary = await swrJson<WikiSummary>(`wiki:v2:${t}`, `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`);
    if (!isWikiVideoGame(game, summary)) continue;
    const url = summary.thumbnail?.source ?? summary.originalimage?.source ?? null;
    if (url && await probeImage(url)) return url;
  }
  return null;
}

const providers: ((game: Game) => Promise<string | null>)[] = [fromLibretro, fromSteam, fromWikipedia];
const ART_KEY = (id: string) => `art:v2:${id}`;
const inflight = new Map<string, Promise<string | null>>();

async function resolveUncached(game: Game): Promise<string | null> {
  for (const provider of providers) {
    try {
      const url = await provider(game);
      if (url) return url;
    } catch { /* offline or blocked: try the next source */ }
  }
  return null;
}

/** Resolve a verified replacement cover for a game; returns null when no source matches confidently. */
export function resolveArtwork(game: Game): Promise<string | null> {
  const cached = readCache<string | null>(ART_KEY(game.id));
  if (cached && !cached.stale) return Promise.resolve(cached.value);
  const pending = inflight.get(game.id);
  if (pending) return pending;
  const job = resolveUncached(game).then((url) => {
    writeCache(ART_KEY(game.id), url, url ? 30 * 24 * 3600 * 1000 : 3 * 24 * 3600 * 1000);
    return url;
  }).finally(() => inflight.delete(game.id));
  inflight.set(game.id, job);
  return job;
}
