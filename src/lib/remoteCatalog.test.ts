import { beforeEach, describe, expect, it } from 'vitest';
import { validateCatalog } from './remoteCatalog';
import { setCatalog, games, gameById, collections, platforms, stats, engines, queryGames, DEFAULT_FILTERS, currentGenerated } from './catalog';
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
  ports: [{ kind: 'github', url: `https://github.com/a/${id}`, download: `https://github.com/a/${id}/releases/latest` }],
  ...over,
});

const catalog = (generated: string, ids: string[], extra: Partial<Catalog> = {}): Catalog => ({
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

  it('rejects payloads that could not serve as a catalog', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `game-${i}`);
    expect(validateCatalog(null)).toBeNull();
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
});
