import { useSyncExternalStore } from 'react';
import type { Catalog, Collection, Game, Platform } from './types';
import { currentGenerated, currentRevision, games as loadedGames, isCatalogNewer, setCatalog } from './catalog';
import { APP_BUILD_ID, REMOTE_CATALOG_URL } from './buildInfo';

/**
 * Live catalog updates.
 *
 * The catalog bundled with the app is only a baseline. A scheduled job republishes
 * public/catalog.json from the upstream lists, and this module adopts that newer copy at runtime,
 * so new games and refreshed release data reach an installed app without shipping a new version.
 * The adopted copy is kept in Cache Storage, which also makes it available offline.
 *
 * Freshness is based on the catalog revision, not only its calendar date: two publications on
 * the same day must not be mistaken for the same catalog.
 */

const CACHE = 'portdeck-remote-v2';
const META_KEY = 'portdeck.catalog.remote.v1';
const OVERRIDE_KEY = 'portdeck.catalog.url';
const DEFAULT_TTL = 6 * 60 * 60 * 1000;

export interface CatalogMeta {
  generated?: string;
  revision?: string;
  fetchedAt?: string;
  url?: string;
  auto: boolean;
  appBuild?: string;
  lastError?: string;
}

export type UpdateResult =
  | { status: 'updated'; generated: string; added: number; total: number }
  | { status: 'current'; generated: string }
  | { status: 'unavailable' };

const listeners = new Set<() => void>();
let meta: CatalogMeta = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY) || '');
    return { auto: true, ...parsed };
  } catch {
    return { auto: true };
  }
})();

function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/* A status message that survives page remounts (a newer catalog re-keys the page). */
let statusText = '';
const statusListeners = new Set<() => void>();
export function setCatalogStatus(text: string) {
  statusText = text;
  statusListeners.forEach((l) => l());
}
export function useCatalogStatus(): string {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => statusText,
    () => '',
  );
}

export function useCatalogMeta(): CatalogMeta {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => meta,
    () => meta,
  );
}

export function setAutoUpdate(on: boolean) {
  meta = { ...meta, auto: on };
  saveMeta();
}

export function setRemoteUrl(url: string) {
  try {
    if (url) localStorage.setItem(OVERRIDE_KEY, url);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** A public GitHub raw URL can also be fetched through jsDelivr without an API key. */
export function catalogMirror(url: string): string | null {
  try {
    const source = new URL(url);
    const parts = source.pathname.split('/').filter(Boolean);
    if (source.protocol !== 'https:' || source.hostname !== 'raw.githubusercontent.com' || parts.length < 4 || source.search || source.hash) return null;
    const [owner, repo, ref, ...file] = parts;
    if (![owner, repo, ref].every((part) => /^[a-zA-Z0-9_.-]+$/.test(part))) return null;
    return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${file.join('/')}`;
  } catch { return null; }
}

/** Where a refreshed catalog can come from, most specific first. */
export function catalogUrls(): string[] {
  let override = '';
  try {
    override = localStorage.getItem(OVERRIDE_KEY) || '';
  } catch {
    /* ignore */
  }
  const env = REMOTE_CATALOG_URL || (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_REMOTE_CATALOG_URL || '';
  // Mirror only the configured public repository, never arbitrary user-supplied overrides.
  const list = [override, env, catalogMirror(env) || '', new URL('catalog.json', document.baseURI).href];
  return [...new Set(list.filter(Boolean))];
}

/** Validate everything consumed by the UI before a remote catalog can replace the bundled one. */
export function validateCatalog(value: unknown): Catalog | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Partial<Catalog>;
  if (c.androidPolicy !== 1 || !Array.isArray(c.games) || c.games.length < 50 || c.games.length > 20000) return null;
  if (!Array.isArray(c.platforms) || !c.platforms.length || !Array.isArray(c.collections) || !c.collections.length) return null;
  if (typeof c.generated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.generated) || !Number.isFinite(Date.parse(c.generated))) return null;
  const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
  const optionalStrings = (v: unknown) => v === undefined || strings(v);
  const optionalText = (v: unknown) => v === undefined || typeof v === 'string';
  const optionalNumber = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));
  const webUrl = (v: unknown) => {
    if (typeof v !== 'string') return false;
    try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
  };
  const optionalUrl = (v: unknown) => v === undefined || webUrl(v);
  const uniqueIds = (items: { id: string }[]) => new Set(items.map((x) => x.id)).size === items.length;
  if (!optionalText(c.revision) || !optionalStrings(c.sources)) return null;
  if (!c.platforms.every((p) => p && typeof p.id === 'string' && !!p.id && typeof p.name === 'string' && typeof p.short === 'string' && typeof p.count === 'number' && Number.isFinite(p.count)) || !uniqueIds(c.platforms)) return null;
  if (!c.collections.every((x) => x && typeof x.id === 'string' && !!x.id && typeof x.name === 'string' && typeof x.blurb === 'string') || !uniqueIds(c.collections)) return null;
  const evidence = new Set(['napl-list', 'github-apk', 'github-readme', 'openports-android', 'source-android']);
  const ok = c.games.every((g) => {
    if (!g || typeof g.id !== 'string' || !g.id || typeof g.title !== 'string' || !g.title || typeof g.platform !== 'string' ||
        !strings(g.genres) || !optionalStrings(g.platforms) || !optionalStrings(g.supports) || !optionalStrings(g.shots) ||
        typeof g.summary !== 'string' || typeof g.description !== 'string' || typeof g.views !== 'number' || !Number.isFinite(g.views) ||
        !optionalNumber(g.year) || !optionalText(g.updated) || !optionalText(g.added) || !optionalText(g.genreSource) ||
        !optionalText(g.shotNote) || !optionalUrl(g.cover) || !optionalUrl(g.coverFallback) || !optionalUrl(g.launchbox) ||
        (g.shots && !g.shots.every(webUrl))) return false;
    if (g.steam && (typeof g.steam.id !== 'number' || !Number.isFinite(g.steam.id) || !strings(g.steam.shots) || !g.steam.shots.every(webUrl) || !optionalText(g.steam.dev))) return false;
    return Array.isArray(g.ports) && g.ports.length > 0 && g.ports.every((p) => p && evidence.has(p.androidEvidence || '') &&
      typeof p.kind === 'string' && webUrl(p.url) && webUrl(p.download) && optionalStrings(p.platforms) &&
      [p.name, p.developer, p.platform, p.version, p.updated, p.added, p.files, p.filesNote, p.works, p.controller, p.notes, p.instructions, p.lifecycle, p.engine, p.source].every(optionalText) &&
      [p.views, p.downloads, p.stars].every(optionalNumber));
  });
  if (!ok || !uniqueIds(c.games)) return null;
  return c as Catalog;
}

function portsOf(value: Catalog): number {
  return value.games.reduce((sum, g) => sum + (g.ports?.length || 0), 0);
}

export async function readCachedCatalog(): Promise<Catalog | null> {
  try {
    const cache = await caches.open(CACHE);
    let best: Catalog | null = null;
    for (const url of catalogUrls()) {
      try {
        const hit = await cache.match(url);
        if (!hit) continue;
        const parsed = validateCatalog(await hit.json());
        if (parsed && (!best || isCatalogNewer(parsed, best, portsOf(best)))) best = parsed;
      } catch {
        // A corrupt cache entry must not hide a valid copy from another source.
        await cache.delete(url).catch(() => false);
      }
    }
    return best;
  } catch {
    return null; // Cache Storage is optional; the bundled catalog remains available.
  }
}

async function cacheResponse(url: string, res: Response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(url, res.clone());
  } catch {
    /* ignore */
  }
}

function countNew(next: Catalog): number {
  const currentIds = new Set(loadedGames.map((g) => g.id));
  return next.games.filter((g) => !currentIds.has(g.id)).length;
}

function loadedCatalog(): { generated?: string; revision?: string; games: readonly Game[] } {
  return { generated: currentGenerated(), revision: currentRevision(), games: loadedGames };
}

/** Adopts a validated catalog. Safe to call repeatedly; only genuinely newer data is applied. */
export function adopt(next: Catalog, url: string, from: 'network' | 'cache'): boolean {
  const payload = validateCatalog(next);
  if (!payload) return false;
  const applied = setCatalog(payload);
  if (!applied) return false;
  meta = {
    ...meta,
    generated: payload.generated,
    revision: payload.revision,
    url,
    // Restoring an old cache is not a successful network check.
    fetchedAt: from === 'network' ? new Date().toISOString() : meta.fetchedAt,
    appBuild: from === 'network' ? APP_BUILD_ID : meta.appBuild,
    lastError: undefined,
  };
  saveMeta();
  return true;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_CATALOG_BYTES = 12 * 1024 * 1024;

/** Retry a transient failure once, with a bounded deadline for headers and body. */
async function fetchCatalog(url: string): Promise<{ catalog: Catalog; response: Response } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = new URL(url, document.baseURI);
      request.searchParams.set('t', String(Date.now()));
      const task = (async () => {
        const res = await fetch(request.href, { cache: 'no-store', headers: { accept: 'application/json' }, signal: controller.signal });
        if (!res.ok) {
          if (res.status === 408 || res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
          return null;
        }
        const size = Number(res.headers.get('content-length'));
        if (size > MAX_CATALOG_BYTES) return null;
        const copy = res.clone();
        // Count actual bytes while streaming, even when Content-Length is missing or wrong.
        const reader = res.body?.getReader();
        if (!reader) return null;
        const decoder = new TextDecoder();
        let text = '';
        let received = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > MAX_CATALOG_BYTES) {
            controller.abort();
            void reader.cancel().catch(() => undefined);
            return null;
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        const catalog = validateCatalog(JSON.parse(text));
        return catalog ? { catalog, response: copy } : null;
      })();
      return await Promise.race([task, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Catalog request timed out')); }, FETCH_TIMEOUT_MS);
      })]);
    } catch {
      // Retry after cleanup, so no deadline timer survives into the backoff.
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
  }
  return null;
}

let inFlight: Promise<UpdateResult> | null = null;

/** Check all configured sources concurrently and adopt only the newest validated catalog. */
export function checkForCatalogUpdate(): Promise<UpdateResult> {
  if (inFlight) return inFlight;
  inFlight = checkSources().finally(() => { inFlight = null; });
  return inFlight;
}

async function checkSources(): Promise<UpdateResult> {
  const urls = catalogUrls();
  const local = new URL('catalog.json', document.baseURI).href;
  const results = await Promise.all(urls.map(async (url) => ({ url, result: await fetchCatalog(url) })));
  let best: { catalog: Catalog; url: string; response: Response } | null = null;
  for (const { url, result } of results) {
    if (result && (!best || isCatalogNewer(result.catalog, best.catalog, portsOf(best.catalog)))) best = { ...result, url };
  }
  if (best && isCatalogNewer(best.catalog, loadedCatalog())) {
    const added = countNew(best.catalog);
    const total = best.catalog.games.length;
    await cacheResponse(best.url, best.response);
    if (adopt(best.catalog, best.url, 'network')) return { status: 'updated', generated: best.catalog.generated, added, total };
  }
  // The bundled snapshot is a fallback, not evidence that a remote update check succeeded.
  const remoteConfigured = urls.some((url) => url !== local);
  const remoteReached = results.some(({ url, result }) => url !== local && result);
  if (best && (!remoteConfigured || remoteReached)) {
    meta = { ...meta, generated: currentGenerated(), revision: currentRevision(), fetchedAt: new Date().toISOString(), appBuild: APP_BUILD_ID, lastError: undefined };
    saveMeta();
    return { status: 'current', generated: currentGenerated() };
  }
  meta = { ...meta, lastError: 'Catalog sources could not be reached. The current library is still available.' };
  saveMeta();
  return { status: 'unavailable' };
}

/** Restores the last downloaded catalog before the network is touched, so it also works offline. */
export async function warmFromCache(): Promise<boolean> {
  const cached = await readCachedCatalog();
  if (!cached) return false;
  if (!isCatalogNewer(cached, loadedCatalog())) return false;
  return adopt(cached, meta.url || catalogUrls()[0], 'cache');
}

function lastAutoCheck(): number {
  return Date.parse(meta.fetchedAt || '') || 0;
}

/** Runs at most every six hours unless forced or the app build changed. */
export async function autoRefresh(force = false): Promise<UpdateResult | null> {
  if (!meta.auto && !force) return null;
  const buildChanged = meta.appBuild !== APP_BUILD_ID;
  if (!force && !buildChanged && Date.now() - lastAutoCheck() < DEFAULT_TTL) return null;
  const result = await checkForCatalogUpdate();
  meta = { ...meta, appBuild: APP_BUILD_ID };
  saveMeta();
  return result;
}

/* ------------------------------------------------------- shared types */
export type { Catalog, Collection, Game, Platform };
