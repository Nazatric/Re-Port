import { describe, expect, it } from 'vitest';
import { coverCandidates, gameScreenshots, heroCandidates, proxied } from './images';
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
  it('retains platform-matched artwork as a fallback when a cover fails', () => {
    const fallback = 'https://thumbnails.libretro.com/console/Named_Boxarts/game.png';
    const candidates = coverCandidates({ ...game, cover: 'https://example.com/cover.jpg', coverFallback: fallback }, 360);
    expect(candidates.map((candidate) => candidate.src)).toContain(fallback);
  });
  it('falls back to original hero images if the image proxy is unavailable', () => {
    const candidates = heroCandidates({ ...game, steam: { id: 10, shots: [] } });
    expect(candidates[0].cors).toBe(true);
    expect(candidates[1].src).toContain('/10/library_hero.jpg');
    expect(candidates[1].cors).toBe(false);
  });
  it('tries real Steam art before a generated title card', () => {
    const cover = 'https://openportsgames.com/covers/generated/example.svg';
    const candidates = coverCandidates({ ...game, cover, steam: { id: 10, shots: [] } }, 360);
    expect(candidates[0].src).toContain('steamstatic.com');
    expect(candidates.at(-1)?.src).toBe(cover);
  });
});
