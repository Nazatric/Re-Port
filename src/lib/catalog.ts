import { useSyncExternalStore } from 'react';
import raw from '../data/catalog.json';
import type { Catalog, Collection, Filters, Game, LinkKind, Platform, Port, SortKey, Status } from './types';

/**
 * The catalog is a live document: `setCatalog` swaps in a newer published copy without a page
 * reload. Every collection below is mutated in place so the named exports stay valid for the
 * modules that captured them at import time.
 */
export const catalog = { generated: '', revision: '', sources: [] as string[] } as unknown as Catalog;
export const games: Game[] = [];
export const gameById = new Map<string, Game>();
export const platformById = new Map<string, Platform>();
export const collections: (Collection & { count: number })[] = [];
export const collectionById = new Map(collections.map((c) => [c.id, c]));
export const platforms: Platform[] = [];

const OTHER: Collection = { id: 'other', name: 'Genre unknown', blurb: 'Games whose genre has not been established yet.' };

/* --------------------------------------------------------- search index */
interface Entry {
  g: Game;
  title: string;
  hay: string;
}
const index: Entry[] = [];

export const stats = { games: 0, engines: 0, ports: 0, platforms: 0 };
export const engines: Game[] = [];

let lastKey = '';
let lastResult: Game[] = games;

export function currentRevision(): string {
  return catalog.revision || '';
}

function revisionTime(revision?: string): number {
  if (!revision) return Number.NaN;
  const parsed = Date.parse(revision);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function portCount(value: Catalog): number {
  return value.games.reduce((sum, g) => sum + (g.ports?.length || 0), 0);
}

/**
 * Freshness is decided by build date, then by the monotonic revision, then by catalogue size.
 * The revision matters: two catalogues can be published on the same day, and the later one must
 * still win on an installed native app.
 */
export function isCatalogNewer(
  next: Catalog,
  current?: { generated?: string; revision?: string; games?: readonly unknown[] },
  currentPorts = stats.ports,
): boolean {
  if (!next?.games?.length) return false;
  const currentGenerated = current?.generated ?? catalog.generated;
  const currentGames = current?.games ?? games;
  if (!currentGenerated) return true;
  if (next.generated !== currentGenerated) return next.generated > currentGenerated;

  const nextRevision = next.revision || '';
  const currentRev = current?.revision ?? catalog.revision ?? '';
  if (nextRevision && nextRevision !== currentRev) {
    const nextTime = revisionTime(nextRevision);
    const currentTime = revisionTime(currentRev);
    if (!Number.isNaN(nextTime) && !Number.isNaN(currentTime)) return nextTime > currentTime;
    // A timestamped revision is newer than a legacy opaque one.
    if (!Number.isNaN(nextTime)) return true;
    if (!Number.isNaN(currentTime)) return false;
    return nextRevision > currentRev;
  }

  return next.games.length > currentGames.length || portCount(next) > currentPorts;
}

/**
 * Loads (or replaces) the working catalog. Returns true when the data was newer than what is
 * loaded, so callers can tell a real refresh from a redundant one.
 */
export function setCatalog(next: Catalog): boolean {
  if (!isCatalogNewer(next)) return false;

  catalog.generated = next.generated;
  catalog.revision = next.revision || '';
  catalog.sources = next.sources || [];
  catalog.stats = next.stats || {};
  catalog.collections = next.collections;
  catalog.platforms = next.platforms;

  games.length = 0;
  games.push(...next.games);
  gameById.clear();
  for (const g of games) gameById.set(g.id, g);
  platformById.clear();
  for (const p of next.platforms) platformById.set(p.id, p);

  const counts = new Map<string, number>();
  for (const g of games) {
    if (g.platform === 'engine') continue;
    for (const id of genresOf(g)) counts.set(id, (counts.get(id) || 0) + 1);
  }
  collections.length = 0;
  collections.push(...[...next.collections, ...(counts.get(OTHER.id) ? [OTHER] : [])].map((c) => ({ ...c, count: counts.get(c.id) || 0 })).filter((c) => c.count > 0));
  collectionById.clear();
  for (const c of collections) collectionById.set(c.id, c);

  platforms.length = 0;
  platforms.push(...[...next.platforms].sort((a, b) => b.count - a.count));

  engines.length = 0;
  engines.push(...games.filter((g) => g.platform === 'engine').sort((a, b) => (b.supports?.length || 0) - (a.supports?.length || 0)));

  // The home screen doesn't need the search index. Build it on first library/search use
  // instead of delaying the first screen on every cold start.
  index.length = 0;

  stats.games = games.filter((g) => g.platform !== 'engine').length;
  stats.engines = engines.length;
  stats.ports = games.reduce((s, g) => s + g.ports.length, 0);
  stats.platforms = platforms.filter((p) => p.id !== 'engine').length;

  lastKey = '';
  lastResult = games;
  listeners.forEach((l) => l());
  return true;
}

/* -------------------------------------------------------- change signal */
const listeners = new Set<() => void>();
const version = { n: 0 };
listeners.add(() => {
  version.n += 1;
});

/** Re-renders subscribers when a newer catalog is adopted at runtime. */
export function useCatalogVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version.n,
    () => 0,
  );
}

export function currentGenerated(): string {
  return catalog.generated || '';
}

/* ------------------------------------------------------------ text */
export function normalize(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* ---------------------------------------------------------- status */

export function genresOf(g: Game): string[] {
  return g.genres.length ? g.genres : [OTHER.id];
}

export function platformIdsOf(g: Game): string[] {
  return g.platforms?.length ? g.platforms : [g.platform];
}

export function portStatus(p: Port): Status {
  if (p.works === 'yes') return 'working';
  if (p.works === 'bug') return 'bugs';
  if (p.works === 'no') return 'broken';
  return 'untested';
}

export function gameStatus(g: Game): Status {
  const order: Status[] = ['working', 'bugs', 'untested', 'broken'];
  let best = 3;
  for (const p of g.ports) best = Math.min(best, order.indexOf(portStatus(p)));
  return order[best] ?? 'untested';
}

export const STATUS_META: Record<Status, { label: string; hint: string }> = {
  working: { label: 'Works', hint: 'Reported working by the community' },
  bugs: { label: 'Has bugs', hint: 'Playable, with reported issues' },
  untested: { label: 'Untested', hint: 'No compatibility report yet' },
  broken: { label: 'Not working', hint: 'Reported not working' },
};

/**
 * Port ranking, shared with scripts/build-data.mjs so the shipped order is the same as the live one.
 * 1. Source tier: GitHub releases first, first-party stores and sites next, then community
 *    channels, and mirrors / Reddit / Telegram last.
 * 2. Within a tier: most GitHub stars, then most downloads, then list views, then freshest update.
 * Paused, discontinued and reported-broken ports drop one tier.
 */
const KIND_TIER: Record<LinkKind, number> = {
  github: 0,
  playstore: 1,
  fdroid: 1,
  itch: 1,
  gitlab: 1,
  site: 1,
  gamejolt: 1,
  gamebanana: 1,
  archive: 1,
  web: 1,
  discord: 2,
  '4pda': 3,
  telegram: 4,
  reddit: 4,
  mirror: 5,
};

export function portTier(p: Port): number {
  let tier = KIND_TIER[p.kind] ?? 2;
  if (p.lifecycle === 'paused' || p.lifecycle === 'discontinued') tier += 1;
  if (p.works === 'no') tier += 1;
  return Math.min(tier, 6);
}

export function comparePorts(a: Port, b: Port): number {
  return (
    portTier(a) - portTier(b) ||
    (b.stars || 0) - (a.stars || 0) ||
    (b.downloads || 0) - (a.downloads || 0) ||
    (b.views || 0) - (a.views || 0) ||
    (b.updated || '').localeCompare(a.updated || '')
  );
}

export function rankedPorts(g: Game): Port[] {
  return [...g.ports].sort(comparePorts);
}

export function bestPort(g: Game): Port {
  return rankedPorts(g)[0];
}

export function portName(p: Port): string {
  return p.name || 'Unofficial port';
}

/* ----------------------------------------------------------- links */
export const LINK_META: Record<LinkKind, { label: string; sub: string; warning?: string }> = {
  github: { label: 'GitHub', sub: 'Latest release on GitHub' },
  telegram: { label: 'Telegram', sub: 'Opens a Telegram channel post' },
  discord: { label: 'Discord', sub: 'Opens the developer Discord server' },
  playstore: { label: 'Google Play', sub: 'Opens the Google Play listing' },
  '4pda': { label: '4pda', sub: 'Opens a 4pda forum thread', warning: 'A free 4pda account is required to download.' },
  itch: { label: 'itch.io', sub: 'Opens the itch.io page' },
  reddit: { label: 'Reddit', sub: 'Opens the Reddit post' },
  gitlab: { label: 'GitLab', sub: 'Opens the GitLab project' },
  fdroid: { label: 'F-Droid', sub: 'Opens the F-Droid listing' },
  gamejolt: { label: 'Game Jolt', sub: 'Opens the Game Jolt page' },
  archive: { label: 'Archive', sub: 'Opens an archive page' },
  gamebanana: { label: 'GameBanana', sub: 'Opens the GameBanana page' },
  site: { label: 'Developer site', sub: 'Opens the official project page' },
  mirror: { label: 'Mirror', sub: 'Opens a third-party mirror', warning: 'Third-party mirror. Verify the file before installing it.' },
  web: { label: 'Website', sub: 'Opens the project page' },
};

export function linkMeta(p: Port) {
  const base = LINK_META[p.kind] || LINK_META.web;
  const warnings: string[] = [];
  if (base.warning) warnings.push(base.warning);
  if (p.mirror && p.kind !== 'mirror') warnings.push('Hosted on a mirror because the original link is unavailable.');
  if (p.paid) warnings.push('This is a paid listing.');
  if (p.lifecycle === 'paused') warnings.push('This project is currently on hiatus.');
  if (p.lifecycle === 'discontinued') warnings.push('This project is marked discontinued.');
  return { ...base, warnings };
}

export function githubRepo(p: Port): { owner: string; repo: string } | null {
  if (p.kind !== 'github') return null;
  try {
    const parts = new URL(p.url).pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? { owner: parts[0], repo: parts[1] } : null;
  } catch {
    return null;
  }
}

export function ownerOf(p: Port): string {
  try {
    const u = new URL(p.url);
    if (u.host === 'github.com') return u.pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    /* ignore */
  }
  return '';
}

const SOURCE_GROUPS: Record<string, LinkKind[]> = {
  github: ['github'],
  telegram: ['telegram'],
  discord: ['discord'],
  playstore: ['playstore'],
  '4pda': ['4pda'],
  site: ['site'],
  mirror: ['mirror'],
  other: ['itch', 'reddit', 'gitlab', 'fdroid', 'gamejolt', 'archive', 'gamebanana', 'web'],
};
const LIST_GROUPS: Record<string, string[]> = {
  napl: ['NAPL', 'NAPL + research', ''],
  'android-native-ports': ['Awesome Android Native Ports'],
  openports: ['OpenPortsGames'],
  decomp: ['Awesome Decomp Games'],
  'ports-master': ['Android Ports Master'],
  porthub: ['PortHub Catalog'],
  'porting-room': ['Porting Room'],
  'droid-recomp': ['DroidRecomp'],
  curated: ['Community research (GitHub)', 'research', 'manual', 'Reddit research', 'Project research', 'PortCove candidate research'],
};
export const LIST_OPTIONS = [
  { id: 'napl', label: 'NAPL community sheet' },
  { id: 'android-native-ports', label: 'Awesome Android Native Ports' },
  { id: 'openports', label: 'OpenPortsGames' },
  { id: 'decomp', label: 'Awesome Decomp Games' },
  { id: 'ports-master', label: 'Android Ports Master' },
  { id: 'porthub', label: 'PortHub Catalog' },
  { id: 'porting-room', label: 'Porting Room' },
  { id: 'droid-recomp', label: 'DroidRecomp' },
  { id: 'curated', label: 'Curated and researched' },
];

export const SOURCE_OPTIONS = [
  { id: 'github', label: 'GitHub' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
  { id: 'playstore', label: 'Google Play' },
  { id: '4pda', label: '4pda' },
  { id: 'site', label: 'Developer site' },
  { id: 'mirror', label: 'Mirror' },
  { id: 'other', label: 'Other' },
];

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'popular', label: 'Most popular' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'added', label: 'Newly added' },
  { id: 'title', label: 'Title A to Z' },
  { id: 'year', label: 'Release year' },
];

const platformName = (id: string) => platformById.get(id)?.name ?? id;

export const DEFAULT_FILTERS: Filters = { q: '', genre: '', platform: '', list: '', source: '', works: '', files: '', controller: '', sort: 'popular' };

export function filtersFromParams(p: URLSearchParams): Filters {
  const sort = p.get('sort') as SortKey | null;
  const source = p.get('source') || '';
  // Older app links stored both list and release-site choices in source.
  const legacyList = Object.prototype.hasOwnProperty.call(LIST_GROUPS, source) ? source : '';
  return {
    q: (p.get('q') || '').slice(0, 80),
    genre: p.get('genre') || '',
    platform: p.get('platform') || '',
    list: p.get('list') || legacyList,
    source: legacyList ? '' : source,
    works: p.get('works') === 'yes' ? 'yes' : '',
    files: p.get('files') === 'none' ? 'none' : '',
    controller: p.get('controller') === 'yes' ? 'yes' : '',
    sort: SORT_OPTIONS.some((o) => o.id === sort) ? (sort as SortKey) : 'popular',
  };
}

export function filtersToParams(f: Filters): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).forEach((k) => {
    if (f[k] && f[k] !== DEFAULT_FILTERS[k]) out[k] = String(f[k]);
  });
  return out;
}

export function activeFilterCount(f: Filters): number {
  return (['genre', 'platform', 'list', 'source', 'works', 'files', 'controller'] as const).filter((k) => f[k]).length;
}

const hasController = (p: Port) => p.controller === 'both' || p.controller === 'controller';

export function matches(g: Game, f: Filters): boolean {
  if (f.genre && (g.platform === 'engine' || !genresOf(g).includes(f.genre))) return false;
  if (f.platform && !platformIdsOf(g).includes(f.platform)) return false;
  const kinds = f.source ? SOURCE_GROUPS[f.source] : null;
  const lists = f.list ? LIST_GROUPS[f.list] : null;
  if ((f.source && !kinds) || (f.list && !lists)) return false;
  // Port attributes must be true of the same port, not different ports on one card.
  return g.ports.some((p) => {
    if (kinds && !kinds.includes(p.kind)) return false;
    if (lists && !lists.includes(p.source || '')) return false;
    if (f.works === 'yes' && p.works !== 'yes') return false;
    if (f.files === 'none' && p.files !== 'none') return false;
    if (f.controller === 'yes' && !hasController(p)) return false;
    return true;
  });
}

export function queryGames(f: Filters): Game[] {
  const key = JSON.stringify(f);
  if (key === lastKey) return lastResult;
  const q = normalize(f.q);
  const tokens = q ? q.split(' ') : [];
  // Only text searches need the normalized index. Browsing and filtering can work
  // directly on the catalog, so opening the Library also remains responsive.
  if (tokens.length && index.length !== games.length) {
    index.length = 0;
    for (const g of games) {
      index.push({
        g,
        title: normalize(g.title),
        hay: normalize(
          [g.title, platformIdsOf(g).map(platformName).join(' '), g.genres.map((x) => collectionById.get(x)?.name ?? x).join(' '), g.ports.map((p) => `${p.name || ''} ${p.developer || ''}`).join(' '), g.year || ''].join(' '),
        ),
      });
    }
  }
  const entries: Iterable<Entry> = tokens.length ? index : games.map((g) => ({ g, title: '', hay: '' }));
  let list: { g: Game; score: number }[] = [];
  for (const e of entries) {
    if (!matches(e.g, f)) continue;
    if (tokens.length && !tokens.every((t) => e.hay.includes(t))) continue;
    let score = 0;
    if (tokens.length) {
      if (e.title === q) score = 0;
      else if (e.title.startsWith(q)) score = 1;
      else if (e.title.includes(q)) score = 2;
      else if (tokens.every((t) => e.title.includes(t))) score = 3;
      else score = 4;
    }
    list.push({ g: e.g, score });
  }
  const by = (a: Game, b: Game): number => {
    switch (f.sort) {
      case 'updated':
        return (b.updated || '').localeCompare(a.updated || '') || b.views - a.views;
      case 'added':
        return (b.added || '').localeCompare(a.added || '') || (b.updated || '').localeCompare(a.updated || '');
      case 'title':
        return a.title.localeCompare(b.title);
      case 'year':
        return (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title);
      default:
        return gamePopularity(b) - gamePopularity(a) || a.title.localeCompare(b.title);
    }
  };
  list = list.sort((a, b) => (tokens.length && f.sort === 'popular' ? a.score - b.score || by(a.g, b.g) : by(a.g, b.g)));
  lastKey = key;
  lastResult = list.map((x) => x.g);
  return lastResult;
}

/* ------------------------------------------------------ home lists */
const hasArt = (g: Game) => Boolean(g.cover || g.steam);
const realGames = () => games.filter((g) => g.platform !== 'engine');

/** How popular a title is, from real download counts and stars, with list views as a fallback. */
export function gamePopularity(g: Game): number {
  return g.views + g.ports.reduce((sum, p) => sum + (p.downloads || 0) / 10 + (p.stars || 0) / 5, 0);
}

/** A fresh random pick from the most popular titles with artwork, so every visit shows a different set. */
export function randomFeatured(n = 12, rnd: () => number = Math.random): Game[] {
  const pool = realGames()
    .filter((g) => hasArt(g) && gameStatus(g) !== 'broken')
    .sort((a, b) => gamePopularity(b) - gamePopularity(a))
    .slice(0, 80);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export function featured(n = 12): Game[] {
  return realGames()
    .filter((g) => hasArt(g) && gameStatus(g) !== 'broken')
    .sort((a, b) => gamePopularity(b) - gamePopularity(a))
    .slice(0, n);
}

export function recentlyUpdated(n = 14): Game[] {
  return realGames()
    .filter((g) => hasArt(g) && g.updated)
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || '') || b.views - a.views)
    .slice(0, n);
}

export function newArrivals(n = 14): Game[] {
  return realGames()
    .filter((g) => hasArt(g) && g.added)
    .sort((a, b) => (b.added || '').localeCompare(a.added || '') || b.views - a.views)
    .slice(0, n);
}

export function readyToPlay(n = 14): Game[] {
  return realGames()
    .filter((g) => hasArt(g) && g.ports.some((p) => p.works === 'yes' && (p.controller === 'both' || p.controller === 'touch')))
    .sort((a, b) => b.views - a.views)
    .slice(0, n);
}

export function popular(n = 10): Game[] {
  return [...realGames()].sort((a, b) => gamePopularity(b) - gamePopularity(a)).slice(0, n);
}

export function related(g: Game, n = 12): Game[] {
  const dev = new Set(g.ports.map((p) => (p.developer || '').toLowerCase()).filter(Boolean));
  const eng = new Set(g.ports.map((p) => p.engine).filter(Boolean));
  const scored: { x: Game; s: number }[] = [];
  for (const x of games) {
    if (x.id === g.id || x.platform === 'engine' || !hasArt(x)) continue;
    let s = 0;
    for (const id of x.genres) if (g.genres.includes(id)) s += 2;
    if (platformIdsOf(x).some((id) => platformIdsOf(g).includes(id))) s += 1;
    if (x.ports.some((p) => dev.has((p.developer || '').toLowerCase()))) s += 2;
    if (x.ports.some((p) => p.engine && eng.has(p.engine))) s += 3;
    if (s >= 3) scored.push({ x, s });
  }
  return scored.sort((a, b) => b.s - a.s || b.x.views - a.x.views).slice(0, n).map((e) => e.x);
}

export function engineOf(g: Game): Game | undefined {
  const id = g.ports.find((p) => p.engine)?.engine;
  return id ? gameById.get(id) : undefined;
}

export function filesLabel(p: Port): string {
  switch (p.files) {
    case 'none':
      return 'No game files needed';
    case 'rom':
      return 'Needs your own ROM';
    case 'files':
      return 'Needs your own game files';
    case 'app':
      return 'Downloads data in the app';
    default:
      return 'Game files unknown';
  }
}

export function controllerLabel(p: Port): string {
  switch (p.controller) {
    case 'both':
      return 'Touch and controller';
    case 'controller':
      return 'Controller only';
    case 'touch':
      return 'Touch only';
    default:
      return 'Controls not listed';
  }
}

export function gameControllerLabel(g: Game): string {
  const p = bestPort(g);
  return controllerLabel(p);
}

/* ------------------------------------------------------------ bootstrap */
setCatalog(raw as unknown as Catalog);
