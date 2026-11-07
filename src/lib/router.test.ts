import { describe, expect, it } from 'vitest';
import { buildHref, parseHash } from './router';

describe('parseHash', () => {
  it('treats an empty hash as home', () => {
    expect(parseHash('')).toMatchObject({ path: '/', seg: [] });
    expect(parseHash('#')).toMatchObject({ path: '/', seg: [] });
    expect(parseHash('#/')).toMatchObject({ path: '/', seg: [] });
  });
  it('splits path segments and decodes them', () => {
    expect(parseHash('#/game/super-mario-64').seg).toEqual(['game', 'super-mario-64']);
    expect(parseHash('#/game/a%20b').seg).toEqual(['game', 'a b']);
    expect(parseHash('#/game/%E0%A4%A').seg).toEqual(['game', '%E0%A4%A']);
  });
  it('parses the query string', () => {
    const r = parseHash('#/library?genre=rpg&q=zelda%20oot');
    expect(r.path).toBe('/library');
    expect(r.query.get('genre')).toBe('rpg');
    expect(r.query.get('q')).toBe('zelda oot');
  });
  it('normalises repeated and trailing slashes', () => {
    expect(parseHash('#//library//').path).toBe('/library');
  });
});

describe('buildHref', () => {
  it('builds links with encoded params and skips empty ones', () => {
    expect(buildHref('/library')).toBe('#/library');
    expect(buildHref('/library', { genre: 'rpg', q: 'a b', sort: undefined, works: '' })).toBe('#/library?genre=rpg&q=a+b');
  });
  it('round-trips through parseHash', () => {
    const r = parseHash(buildHref('/library', { q: 'half-life 2', platform: 'pc' }));
    expect(r.query.get('q')).toBe('half-life 2');
    expect(r.query.get('platform')).toBe('pc');
  });
});
