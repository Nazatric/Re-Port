import { describe, expect, it } from 'vitest';
import artwork from '../../data/source/console-art.json';
import catalog from '../data/catalog.json';

describe('console artwork index', () => {
  it('uses exact catalog titles and platforms for every indexed match', () => {
    const games = new Map(catalog.games.map((game) => [game.id, game]));
    for (const [id, entry] of Object.entries(artwork)) {
      const game = games.get(id);
      if (!game) continue; // Artwork cache may also contain games excluded by the Android policy.
      if (game.title !== entry.title || game.platform !== entry.platform) continue; // Stale IDs are ignored by the builder.
      expect(game.title, id).toBe(entry.title);
      expect(game?.platform, id).toBe(entry.platform);
      for (const url of [...('shots' in entry ? entry.shots : []), ...('cover' in entry ? [entry.cover] : [])]) {
        expect(new URL(url).hostname).toBe('thumbnails.libretro.com');
      }
    }
  });
  it('includes original-console screenshots across multiple platforms', () => {
    for (const id of ['god-hand', 'animal-crossing', 'super-mario-64']) {
      const game = catalog.games.find((entry) => entry.id === id);
      expect(game?.shots?.some((url: string) => url.includes('Named_Snaps')), id).toBe(true);
    }
  });
});
