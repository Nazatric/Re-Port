import catalog from "./catalog.json";

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
  price: string | null;
  metacritic: number | null;
  reviewCount: number | null;
  releaseDate: string;
  steamAppId: number | null;
  steamDeveloper: string | null;
  steamPublisher: string | null;
  updated: string;
  added: string;
  views: number;
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
export const games: Game[] = data.games;
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
  sort: SortMode;
}

export const emptyFilters: Filters = {
  query: "", genres: [], collections: [], platforms: [], kinds: [], engines: [],
  fileNeeds: [], evidence: [], decades: [], onlySaved: false, onlyApk: false, onlyRated: false, sort: "relevance",
};

export function activeFilterCount(f: Filters): number {
  return (f.query.trim() ? 1 : 0) + f.genres.length + f.collections.length + f.platforms.length +
    f.kinds.length + f.engines.length + f.fileNeeds.length + f.evidence.length + f.decades.length +
    (f.onlySaved ? 1 : 0) + (f.onlyApk ? 1 : 0);
}

export function applyFilters(f: Filters, saved: Set<string>): Game[] {
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
    out.push(g);
  }
  switch (f.sort) {
    case "name": out.sort((a, b) => a.title.localeCompare(b.title)); break;
    case "newest": out.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title)); break;
    case "oldest": out.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title)); break;
    case "popular": out.sort((a, b) => b.views - a.views); break;
    case "ports": out.sort((a, b) => b.ports.length - a.ports.length || b.views - a.views); break;
    case "rating": out.sort((a, b) => (b.metacritic ?? -1) - (a.metacritic ?? -1) || b.views - a.views); break;
    default: out.sort((a, b) => Number(b.ports.some((p) => p.apk)) - Number(a.ports.some((p) => p.apk)) || (b.metacritic ?? -1) - (a.metacritic ?? -1) || b.views - a.views);
  }
  return out;
}

/** Curated front page: popular games that have real covers and an APK release. */
const featuredIds = [
  "super-mario-64", "hollow-knight", "celeste", "diablo",
  "the-elder-scrolls-iii-morrowind", "the-legend-of-zelda-ocarina-of-time",
  "half-life", "sonic-mania",
];
export const featuredGames: Game[] = featuredIds.map(gameById).filter((g): g is Game => !!g && !!g.cover);
const isTool = (name: string) => /launcher|tool|manager|patcher|builder|art loader|frontend/i.test(name);
for (const g of games) {
  if (featuredGames.length >= 8) break;
  if (!g.cover || featuredGames.includes(g)) continue;
  if (g.ports.some((p) => p.apk && !isTool(p.name))) featuredGames.push(g);
}

export function primaryPort(g: Game): PortProject {
  const score = (p: PortProject) =>
    (p.apk ? 1000 : 0) + (p.evidence === "github-apk" ? 600 : 0) +
    (p.kind === "github" ? 300 : 0) + Math.min(p.downloads ?? 0, 200) +
    (p.stars ? Math.min(p.stars, 100) : 0) + (p.version ? 20 : 0) +
    (/android|apk|mobile/i.test(p.name) ? 150 : 0) +
    (/launcher|tool|manager|patcher|builder|art/i.test(p.name) ? -500 : 0);
  return [...g.ports].sort((a, b) => score(b) - score(a))[0] ?? g.ports[0];
}
export function primaryPortIndex(g: Game): number {
  const p = primaryPort(g);
  return Math.max(0, g.ports.indexOf(p));
}
