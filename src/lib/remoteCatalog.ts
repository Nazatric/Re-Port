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
  | { status: 'unchanged-offline' }
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

/** Where a refreshed catalog can come from, most specific first. */
export function catalogUrls(): string[] {
  let override = '';
  try {
    override = localStorage.getItem(OVERRIDE_KEY) || '';
  } catch {
    /* ignore */
  }
  const env = REMOTE_CATALOG_URL || (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_REMOTE_CATALOG_URL || '';
  const list = [override, env, new URL('catalog.json', document.baseURI).href];
  return [...new Set(list.filter(Boolean))];
}

/** Minimal structural check so a truncated or hostile payload can never replace the catalog. */
export function validateCatalog(value: unknown): Catalog | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Partial<Catalog>;
  if (!Array.isArray(c.games) || c.games.length < 50) return null;
  if (!Array.isArray(c.platforms) || !c.platforms.length) return null;
  if (!Array.isArray(c.collections) || !c.collections.length) return null;
  if (typeof c.generated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.generated)) return null;
  const sample = c.games.slice(0, 25).every((g) => g && typeof g.id === 'string' && typeof g.title === 'string' && Array.isArray(g.ports));
  if (!sample) return null;
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
      const hit = await cache.match(url);
      if (!hit) continue;
      const parsed = validateCatalog(await hit.json());
      if (parsed && (!best || isCatalogNewer(parsed, best, portsOf(best)))) best = parsed;
    }
    return best;
  } catch {
    /* storage unavailable */
    return null;
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

let bundledIds: Set<string> | null = null;
export function rememberBundled(ids: string[]) {
  bundledIds = new Set(ids);
  void bundledIds;
}

let generatedGetter: () => string | undefined = () => undefined;
export function registerGenerated(getter: () => string | undefined) {
  generatedGetter = getter;
  void generatedGetter;
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
    fetchedAt: new Date().toISOString(),
    appBuild: APP_BUILD_ID,
    lastError: undefined,
  };
  saveMeta();
  void from;
  return true;
}

/**
 * Fetches every candidate URL and adopts the newest valid catalog. A stale local snapshot must
 * never short-circuit the check before a fresher published copy has been considered.
 */
export async function checkForCatalogUpdate(options: { silent?: boolean } = {}): Promise<UpdateResult> {
  let bestValid: Catalog | null = null;
  let bestNewer: { catalog: Catalog; url: string } | null = null;

  for (const url of catalogUrls()) {
    try {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store', headers: { accept: 'application/json' } });
      if (!res.ok) continue;
      const copy = res.clone();
      const parsed = validateCatalog(await res.json());
      if (!parsed) continue;
      if (!bestValid || isCatalogNewer(parsed, bestValid, portsOf(bestValid))) bestValid = parsed;
      if (isCatalogNewer(parsed, loadedCatalog())) {
        await cacheResponse(url, copy);
        if (!bestNewer || isCatalogNewer(parsed, bestNewer.catalog, portsOf(bestNewer.catalog))) {
          bestNewer = { catalog: parsed, url };
        }
      }
    } catch (error) {
      if (!options.silent) meta = { ...meta, lastError: error instanceof Error ? error.message : 'network error' };
    }
  }

  if (bestNewer) {
    const added = countNew(bestNewer.catalog);
    const total = bestNewer.catalog.games.length;
    if (adopt(bestNewer.catalog, bestNewer.url, 'network')) {
      return { status: 'updated', generated: bestNewer.catalog.generated, added, total };
    }
  }

  if (bestValid) {
    meta = { ...meta, generated: currentGenerated(), revision: currentRevision(), fetchedAt: new Date().toISOString(), appBuild: APP_BUILD_ID, lastError: undefined };
    saveMeta();
    return { status: 'current', generated: bestValid.generated };
  }

  if (!options.silent) saveMeta();
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
  const result = await checkForCatalogUpdate({ silent: true });
  meta = { ...meta, appBuild: APP_BUILD_ID };
  saveMeta();
  return result;
}

/* ------------------------------------------------------- shared types */
export type { Catalog, Collection, Game, Platform };
