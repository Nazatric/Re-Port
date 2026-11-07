import { useMemo } from 'react';
import { GameCard, RailCard } from '../components/GameCard';
import { EmptyState, Hero, SectionHeader } from '../components/ui';
import { Link } from '../lib/router';
import { gameById } from '../lib/catalog';
import { recentsStore, useFavorites, useRecents } from '../lib/store';
import type { Game } from '../lib/types';

export default function Saved() {
  const { ids } = useFavorites();
  const recents = useRecents();
  const saved = useMemo(() => ids.map((id) => gameById.get(id)).filter((g): g is Game => Boolean(g)), [ids]);
  const viewed = useMemo(() => recents.filter((id) => !ids.includes(id)).map((id) => gameById.get(id)).filter((g): g is Game => Boolean(g)).slice(0, 14), [recents, ids]);

  return (
    <>
      <Hero title="Saved" />
      <main id="main" tabIndex={-1} className="safe-bottom -mt-4 outline-none">
        <section aria-labelledby="h-saved" className="wrap">
          <h2 id="h-saved" className="section-title mb-3">
            my list
          </h2>
          {saved.length === 0 ? (
            <EmptyState icon="saved" title="Nothing saved yet" text="Tap the bookmark on any game to keep it here. Your list is stored on this device and works offline.">
              <Link to="/library" className="btn-a small mt-2">
                Browse the library
              </Link>
            </EmptyState>
          ) : (
            <div className="grid-games stagger">
              {saved.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        {viewed.length > 0 && (
          <section aria-labelledby="h-rec" className="mt-9">
            <SectionHeader id="h-rec" title="Recently Viewed" />
            <div className="rail">
              {viewed.map((g) => (
                <RailCard key={g.id} game={g} />
              ))}
            </div>
            <div className="wrap">
              <button type="button" className="btn-glass" onClick={() => recentsStore.set([])}>
                Clear history
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
