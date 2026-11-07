import { useMemo } from 'react';
import { CoverFlow } from '../components/CoverFlow';
import { RailCard } from '../components/GameCard';
import { Icon, hasIcon, kindIcon } from '../components/Icons';
import { Hero, Logo, SectionHeader } from '../components/ui';
import { AvatarFor } from '../components/PortParts';
import { Link, navigate } from '../lib/router';
import { collections, engines, randomFeatured, recentlyUpdated } from '../lib/catalog';
import { formatDate } from '../lib/format';

export const TILE_COLORS = ['#3d8a0e', '#0a7a7a', '#1d5fb4', '#b4540a', '#a31d6b', '#5b3ea8', '#6a7a12', '#8a2a2a'];

export default function Home() {
  // A new random set of popular titles on every visit to Home.
  const feat = useMemo(() => randomFeatured(12), []);
  const updated = useMemo(() => recentlyUpdated(12), []);

  return (
    <>
      <Hero
        title="Spotlight"
        left={
          <div className="flex items-center gap-2.5">
            <Logo size={38} />
            <span className="text-lg font-bold tracking-tight [text-shadow:0_1px_4px_rgba(0,30,0,.45)]">Re:Port</span>
          </div>
        }
        right={
          <Link to="/library" params={{ focus: '1' }} className="icon-btn" aria-label="Search the library">
            <Icon name="search" />
          </Link>
        }
      >
        <form
          role="search"
          className="relative mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get('q') || '').trim();
            navigate('/library', { q: q || undefined });
          }}
        >
          <label htmlFor="home-q" className="sr-only">
            Search games, engines and developers
          </label>
          <input id="home-q" name="q" type="search" enterKeyHint="search" autoComplete="off" placeholder="Find a game or port" className="field !min-h-[54px] !rounded-full !pl-12 !pr-5 !shadow-[0_6px_16px_rgba(0,30,0,.3)]" />
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink2" />
        </form>
        <div className="h-8" aria-hidden="true" />
      </Hero>

      <main id="main" tabIndex={-1} className="safe-bottom -mt-2 outline-none">
        <CoverFlow items={feat} />

        <section aria-labelledby="h-genres" className="mt-8">
          <SectionHeader id="h-genres" title="Genres" to="/collections" />
          <div className="rail stagger">
            {collections.map((c) => (
              <div key={c.id} className="blade-wrap">
                <Link to="/library" params={{ genre: c.id }} className="blade" aria-label={`${c.name}, ${c.count} games`}>
                  <Icon name={hasIcon(c.id) ? c.id : 'other'} size={58} className="blade-ico" />
                  <span className="blade-label">
                    {c.name}
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-upd" className="mt-9">
          <SectionHeader id="h-upd" title="Recently Updated" to="/library" params={{ sort: 'updated' }} />
          <div className="rail">
            {updated.map((g) => (
              <RailCard key={g.id} game={g} note={`Updated ${formatDate(g.updated)}`} />
            ))}
          </div>
        </section>

        <section aria-labelledby="h-eng" className="mt-9">
          <SectionHeader id="h-eng" title="Engines and Launchers" to="/library" params={{ platform: 'engine' }} />
          <div className="wrap mt-3 grid gap-3 sm:grid-cols-2">
            {engines.slice(0, 4).map((e) => (
              <Link key={e.id} to={`/game/${e.id}`} className="row-card !grid-cols-[48px_1fr_auto]">
                <AvatarFor port={e.ports[0]} name={e.title} size={48} />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{e.title}</h3>
                  <p className="line-clamp-2 text-[0.8rem] leading-snug text-ink2">{e.summary}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[var(--link)]">
                    <Icon name={kindIcon(e.ports[0].kind)} size={14} />
                    {e.supports?.length ? 'Browse supported games' : 'Open engine'}
                  </p>
                </div>
                <Icon name="chevron" className="text-ink2" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="wrap mt-4">
          <div className="panel flex gap-3 p-4 text-sm text-ink2">
            <Icon name="info" className="mt-0.5 shrink-0 text-[var(--link)]" />
            <p>
              Every port here is unofficial. Re:Port links to each developer's release page and never hosts game files or APKs. Bring your own legally obtained copy of any game that needs one.{' '}
              <Link to="/about" className="font-bold text-[var(--link)] underline">
                How the library works
              </Link>
            </p>
          </div>
        </aside>
      </main>
    </>
  );
}
