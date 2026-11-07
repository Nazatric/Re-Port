import { describe, expect, it } from 'vitest';
import { coverCandidates, gameScreenshots, proxied } from './images';
import type { Game } from './types';

const game = { id: 'example', title: 'Example', platform: 'pc', genres: [], summary: '', description: '', views: 0, ports: [] } satisfies Game;

describe('catalog artwork', () => {
  it('combines verified and Steam screenshots without duplicates', () => {
    const custom = 'https://example.com/real.png';
    const steam = 'https://example.com/steam.jpg';
    expect(gameScreenshots({ ...game, shots: [custom, custom, 'javascript:bad'], steam: { id: 1, shots: [custom, steam] } })).toEqual([custom, steam]);
  });
  it('prefers original detailed cover art, retaining a proxy fallback', () => {
    const cover = 'https://example.com/full.jpg';
    const candidates = coverCandidates({ ...game, cover }, 360);
    expect(candidates[0].src).toBe(cover);
    expect(candidates[1].src).toBe(proxied(cover, 360, 90));
  });
  it('tries real Steam art before a generated title card', () => {
    const cover = 'https://openportsgames.com/covers/generated/example.svg';
    const candidates = coverCandidates({ ...game, cover, steam: { id: 10, shots: [] } }, 360);
    expect(candidates[0].src).toContain('steamstatic.com');
    expect(candidates.at(-1)?.src).toBe(cover);
  });
});
