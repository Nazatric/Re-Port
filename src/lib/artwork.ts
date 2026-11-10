import type { Game } from "@/data/ports";
import { readCache, writeCache } from "./cache";
import { scoreCandidate, confidentChoice, editionBase, yearOf } from "./title-match";

/** On-device artwork and details lookup for games the bundled set doesn't cover.
 *  Keyless sources only: Steam store API and CDN, libretro-thumbnails, Wikipedia (video-game pages only).
 *  Method adapted from Taiga Launcher for Steam (Apache-2.0). Every match must pass the title and year check. */

export interface Found {
  cover?: string[];        // ordered candidates; the first that loads is used
  hero?: string;
  description?: string;
  developer?: string;
  genres?: string[];
  shots?: string[];
  year?: number;
  steamAppId?: number;
  source: string;
}

const DAY = 24 * 3600 * 1000;
const LIBRETRO: Record<string, string> = {
  "PlayStation": "Sony_-_PlayStation", "PlayStation 2": "Sony_-_PlayStation_2", "PSP": "Sony_-_PlayStation_Portable",
  "Xbox": "Microsoft_-_Xbox", "Xbox 360": "Microsoft_-_Xbox_360", "Nintendo 64": "Nintendo_-_Nintendo_64",
  "GameCube": "Nintendo_-_GameCube", "Wii": "Nintendo_-_Wii", "Wii U": "Nintendo_-_Wii_U",
  "Nintendo DS": "Nintendo_-_Nintendo_DS", "Nintendo 3DS": "Nintendo_-_Nintendo_3DS", "Game Boy": "Nintendo_-_Game_Boy",
  "Game Boy Color": "Nintendo_-_Game_Boy_Color", "Game Boy Advance": "Nintendo_-_Game_Boy_Advance",
  "NES": "Nintendo_-_Nintendo_Entertainment_System", "SNES": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "Super Nintendo": "Nintendo_-_Super_Nintendo_Entertainment_System", "Sega Saturn": "Sega_-_Saturn",
  "Dreamcast": "Sega_-_Dreamcast", "Sega Genesis": "Sega_-_Mega_Drive",
};
const REGIONS = ["(USA)", "(World)", "(Europe)", "(Japan)"];

/** Serial queue per host so a list of visible games never floods a store API. */
const lanes = new Map<string, Promise<unknown>>();
const GAP_MS: Record<string, number> = { "store.steampowered.com": 1500, "en.wikipedia.org": 150, "thumbnails.libretro.com": 150 };
function paced<T>(url: string, job: () => Promise<T>): Promise<T> {
  const host = new URL(url).host;
  const prev = lanes.get(host) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(async () => {
    await new Promise((r) => setTimeout(r, GAP_MS[host] ?? 150));
    return job();
  });
  lanes.set(host, run);
  return run;
}
async function getJson<T>(url: string): Promise<T | null> {
  return paced(url, async () => {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch { return null; }
  });
}
async function getText(url: string): Promise<string | null> {
  return paced(url, async () => {
    try { const res = await fetch(url); return res.ok ? await res.text() : null; } catch { return null; }
  });
}

interface SteamSearch { items?: { type: string; name: string; id: number }[] }
interface SteamDetail { [id: string]: { success?: boolean; data?: { name?: string; short_description?: string; developers?: string[]; genres?: { description: string }[]; screenshots?: { path_thumbnail: string }[]; release_date?: { date?: string } } } }

async function steamFor(game: Game): Promise<Found | null> {
  let id = game.steamAppId ?? null;
  if (!id && !LIBRETRO[game.platform]) {
    const q = encodeURIComponent(editionBase(game.title));
    const s = await getJson<SteamSearch>(`https://store.steampowered.com/api/storesearch/?term=${q}&l=english&cc=us`);
    const scored = (s?.items ?? []).filter((i) => i.type === "app").map((i) => ({ id: i.id, ...scoreCandidate(game.title, i.name, { queryYear: game.year }) }));
    id = confidentChoice(scored)?.id ?? null;
  }
  if (!id) return null;
  const d = await getJson<SteamDetail>(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`);
  const data = d?.[String(id)]?.success ? d[String(id)].data : null;
  if (!data) return null;
  const year = yearOf(data.release_date?.date);
  if (scoreCandidate(game.title, data.name ?? "", { queryYear: game.year, candidateYear: year }).score < 0.95) return null;
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/`;
  return {
    cover: [base + "library_600x900_2x.jpg", base + "library_600x900.jpg", base + "header.jpg"],
    hero: base + "library_hero.jpg",
    description: data.short_description?.trim() || undefined,
    developer: data.developers?.[0],
    genres: data.genres?.map((g) => g.description),
    shots: data.screenshots?.slice(0, 6).map((s) => s.path_thumbnail),
    year: year ?? undefined,
    steamAppId: id,
    source: "steam",
  };
}

/** libretro box art by scored title match against the platform's real file list (cached 14 days). */
async function libretroFor(game: Game): Promise<Found | null> {
  const system = LIBRETRO[game.platform];
  if (!system) return null;
  const key = "lr-list:" + system;
  let names = readCache<string[]>(key)?.value ?? null;
  if (!names) {
    const html = await getText(`https://thumbnails.libretro.com/${encodeURIComponent(system)}/Named_Boxarts/`);
    if (!html) return null;
    names = [...html.matchAll(/href="([^"]+\.png)"/g)].map((m) => decodeURIComponent(m[1]));
    writeCache(key, names, 14 * DAY);
  }
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const base = name.replace(/\.png$/, "").replace(/\s*\([^)]*\)/g, "").trim();
    groups.set(base, [...(groups.get(base) ?? []), name]);
  }
  const pick = confidentChoice([...groups.keys()].map((base) => ({ base, ...scoreCandidate(game.title, base, { queryYear: game.year }) })));
  if (!pick) return null;
  const files = groups.get(pick.base)!;
  const name = REGIONS.map((r) => files.find((f) => f.includes(r))).find(Boolean) ?? files[0];
  const u = (folder: string) => `https://thumbnails.libretro.com/${encodeURIComponent(system)}/${folder}/${encodeURIComponent(name)}`;
  return { cover: [u("Named_Boxarts")], hero: u("Named_Titles"), shots: [u("Named_Snaps")], source: "libretro" };
}

/** Wikipedia lead image and text, only for pages that describe a video game with the same title. */
async function wikipediaFor(game: Game): Promise<Found | null> {
  const base = editionBase(game.title);
  const year = game.year;
  for (const t of [game.title, year ? `${base} (${year} video game)` : "", `${base} (video game)`].filter(Boolean)) {
    const s = await getJson<{ type?: string; title?: string; description?: string; extract?: string; thumbnail?: { source: string } }>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`);
    if (!s || s.type === "disambiguation" || !/video game/i.test(s.description ?? "")) continue;
    if (scoreCandidate(base, (s.title ?? "").replace(/\s*\(.*\)$/, "")).score < 0.95) continue;
    return {
      cover: s.thumbnail?.source ? [s.thumbnail.source] : undefined,
      description: s.extract ? s.extract.split(/(?<=\.)\s/).slice(0, 2).join(" ") : undefined,
      year: yearOf(s.description) ?? undefined,
      source: "wikipedia",
    };
  }
  return null;
}

const inflight = new Map<string, Promise<Found | null>>();
const cacheKey = (g: Game) => `art:v3:${g.id}`;

/** Finds artwork and details for one game. Hits are cached 30 days, misses 3 days. */
export function findArtwork(game: Game): Promise<Found | null> {
  const cached = readCache<Found | null>(cacheKey(game));
  if (cached && !cached.stale) return Promise.resolve(cached.value);
  const pending = inflight.get(game.id);
  if (pending) return pending;
  const job = (async () => {
    const found = (await steamFor(game).catch(() => null))
      ?? (await libretroFor(game).catch(() => null))
      ?? (await wikipediaFor(game).catch(() => null));
    writeCache(cacheKey(game), found, found ? 30 * DAY : 3 * DAY);
    return found;
  })().finally(() => inflight.delete(game.id));
  inflight.set(game.id, job);
  return job;
}
