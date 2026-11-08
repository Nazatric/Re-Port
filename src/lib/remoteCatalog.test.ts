import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCatalog, checkForCatalogUpdate, readCachedCatalog, setRemoteUrl, catalogMirror } from './remoteCatalog';
import bundled from '../data/catalog.json';
import { setCatalog, games, gameById, collections, platforms, stats, engines, queryGames, DEFAULT_FILTERS, currentGenerated, currentRevision, isCatalogNewer } from './catalog';
import type { Catalog } from './types';

// Fixtures must be newer than whatever catalog is bundled today, so the freshness guard accepts them.
const D = (...days: number[]) => {
  const d = new Date(Date.UTC(2099, 0, 1 + (days[0] || 0)));
  return d.toISOString().slice(0, 10);
};

const game = (id: string, over: Partial<Catalog['games'][number]> = {}): Catalog['games'][number] => ({
  id,
  title: id.replace(/-/g, ' '),
  platform: 'pc',
  genres: ['action'],
  summary: `${id} summary`,
  description: `${id} description`,
  views: 1,
  ports: [{ androidEvidence: 'github-apk', kind: 'github', url: `https://github.com/a/${id}`, download: `https://github.com/a/${id}/releases/latest` }],
  ...over,
});

const catalog = (generated: string, ids: string[], extra: Partial<Catalog> = {}): Catalog => ({
  androidPolicy: 1,
  generated,
  revision: generated,
  sources: ['test'],
  stats: { games: ids.length, engines: 0, ports: ids.length },
  platforms: [{ id: 'pc', name: 'PC', short: 'PC', count: ids.length }],
  collections: [{ id: 'action', name: 'Action', blurb: '' }],
  games: ids.map((id) => game(id)),
  ...extra,
});

// Each test moves the loaded build forward, mirroring how the app receives updates.
let day = 0;
const nextDate = () => D((day += 10));
const reset = () => {
  setCatalog(catalog(nextDate(), ['doom', 'quake']));
};

describe('validateCatalog', () => {
  it('accepts a structurally sound catalog', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `game-${i}`);
    expect(validateCatalog(catalog(nextDate(), ids))).not.toBeNull();
  });

  it('constructs a keyless mirror only for the intended public GitHub URL', () => {
    expect(catalogMirror('https://raw.githubusercontent.com/Nazatric/Re-Port/main/public/catalog.json'))
      .toBe('https://cdn.jsdelivr.net/gh/Nazatric/Re-Port@main/public/catalog.json');
    expect(catalogMirror('https://example.com/data.json')).toBeNull();
    expect(catalogMirror('https://raw.githubusercontent.com/a/b/main/private.json?token=secret')).toBeNull();
  });

  it('accepts the actual bundled catalog', () => {
    expect(validateCatalog(bundled)).not.toBeNull();
  });

  it('rejects malformed nested data and unsafe links before adoption', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `safe-${i}`);
    const badGenre = catalog(nextDate(), ids);
    (badGenre.games[1] as unknown as { genres: unknown }).genres = null;
    expect(validateCatalog(badGenre)).toBeNull();
    const badSteam = catalog(nextDate(), ids);
    (badSteam.games[1] as unknown as { steam: unknown }).steam = { id: 1, shots: null };
    expect(validateCatalog(badSteam)).toBeNull();
    const badLink = catalog(nextDate(), ids);
    badLink.games[1].ports[0].download = 'javascript:alert(1)';
    expect(validateCatalog(badLink)).toBeNull();
    const duplicate = catalog(nextDate(), ids);
    duplicate.games[1].id = duplicate.games[0].id;
    expect(validateCatalog(duplicate)).toBeNull();
    const badPlatform = catalog(nextDate(), ids);
    (badPlatform.platforms[0] as unknown as { count: unknown }).count = null;
    expect(validateCatalog(badPlatform)).toBeNull();
  });

  it('rejects payloads that could not serve as a catalog', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `game-${i}`);
    expect(validateCatalog(null)).toBeNull();
    expect(validateCatalog(catalog(nextDate(), ids, { androidPolicy: undefined }))).toBeNull();
    const noEvidence = catalog(nextDate(), ids);
    delete noEvidence.games[59].ports[0].androidEvidence;
    expect(validateCatalog(noEvidence)).toBeNull();
    expect(validateCatalog({})).toBeNull();
    expect(validateCatalog(catalog(nextDate(), ids.slice(0, 10)))).toBeNull();
    expect(validateCatalog(catalog('not-a-date', ids))).toBeNull();
    expect(validateCatalog(catalog(nextDate(), ids, { platforms: [] }))).toBeNull();
    const broken = catalog(nextDate(), ids);
    (broken.games[3] as unknown as { ports: unknown }).ports = 'nope';
    expect(validateCatalog(broken)).toBeNull();
  });
});

describe('live catalog replacement', () => {
  beforeEach(reset);

  it('keeps every exported view in sync after a swap', () => {
    expect(games.map((g) => g.id).sort()).toEqual(['doom', 'quake']);
    expect(gameById.get('doom')?.title).toBe('doom');
    expect(stats.games).toBe(2);

    const applied = setCatalog(catalog(nextDate(), ['doom', 'quake', 'heretic', 'hexen']));
    expect(applied).toBe(true);
    expect(games).toHaveLength(4);
    expect(gameById.get('heretic')).toBeTruthy();
    expect(gameById.has('hexen')).toBe(true);
    expect(stats.games).toBe(4);
    expect(stats.ports).toBe(4);
    expect(collections[0].count).toBe(4);
    expect(platforms[0].count).toBe(4);
    expect(engines).toHaveLength(0);
    expect(queryGames({ ...DEFAULT_FILTERS, q: 'heretic' })).toHaveLength(1);
  });

  it('refreshes the lazy search index when a new catalog has the same size', () => {
    expect(queryGames({ ...DEFAULT_FILTERS, q: 'doom' }).map((g) => g.id)).toEqual(['doom']);
    expect(setCatalog(catalog(nextDate(), ['heretic', 'quake']))).toBe(true);
    expect(queryGames({ ...DEFAULT_FILTERS, q: 'doom' })).toHaveLength(0);
    expect(queryGames({ ...DEFAULT_FILTERS, q: 'heretic' }).map((g) => g.id)).toEqual(['heretic']);
    expect(queryGames({ ...DEFAULT_FILTERS }).map((g) => g.id).sort()).toEqual(['heretic', 'quake']);
  });

  it('refuses to move backwards to an older build', () => {
    const before = games.length;
    expect(setCatalog(catalog('2001-01-01', ['old']))).toBe(false);
    expect(games).toHaveLength(before);
    expect(gameById.has('old')).toBe(false);
  });

  it('refuses an equal build with fewer games, but accepts one with more', () => {
    const loaded = currentGenerated();
    expect(setCatalog(catalog(loaded, ['doom']))).toBe(false);
    expect(setCatalog(catalog(loaded, ['doom', 'quake', 'heretic', 'hexen']))).toBe(true);
    expect(games).toHaveLength(4);
  });

  it('re-indexes engines and search after a swap', () => {
    const applied = setCatalog(
      catalog(nextDate(), ['gzdoom', 'doom'], {
        games: [
          game('gzdoom', { platform: 'engine', supports: ['doom'] }),
          game('doom', { ports: [{ kind: 'github', url: 'https://github.com/a/doom', download: 'https://github.com/a/doom/releases/latest', engine: 'gzdoom' }] }),
        ],
      }),
    );
    expect(applied).toBe(true);
    expect(engines.map((e) => e.id)).toEqual(['gzdoom']);
    expect(stats.engines).toBe(1);
    expect(stats.games).toBe(1);
    expect(queryGames({ ...DEFAULT_FILTERS, platform: 'engine' }).map((g) => g.id)).toEqual(['gzdoom']);
  });

  it('exposes the loaded build id', () => {
    const stamp = nextDate();
    setCatalog(catalog(stamp, ['doom']));
    expect(currentGenerated()).toBe(stamp);
  });

  it('ignores an empty payload', () => {
    const before = games.length;
    expect(setCatalog({ ...catalog(nextDate(), []), games: [] } as Catalog)).toBe(false);
    expect(games).toHaveLength(before);
  });

  it('accepts a same-day publication with a newer revision', () => {
    const loaded = currentGenerated();
    const first = catalog(loaded, ['doom', 'quake'], { revision: `${loaded}T01:00:00.000Z` });
    setCatalog(first);
    expect(currentRevision()).toBe(`${loaded}T01:00:00.000Z`);

    const second = catalog(loaded, ['doom', 'quake'], { revision: `${loaded}T02:00:00.000Z` });
    expect(isCatalogNewer(second)).toBe(true);
    expect(setCatalog(second)).toBe(true);
    expect(currentRevision()).toBe(`${loaded}T02:00:00.000Z`);

    const older = catalog(loaded, ['doom', 'quake'], { revision: `${loaded}T00:30:00.000Z` });
    expect(isCatalogNewer(older)).toBe(false);
    expect(setCatalog(older)).toBe(false);
  });
});


describe('catalog refresh resilience', () => {
  const remote = 'https://catalog.example/catalog.json';
  const ids = Array.from({ length: 60 }, (_, i) => `remote-${i}`);
  const good = () => catalog('2100-01-01', ids, { revision: '2100-01-01T00:00:00Z' });
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal('document', { baseURI: 'https://app.example/' });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal('caches', { open: async () => ({ put: async () => undefined }) });
    setRemoteUrl(remote);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('skips and removes a corrupt cached entry instead of hiding a valid fallback', async () => {
    const removed: string[] = [];
    vi.stubGlobal('caches', { open: async () => ({
      match: async (url: string) => url === remote ? new Response('{broken') : new Response(JSON.stringify(good())),
      delete: async (url: string) => { removed.push(url); return true; },
    }) });
    expect((await readCachedCatalog())?.games).toHaveLength(60);
    expect(removed).toEqual([remote]);
  });

  it('does not call a local snapshot a successful remote check after failures', async () => {
    const mock = vi.fn(async (input: string) => input.startsWith(remote)
      ? new Response('unavailable', { status: 503 })
      : new Response(JSON.stringify(bundled)));
    vi.stubGlobal('fetch', mock);
    const result = await checkForCatalogUpdate();
    expect(result.status).toBe('unavailable');
    expect(mock.mock.calls.filter(([url]) => url.startsWith(remote))).toHaveLength(2);
  });

  it('rejects an oversized streamed response even without a content length', async () => {
    const oversized = new Uint8Array(12 * 1024 * 1024 + 1);
    vi.stubGlobal('fetch', vi.fn(async (input: string) => input.startsWith(remote)
      ? new Response(oversized)
      : new Response(JSON.stringify(bundled))));
    expect((await checkForCatalogUpdate()).status).toBe('unavailable');
  });

  it('times out stalled sources instead of leaving a check pending indefinitely', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
      const pending = checkForCatalogUpdate();
      await vi.advanceTimersByTimeAsync(17000);
      expect((await pending).status).toBe('unavailable');
    } finally { vi.useRealTimers(); }
  });

  it('coalesces concurrent refreshes and adopts the newest valid source', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const mock = vi.fn(async (input: string) => {
      await gate;
      return new Response(JSON.stringify(input.startsWith(remote) ? good() : bundled));
    });
    vi.stubGlobal('fetch', mock);
    const first = checkForCatalogUpdate();
    const second = checkForCatalogUpdate();
    expect(first).toBe(second);
    release();
    expect((await first).status).toBe('updated');
    expect(mock).toHaveBeenCalledTimes(2);
    expect(games[0].id).toBe('remote-0');
  });
});
