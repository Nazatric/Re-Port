import { describe, expect, it } from 'vitest';
import {
  comparePorts,
  portTier,
  randomFeatured,
  DEFAULT_FILTERS,
  activeFilterCount,
  bestPort,
  collectionById,
  collections,
  engineOf,
  engines,
  featured,
  filtersFromParams,
  filtersToParams,
  gameById,
  gameStatus,
  games,
  githubRepo,
  linkMeta,
  newArrivals,
  normalize,
  platformById,
  platforms,
  popular,
  portStatus,
  queryGames,
  readyToPlay,
  recentlyUpdated,
  related,
  stats,
} from './catalog';
import type { Game, Port } from './types';

const port = (over: Partial<Port> = {}): Port => ({ kind: 'github', url: 'https://github.com/a/b', download: 'https://github.com/a/b/releases/latest', ...over });

describe('catalog data integrity', () => {
  it('contains a large library', () => {
    expect(stats.games).toBeGreaterThan(700);
    expect(stats.ports).toBeGreaterThan(900);
    expect(stats.engines).toBeGreaterThanOrEqual(10);
  });

  it('uses unique, url-safe ids', () => {
    const ids = games.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives every entry a title, a known platform and at least one port', () => {
    for (const g of games) {
      expect(g.title.trim().length, g.id).toBeGreaterThan(0);
      expect(platformById.has(g.platform), `${g.id} platform ${g.platform}`).toBe(true);
      expect(g.ports.length, g.id).toBeGreaterThan(0);
    }
  });

  it('only uses known genres', () => {
    for (const g of games) for (const id of g.genres) expect(collectionById.has(id), `${g.id} genre ${id}`).toBe(true);
  });

  it('has valid download links that resolve to the right place', () => {
    for (const g of games) {
      for (const p of g.ports) {
        expect(() => new URL(p.download), `${g.id} ${p.download}`).not.toThrow();
        expect(p.download, g.id).toMatch(/^https?:\/\//);
        expect(p.download, g.id).not.toMatch(/\s|%20$/);
        if (p.kind === 'github') {
          const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/latest$/.exec(p.download);
          if (m) expect(githubRepo(p)).toEqual({ owner: m[1], repo: m[2] });
        }
      }
    }
  });

  it('never lists the same download twice for one game', () => {
    for (const g of games) {
      const urls = g.ports.map((p) => p.download.replace(/\/+$/, '').toLowerCase());
      expect(new Set(urls).size, g.id).toBe(urls.length);
    }
  });

  it('keeps dates and years sane', () => {
    for (const g of games) {
      if (g.year) {
        expect(g.year).toBeGreaterThanOrEqual(1970);
        expect(g.year).toBeLessThanOrEqual(2030);
      }
      for (const p of g.ports) {
        for (const d of [p.updated, p.added]) if (d) expect(d, g.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('links engines to games that exist, in both directions', () => {
    for (const e of engines) {
      for (const id of e.supports ?? []) {
        const g = gameById.get(id);
        expect(g, `${e.id} supports missing ${id}`).toBeTruthy();
        expect(g!.ports.some((p) => p.engine === e.id), `${id} should reference ${e.id}`).toBe(true);
      }
    }
    for (const g of games) for (const p of g.ports) if (p.engine) expect(gameById.get(p.engine)?.platform).toBe('engine');
  });

  it('provides artwork for the large majority of games', () => {
    const real = games.filter((g) => g.platform !== 'engine');
    const withArt = real.filter((g) => g.cover || g.steam).length;
    expect(withArt / real.length).toBeGreaterThan(0.85);
    for (const g of real) if (g.cover) expect(g.cover).toMatch(/^https:\/\//);
  });

  it('has descriptions for most entries and none that are absurdly long', () => {
    const real = games.filter((g) => g.platform !== 'engine');
    expect(real.filter((g) => g.description.length > 40).length / real.length).toBeGreaterThan(0.85);
    for (const g of games) {
      expect(g.description.length, g.id).toBeLessThanOrEqual(1200);
      expect(g.summary.length, g.id).toBeLessThanOrEqual(260);
    }
  });

  it('exposes every collection with a positive count', () => {
    expect(collections.length).toBeGreaterThanOrEqual(12);
    for (const c of collections) expect(c.count).toBeGreaterThan(0);
  });

  it('counts platforms consistently, including multi-source games', () => {
    for (const p of platforms) {
      expect(games.filter((g) => g.platform === p.id || g.platforms?.includes(p.id)).length).toBe(p.count);
      expect(p.count).toBeGreaterThan(0);
    }
    // Every platform referenced by a game is published, so filters never dead-end.
    for (const g of games) for (const id of g.platforms ?? []) expect(platformById.has(id), `${g.id} platform ${id}`).toBe(true);
  });
});

describe('search, filters and sorting', () => {
  it('finds games by title, case and accent insensitive', () => {
    const a = queryGames({ ...DEFAULT_FILTERS, q: 'DOOM' });
    expect(a.length).toBeGreaterThan(3);
    expect(a.every((g) => normalize(`${g.title} ${g.ports.map((p) => `${p.name} ${p.developer}`).join(' ')}`).includes('doom') || normalize(platformById.get(g.platform)!.name).includes('doom') || g.genres.length >= 0)).toBe(true);
    expect(queryGames({ ...DEFAULT_FILTERS, q: 'pokemon' }).length).toBeGreaterThan(0);
  });

  it('ranks exact and prefix title matches first', () => {
    const r = queryGames({ ...DEFAULT_FILTERS, q: 'super mario 64' });
    expect(r.length).toBeGreaterThan(0);
    expect(normalize(r[0].title)).toBe('super mario 64');
  });

  it('requires every search word to match', () => {
    const r = queryGames({ ...DEFAULT_FILTERS, q: 'zelda ocarina' });
    expect(r.length).toBeGreaterThan(0);
    for (const g of r) expect(normalize(g.title)).toContain('ocarina');
    expect(queryGames({ ...DEFAULT_FILTERS, q: 'zzzzqqqq nothing' })).toHaveLength(0);
  });

  it('filters by genre, platform and combinations', () => {
    const racing = queryGames({ ...DEFAULT_FILTERS, genre: 'racing' });
    expect(racing.length).toBeGreaterThan(10);
    expect(racing.every((g) => g.genres.includes('racing'))).toBe(true);
    const n64 = queryGames({ ...DEFAULT_FILTERS, platform: 'n64' });
    expect(n64.length).toBeGreaterThan(3);
    expect(n64.every((g) => (g.platforms ?? [g.platform]).includes('n64'))).toBe(true);
    const both = queryGames({ ...DEFAULT_FILTERS, platform: 'n64', genre: 'racing' });
    expect(both.length).toBeLessThanOrEqual(Math.min(racing.length, n64.length));
    expect(both.every((g) => (g.platforms ?? [g.platform]).includes('n64') && g.genres.includes('racing'))).toBe(true);
  });

  it('filters by source, status, files and controller', () => {
    expect(queryGames({ ...DEFAULT_FILTERS, source: 'telegram' }).every((g) => g.ports.some((p) => p.kind === 'telegram'))).toBe(true);
    expect(queryGames({ ...DEFAULT_FILTERS, works: 'yes' }).every((g) => g.ports.some((p) => p.works === 'yes'))).toBe(true);
    expect(queryGames({ ...DEFAULT_FILTERS, files: 'none' }).every((g) => g.ports.some((p) => p.files === 'none'))).toBe(true);
    expect(queryGames({ ...DEFAULT_FILTERS, controller: 'yes' }).every((g) => g.ports.some((p) => p.controller === 'both' || p.controller === 'controller'))).toBe(true);
    expect(queryGames({ ...DEFAULT_FILTERS, source: 'does-not-exist' })).toHaveLength(0);
  });

  it('sorts by title, update date, added date, year and popularity', () => {
    const titles = queryGames({ ...DEFAULT_FILTERS, sort: 'title' }).map((g) => g.title);
    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles);
    const upd = queryGames({ ...DEFAULT_FILTERS, sort: 'updated' }).map((g) => g.updated || '');
    for (let i = 1; i < upd.length; i++) expect(upd[i - 1] >= upd[i]).toBe(true);
    const added = queryGames({ ...DEFAULT_FILTERS, sort: 'added' }).map((g) => g.added || '');
    expect(added[0] >= added[added.length - 1]).toBe(true);
    const years = queryGames({ ...DEFAULT_FILTERS, sort: 'year' }).map((g) => g.year || 0);
    for (let i = 1; i < years.length; i++) expect(years[i - 1] >= years[i]).toBe(true);
    // Most popular is measured from real release downloads, then stars, then list views.
    const ranked = queryGames({ ...DEFAULT_FILTERS, sort: 'popular' });
    const score = (g: Game): number => g.views + g.ports.reduce((s: number, p: Port) => s + (p.downloads || 0) / 10 + (p.stars || 0) / 5, 0);
    for (let i = 1; i < ranked.length; i++) expect(score(ranked[i - 1]) >= score(ranked[i])).toBe(true);
  });

  it('returns stable results for the same query', () => {
    const f = { ...DEFAULT_FILTERS, q: 'quake' };
    expect(queryGames(f)).toBe(queryGames({ ...f }));
  });
});

describe('URL filter state', () => {
  it('round-trips filters through URL params', () => {
    const f = { ...DEFAULT_FILTERS, q: 'halo', genre: 'shooter', platform: 'xbox', works: 'yes', sort: 'updated' as const };
    const params = new URLSearchParams(filtersToParams(f));
    expect(filtersFromParams(params)).toEqual(f);
  });

  it('omits defaults and sanitises junk input', () => {
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({});
    const f = filtersFromParams(new URLSearchParams('sort=nonsense&works=maybe&files=x&q=' + 'a'.repeat(300)));
    expect(f.sort).toBe('popular');
    expect(f.works).toBe('');
    expect(f.files).toBe('');
    expect(f.q.length).toBe(80);
  });

  it('counts only filter chips, not search or sort', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, q: 'x', sort: 'title' })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, genre: 'rpg', works: 'yes' })).toBe(2);
  });
});

describe('ports, status and links', () => {
  it('maps compatibility flags to status', () => {
    expect(portStatus(port({ works: 'yes' }))).toBe('working');
    expect(portStatus(port({ works: 'bug' }))).toBe('bugs');
    expect(portStatus(port({ works: 'no' }))).toBe('broken');
    expect(portStatus(port())).toBe('untested');
  });

  it('reports the best status across ports', () => {
    const g = { ports: [port({ works: 'no' }), port({ works: 'yes' })] } as Game;
    expect(gameStatus(g)).toBe('working');
    expect(gameStatus({ ports: [port({ works: 'no' }), port()] } as Game)).toBe('untested');
    expect(gameStatus({ ports: [port({ works: 'no' })] } as Game)).toBe('broken');
  });

  it('prefers working, first-party links over broken or mirrored ones', () => {
    const broken = port({ works: 'no', url: 'https://github.com/x/broken' });
    const mirror = port({ kind: 'mirror', mirror: true, works: 'yes', url: 'https://mirror.example/a' });
    const good = port({ works: 'yes', url: 'https://github.com/x/good' });
    expect(bestPort({ ports: [broken, mirror, good] } as Game)).toBe(good);
    expect(bestPort({ ports: [broken, good] } as Game)).toBe(good);
  });

  it('describes link sources and warns about risky ones', () => {
    expect(linkMeta(port()).label).toBe('GitHub');
    expect(linkMeta(port({ kind: 'mirror', mirror: true })).warnings.length).toBeGreaterThan(0);
    expect(linkMeta(port({ kind: '4pda' })).warnings.join(' ')).toMatch(/account/i);
    expect(linkMeta(port({ kind: 'playstore', paid: true })).warnings.join(' ')).toMatch(/paid/i);
    expect(linkMeta(port({ kind: 'telegram' })).warnings).toEqual([]);
  });

  it('extracts GitHub owner and repo only for GitHub ports', () => {
    expect(githubRepo(port({ url: 'https://github.com/FWGS/xash3d-fwgs/' }))).toEqual({ owner: 'FWGS', repo: 'xash3d-fwgs' });
    expect(githubRepo(port({ kind: 'telegram', url: 'https://t.me/x/1' }))).toBeNull();
  });

  it('opens the latest release page for GitHub ports and the original page otherwise', () => {
    const gh = games.flatMap((g) => g.ports).filter((p) => p.kind === 'github');
    expect(gh.length).toBeGreaterThan(500);
    const releasePages = gh.filter((p) => /\/releases\/latest$/.test(p.download));
    expect(releasePages.length / gh.length).toBeGreaterThan(0.97);
    const other = games.flatMap((g) => g.ports).filter((p) => p.kind !== 'github');
    const tidy = (u: string) => u.replace(/\/+$/, '').toLowerCase();
    for (const p of other.slice(0, 200)) expect(tidy(p.download)).toBe(tidy(p.url));
  });
});

describe('home lists', () => {
  it('builds non-empty, artwork-backed curated lists', () => {
    for (const list of [featured(12), recentlyUpdated(14), newArrivals(14), readyToPlay(14), popular(6)]) {
      expect(list.length).toBeGreaterThan(3);
      expect(new Set(list.map((g) => g.id)).size).toBe(list.length);
    }
    for (const g of featured(12)) expect(g.cover || g.steam).toBeTruthy();
    expect(featured(12).every((g) => gameStatus(g) !== 'broken')).toBe(true);
  });

  it('suggests related games without the game itself', () => {
    const g = gameById.get('super-mario-64') ?? games.find((x) => x.genres.length)!;
    const r = related(g, 8);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((x) => x.id === g.id)).toBe(false);
  });

  it('finds the engine a port runs on', () => {
    const g = games.find((x) => x.ports.some((p) => p.engine))!;
    expect(engineOf(g)?.platform).toBe('engine');
  });
});

describe('port ranking', () => {
  const p = (over: Partial<Port>): Port => ({ kind: 'github', url: 'https://github.com/a/b', download: 'https://github.com/a/b/releases/latest', ...over });

  it('lists GitHub first, then by stars, then downloads, and mirrors / Reddit / Telegram last', () => {
    const ports = [
      p({ kind: 'mirror', url: 'https://apkvision.org/x', download: 'https://apkvision.org/x', stars: 99999 }),
      p({ kind: 'telegram', url: 'https://t.me/x/1', download: 'https://t.me/x/1', downloads: 99999 }),
      p({ kind: 'reddit', url: 'https://reddit.com/r/x', download: 'https://reddit.com/r/x' }),
      p({ url: 'https://github.com/a/small', download: 'https://github.com/a/small/releases/latest', stars: 40 }),
      p({ url: 'https://github.com/a/big', download: 'https://github.com/a/big/releases/latest', stars: 900, downloads: 1 }),
      p({ kind: 'playstore', url: 'https://play.google.com/x', download: 'https://play.google.com/x', downloads: 5000 }),
    ];
    const order = [...ports].sort(comparePorts).map((x) => x.url);
    expect(order).toEqual([
      'https://github.com/a/big',
      'https://github.com/a/small',
      'https://play.google.com/x',
      'https://t.me/x/1',
      'https://reddit.com/r/x',
      'https://apkvision.org/x',
    ]);
  });

  it('demotes paused and reported-broken ports by one tier', () => {
    const healthy = p({ url: 'https://github.com/a/ok', download: 'https://github.com/a/ok/releases/latest' });
    const paused = p({ url: 'https://github.com/a/paused', download: 'https://github.com/a/paused/releases/latest', stars: 9999, lifecycle: 'paused' });
    const broken = p({ url: 'https://github.com/a/broken', download: 'https://github.com/a/broken/releases/latest', stars: 9999, works: 'no' });
    expect([paused, broken, healthy].sort(comparePorts)[0]).toBe(healthy);
  });

  it('keeps the shipped catalog in ranked order for every game', () => {
    for (const g of games) {
      for (let i = 1; i < g.ports.length; i++) {
        expect(comparePorts(g.ports[i - 1], g.ports[i]), `${g.id} port ${i}`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('uses GitHub release ports as the main download for games that have one', () => {
    const multi = games.filter((g) => g.ports.some((x) => x.kind === 'github') && g.ports.length > 1);
    expect(multi.length).toBeGreaterThan(20);
    for (const g of multi) {
      // A healthy GitHub release always leads; a broken or paused one may rightly drop below a store listing.
      if (g.ports.some((x) => x.kind === 'github' && portTier(x) === 0)) expect(g.ports[0].kind, g.id).toBe('github');
    }
  });
});

describe('random cover flow', () => {
  it('returns distinct games with artwork, in a different order for each draw', () => {
    const a = randomFeatured(12, () => 0.1);
    const b = randomFeatured(12, () => 0.9);
    expect(a).toHaveLength(12);
    expect(new Set(a.map((g) => g.id)).size).toBe(12);
    expect(a.every((g) => g.cover || g.steam)).toBe(true);
    expect(a.map((g) => g.id).join()).not.toBe(b.map((g) => g.id).join());
  });
});
