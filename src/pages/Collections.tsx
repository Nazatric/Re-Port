import { useMemo, type CSSProperties } from 'react';
import { Icon, hasIcon } from '../components/Icons';
import { Hero } from '../components/ui';
import { TILE_COLORS } from './Home';
import { Link } from '../lib/router';
import { DEFAULT_FILTERS, SOURCE_OPTIONS, collections, platforms, queryGames, useCatalogVersion } from '../lib/catalog';

export default function Collections() {
  const version = useCatalogVersion();
  const sources = useMemo(() => SOURCE_OPTIONS.map((s) => ({ ...s, count: queryGames({ ...DEFAULT_FILTERS, source: s.id }).length })).filter((s) => s.count > 0), [version]);
  return (
    <>
      <Hero title="Browse" />
      <main id="main" tabIndex={-1} className="safe-bottom -mt-4 outline-none">
        <section aria-labelledby="h-gen" className="wrap">
          <h2 id="h-gen" className="section-title mb-3">
            collections
          </h2>
          <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3 md:grid-cols-4">
            {collections.map((c) => (
              <div key={c.id} className="blade-wrap !block">
                <Link to="/library" params={{ genre: c.id }} className="blade big" aria-label={`Browse ${c.name}, ${c.count} games`}>
                  <Icon name={hasIcon(c.id) ? c.id : 'other'} size={64} className="blade-ico" />
                  <span className="blade-label">
                    {c.name}<span className="mt-1 block text-xs font-medium opacity-85">{c.count} games</span>
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-pf" className="wrap mt-6">
          <h2 id="h-pf" className="section-title mb-3">
            Original Platforms
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {platforms.map((p, i) => (
              <Link key={p.id} to="/library" params={{ platform: p.id }} className="mtile" style={{ '--tile': TILE_COLORS[i % TILE_COLORS.length] } as CSSProperties} aria-label={`Browse ${p.count} entries from ${p.name}`}>
                <span className="tile-mark">{p.short}</span>
                <span className="lbl">{p.name}<span className="mt-1 block text-xs font-medium opacity-85">{p.count} entries</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-src" className="wrap mt-8">
          <h2 id="h-src" className="section-title mb-3">
            Release Sources
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {sources.map((s) => (
              <li key={s.id}>
                <Link to="/library" params={{ source: s.id }} className="row-card !grid-cols-[1fr_auto_auto] !py-3.5">
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-xs text-ink2">{s.count}</span>
                  <Icon name="chevron" className="text-ink2" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
