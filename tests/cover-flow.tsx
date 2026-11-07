import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { CoverFlow } from '../src/components/CoverFlow';
import { BottomNav } from '../src/components/BottomNav';
import { parseHash } from '../src/lib/router';
import type { Game } from '../src/lib/types';

const titles = [
  'Half-Life',
  'Castlevania: Symphony of the Night',
  'Mario Kart 8 Deluxe',
  'The Legend of Zelda: Ocarina of Time',
  'Prototype',
  'Super Mario 64',
  'Naruto Shippuden: Ultimate Ninja Storm 3 Full Burst',
  'The Elder Scrolls III: Morrowind',
  'Grand Theft Auto V',
  'Quake',
  'Doom',
  'Pikmin 2',
];
const games: Game[] = titles.map((title, i) => ({
  id: `test-${i}`, title, year: 1997 + i, platform: 'pc', genres: ['action'],
  summary: '', description: '', views: 1,
  cover: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="hsl(${i * 31} 45% 22%)"/><circle cx="300" cy="360" r="170" fill="hsl(${i * 31} 50% 38%)"/><text x="300" y="420" font-family="sans-serif" text-anchor="middle" font-size="170" fill="white">${i + 1}</text></svg>`)}`,
  ports: [{ kind: 'github', url: 'https://github.com/example/game', download: 'https://github.com/example/game/releases/latest' }],
}));

declare global {
  interface Window {
    coverFlowFixture: {
      count: (value: number) => void;
      rerender: () => void;
      duplicates: () => void;
      longTitle: () => void;
      motion: (value: 'reduce' | 'full') => void;
    };
  }
}

function Fixture() {
  const [items, setItems] = useState(games);
  useEffect(() => {
    window.coverFlowFixture = {
      count: (n) => setItems(games.slice(0, n)),
      rerender: () => setItems((old) => old.map((game) => ({ ...game }))),
      duplicates: () => setItems([...games, games[0], games[1]]),
      longTitle: () => setItems(games.map((g, i) => i === 1 ? { ...g, title: 'A Very Long Game Title With Multiple Editions and an UnusuallyLongUnbrokenWordToCheckWrappingAcrossSmallScreens' } : g)),
      motion: (value) => { document.documentElement.dataset.motion = value; },
    };
  }, []);
  return (
    <main style={{ paddingTop: 20, paddingBottom: 120 }}>
      <CoverFlow items={items} />
      <label style={{ display: 'block', margin: '40px 20px' }}>
        Unrelated input <input id="other-input" className="field" />
      </label>
      <div style={{ height: 1000 }} />
      <BottomNav route={parseHash('#/')} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);