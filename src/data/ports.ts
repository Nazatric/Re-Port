import catalog from "./catalog.json";
import enrichment from "./enrichment.json";

export interface PortProject {
  name: string;
  developer: string;
  kind: string;
  url: string;
  download: string;
  version: string;
  updated: string;
  apk: boolean;
  files: string;
  filesNote: string;
  engine: string;
  controller: string;
  evidence: string;
  stars: number;
  downloads: number;
  /** Shown first regardless of download counts (for example, a maintained port replacing a discontinued one). */
  pinned?: boolean;
}

export interface Game {
  id: string;
  title: string;
  year: number;
  platform: string;
  genres: string[];
  collections: string[];
  summary: string;
  description: string;
  cover: string;
  coverRatio: number;
  shots: string[];
  /** Wide hero image (SteamGridDB or Steam), when one was bundled. */
  hero?: string;
  /** Images from the port developer's GitHub README, when the build found any. */
  readmeShots?: string[];
  metacritic: number | null;
  reviewCount: number | null;
  releaseDate: string;
  steamAppId: number | null;
  steamDeveloper: string | null;
  steamPublisher: string | null;
  updated: string;
  added: string;
  ports: PortProject[];
}

export interface Catalog {
  generated: string;
  upstream: string;
  revision: string;
  sources: string[];
  collections: { id: string; name: string; blurb: string }[];
  games: Game[];
}

export const data = catalog as unknown as Catalog;
interface Enrichment {
  games: Record<string, { cover?: string; coverSource?: string; hero?: string; shots?: string[]; readmeShots?: string[]; description?: string; developer?: string; year?: number }>;
}

/** Merge the build-time bundle (verified matches only) into each catalog game. */
function withEnrichment(g: Game): Game {
  const e = (enrichment as Enrichment).games?.[g.id];
  if (!e) return g;
  const shots = [...new Set([...(e.shots ?? []), ...(e.readmeShots ?? []), ...g.shots])].slice(0, 8);
  return {
    ...g,
    cover: e.cover || g.cover,
    hero: e.hero || g.hero,
    description: e.description || g.description,
    steamDeveloper: g.steamDeveloper || e.developer || null,
    year: g.year || e.year || g.year,
    shots,
  };
}

export const games: Game[] = data.games.map(withEnrichment);
export const gameById = (id: string): Game | undefined => games.find((g) => g.id === id);
export const collections = data.collections;
export const catalogSources: string[] = data.sources;

export const kindLabels: Record<string, string> = {
  github: "GitHub", telegram: "Telegram", site: "Project site", playstore: "Play Store",
  "4pda": "4PDA", discord: "Discord", mirror: "Mirror", itch: "itch.io", reddit: "Reddit",
  web: "Website", gamejolt: "Game Jolt", archive: "Internet Archive", fdroid: "F-Droid",
  gitlab: "GitLab", gamebanana: "GameBanana",
};
export const fileLabels: Record<string, string> = {
  files: "Bring PC game files", rom: "Bring a disc / ROM", none: "Ready to play",
  app: "Complete app", unknown: "See project instructions",
};
export const evidenceLabels: Record<string, string> = {
  "github-apk": "APK release verified", "github-readme": "Android build documented",
  "napl-list": "Listed in NAPL",
};

export const allGenres = Array.from(new Set(games.flatMap((g) => g.genres))).sort();
export const allPlatforms = Array.from(new Set(games.map((g) => g.platform))).sort();
export const allKinds = Array.from(new Set(games.flatMap((g) => g.ports.map((p) => p.kind)))).sort();
export const allEngines = Array.from(new Set(games.flatMap((g) => g.ports.map((p) => p.engine)).filter(Boolean))).sort();
export const allFileNeeds = Array.from(new Set(games.flatMap((g) => g.ports.map((p) => p.files)))).sort();
export const allDecades = [1980, 1990, 2000, 2010, 2020];
export const allEvidence = Array.from(new Set(games.flatMap((g) => g.ports.map((p) => p.evidence)).filter(Boolean))).sort();

/** Precomputed lowercase haystack — search never walks the raw catalog twice. */
let searchIndex: Map<string, string> | null = null;
function getSearchIndex(): Map<string, string> {
  if (!searchIndex) {
    searchIndex = new Map(games.map((g) => [g.id,
      [g.title, g.platform, g.year, ...g.genres, ...g.ports.map((p) => `${p.name} ${p.developer} ${p.engine} ${p.url}`)]
        .join(" ").toLowerCase(),
    ]));
  }
  return searchIndex;
}

export type SortMode = "relevance" | "name" | "newest" | "oldest" | "popular" | "ports" | "rating";

export interface Filters {
  query: string;
  genres: string[];
  collections: string[];
  platforms: string[];
  kinds: string[];
  engines: string[];
  fileNeeds: string[];
  evidence: string[];
  decades: number[];
  onlySaved: boolean;
  onlyApk: boolean;
  onlyRated: boolean;
  onlyViewed: boolean;
  sort: SortMode;
}

export const emptyFilters: Filters = {
  query: "", genres: [], collections: [], platforms: [], kinds: [], engines: [],
  fileNeeds: [], evidence: [], decades: [], onlySaved: false, onlyApk: false, onlyRated: false, onlyViewed: false, sort: "relevance",
};

export function activeFilterCount(f: Filters): number {
  return (f.query.trim() ? 1 : 0) + f.genres.length + f.collections.length + f.platforms.length +
    f.kinds.length + f.engines.length + f.fileNeeds.length + f.evidence.length + f.decades.length +
    (f.onlySaved ? 1 : 0) + (f.onlyApk ? 1 : 0) + (f.onlyRated ? 1 : 0) + (f.onlyViewed ? 1 : 0);
}

export function applyFilters(f: Filters, saved: Set<string>, localViews: Record<string, number> = {}): Game[] {
  const q = f.query.trim().toLowerCase();
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];
  const index = terms.length ? getSearchIndex() : null;
  const out: Game[] = [];
  for (const g of games) {
    if (terms.length) {
      const hay = index?.get(g.id) ?? "";
      if (!terms.every((t) => hay.includes(t))) continue;
    }
    if (f.genres.length && !f.genres.some((x) => g.genres.includes(x))) continue;
    if (f.collections.length && !f.collections.some((x) => g.collections.includes(x))) continue;
    if (f.platforms.length && !f.platforms.includes(g.platform)) continue;
    if (f.kinds.length && !g.ports.some((p) => f.kinds.includes(p.kind))) continue;
    if (f.engines.length && !g.ports.some((p) => p.engine && f.engines.includes(p.engine))) continue;
    if (f.fileNeeds.length && !g.ports.some((p) => f.fileNeeds.includes(p.files))) continue;
    if (f.evidence.length && !g.ports.some((p) => f.evidence.includes(p.evidence))) continue;
    if (f.decades.length && !f.decades.some((d) => g.year >= d && g.year < d + 10)) continue;
    if (f.onlySaved && !saved.has(g.id)) continue;
    if (f.onlyApk && !g.ports.some((p) => p.apk)) continue;
    if (f.onlyRated && g.metacritic == null) continue;
    if (f.onlyViewed && !localViews[g.id]) continue;
    out.push(g);
  }
  switch (f.sort) {
    case "name": out.sort((a, b) => a.title.localeCompare(b.title)); break;
    case "newest": out.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title)); break;
    case "oldest": out.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title)); break;
    case "popular": out.sort((a, b) => (localViews[b.id] || 0) - (localViews[a.id] || 0) || a.title.localeCompare(b.title)); break;
    case "ports": out.sort((a, b) => b.ports.length - a.ports.length || a.title.localeCompare(b.title)); break;
    case "rating": out.sort((a, b) => (b.metacritic ?? -1) - (a.metacritic ?? -1) || a.title.localeCompare(b.title)); break;
    default: out.sort((a, b) => Number(b.ports.some((p) => p.apk)) - Number(a.ports.some((p) => p.apk)) || (b.metacritic ?? -1) - (a.metacritic ?? -1) || a.title.localeCompare(b.title));
  }
  return out;
}

/** Curated front page: popular games that have real covers and an APK release. */
const featuredIds = [
  "super-mario-64", "hollow-knight", "celeste", "diablo",
  "the-elder-scrolls-iii-morrowind", "the-legend-of-zelda-ocarina-of-time",
  "half-life", "sonic-mania",
];
/** Curated picks used when the hourly rotation has no pool (kept for safety). */
export const featuredGames: Game[] = featuredIds.map(gameById).filter((g): g is Game => !!g && !!g.cover);

const HOUR_MS = 60 * 60 * 1000;
/** Cover-flow pool: every game with real artwork that has at least one native Android port. */
const featuredPool: Game[] = games.filter((g) => !!g.cover && g.ports.some((p) => p.apk));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random featured set that is stable within one hour and changes automatically each hour. */
export function featuredForHour(hourIndex: number, count = 8): Game[] {
  const pool = featuredPool.length >= count ? featuredPool : featuredGames;
  const rand = mulberry32(hourIndex * 2654435761 + 12345);
  const picked: Game[] = [];
  const used = new Set<number>();
  while (picked.length < Math.min(count, pool.length)) {
    const i = Math.floor(rand() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    picked.push(pool[i]);
  }
  return picked;
}
export const currentHourIndex = () => Math.floor(Date.now() / HOUR_MS);

/** Highest known catalog download count first; unknown counts use a quality-based fallback. */
export function rankedPortIndices(g: Game): number[] {
  // Pinned ports come first; then download counts and quality.
  const fallbackScore = (p: PortProject) =>
    (p.apk ? 1000 : 0) + (p.evidence === "github-apk" ? 600 : 0) +
    (p.kind === "github" ? 300 : 0) + Math.min(p.stars || 0, 100) +
    (p.version ? 20 : 0) + (/android|apk|mobile/i.test(p.name) ? 150 : 0) -
    (/launcher|tool|manager|patcher|builder|art/i.test(p.name) ? 500 : 0);
  return g.ports.map((_, i) => i).sort((a, b) =>
    Number(!!g.ports[b].pinned) - Number(!!g.ports[a].pinned) ||
    Math.max(0, g.ports[b].downloads || 0) - Math.max(0, g.ports[a].downloads || 0) ||
    fallbackScore(g.ports[b]) - fallbackScore(g.ports[a]) || a - b);
}
export function primaryPort(g: Game): PortProject {
  return g.ports[rankedPortIndices(g)[0]] ?? g.ports[0];
}
export function primaryPortIndex(g: Game): number {
  return rankedPortIndices(g)[0] ?? 0;
}
