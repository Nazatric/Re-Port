import { useContext, useEffect, useMemo, useState } from 'react';
import { CoverImage, DataSaverContext } from '../components/Cover';
import { GameCard, RailCard } from '../components/GameCard';
import { Icon } from '../components/Icons';
import { DownloadButton, Fact, PortCard, ReleaseCard } from '../components/PortParts';
import { ScreenshotImage } from '../components/ScreenshotImage';
import { BackButton, Pill, SectionHeader, StatusBadge, ImageViewer } from '../components/ui';
import NotFound from './NotFound';
import { Link } from '../lib/router';
import { bestPort, collectionById, controllerLabel, engineOf, filesLabel, gameById, gameStatus, githubRepo, linkMeta, platformById, platformIdsOf, portName, related, STATUS_META } from '../lib/catalog';
import { gameScreenshots, heroCandidates } from '../lib/images';
import { formatDate, timeAgo } from '../lib/format';
import { addRecent, toggleFavorite, useFavorites } from '../lib/store';
import { haptic, shareLink, showToast } from '../lib/ui';
import type { Game } from '../lib/types';

function Backdrop({ game }: { game: Game }) {
  const saver = useContext(DataSaverContext);
  const candidates = useMemo(() => (saver ? [] : heroCandidates(game)), [game, saver]);
  const [i, setI] = useState(0);
  const hero = candidates[i];
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--hero-1), var(--hero-2))' }} />
      {hero ? (
        <img key={hero.src} src={hero.src} alt="" crossOrigin={hero.cors ? "anonymous" : undefined} decoding="async" onError={() => setI((n) => n + 1)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        !saver && (
          <div className="fill absolute -inset-10 opacity-80 blur-2xl saturate-150">
            <CoverImage game={game} width={160} />
          </div>
        )
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,18,3,.62) 0%, rgba(6,18,3,.52) 62%, var(--bg) 100%)' }} />
    </div>
  );
}

function Shot({ src, index, onOpen }: { src: string; index: number; onOpen: (i: number) => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <button type="button" onClick={() => onOpen(index)} aria-label={`Open screenshot ${index + 1}`} className="relative block h-[132px] w-[235px] shrink-0 overflow-hidden rounded-xl border-2 border-white/80 bg-[#1b2a12] shadow-[0_6px_14px_var(--shadow-c)] active:scale-[0.97]">
      <ScreenshotImage src={src} alt="" onFailure={() => setFailed(true)} className="h-full w-full object-cover" />
    </button>
  );
}

function DetailView({ game }: { game: Game }) {
  const { has } = useFavorites();
  const [viewer, setViewer] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const primary = bestPort(game);
  const status = gameStatus(game);
  const gamePlatforms = platformIdsOf(game).map((id) => platformById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const isEngine = game.platform === 'engine';
  const saved = has(game.id);
  const meta = linkMeta(primary);
  const engine = engineOf(game);
  const more = useMemo(() => related(game, 12), [game]);
  const supports = useMemo(() => (game.supports || []).map((id) => gameById.get(id)).filter((g): g is Game => Boolean(g)), [game]);
  const githubPort = game.ports.find((p) => githubRepo(p));
  const shots = useMemo(() => gameScreenshots(game), [game]);
  const paragraphs = (game.description || game.summary || '').split('\n\n').filter(Boolean);
  const developers = [...new Set(game.ports.map((p) => p.developer).filter(Boolean))];

  useEffect(() => addRecent(game.id), [game.id]);

  return (
    <>
      <header className="relative overflow-hidden text-white">
        <Backdrop game={game} />
        <div className="wrap relative pb-14 pt-[calc(env(safe-area-inset-top)+14px)]">
          <div className="flex items-center justify-between">
            <BackButton fallback="/library" />
            <div className="flex gap-2">
              <button
                type="button"
                className="icon-btn"
                aria-pressed={saved}
                aria-label={saved ? `Remove ${game.title} from saved` : `Save ${game.title}`}
                onClick={() => {
                  haptic(10);
                  showToast(toggleFavorite(game.id) ? 'Saved to your list' : 'Removed from your list');
                }}
              >
                <Icon name={saved ? 'saved' : 'savedOff'} />
              </button>
              <button type="button" className="icon-btn" aria-label={`Share ${game.title}`} onClick={() => shareLink(game.title, `${game.title} - unofficial Android port`, primary.download)}>
                <Icon name="share" />
              </button>
            </div>
          </div>
          <div className="mt-6 flex gap-4">
            <div className="w-[128px] shrink-0 sm:w-[168px]">
              <div className="art !rounded-lg border-[3px] border-white/90 shadow-[0_16px_30px_rgba(0,0,0,.55)]">
                <CoverImage game={game} width={360} eager alt={`${game.title} cover art`} />
              </div>
            </div>
            <div className="min-w-0 flex-1 self-end">
              <div className="flex flex-wrap gap-1.5">
                {isEngine ? (
                  <span className="inline-flex min-h-[30px] items-center rounded-full border border-white/50 bg-white/20 px-3 text-xs font-bold">Engine or Launcher</span>
                ) : gamePlatforms.map((p) => (
                  <Link key={p.id} to="/library" params={{ platform: p.id }} className="inline-flex min-h-[30px] items-center rounded-full border border-white/50 bg-white/20 px-3 text-xs font-bold">
                    {p.name}
                  </Link>
                ))}
              </div>
              <h1 id="page-title" tabIndex={-1} className="mt-2 text-[1.65rem] font-semibold leading-[1.1] outline-none [overflow-wrap:anywhere] [text-shadow:0_2px_10px_rgba(0,0,0,.55)] sm:text-4xl">
                {game.title}
              </h1>
              <p className="mt-1.5 text-sm text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,.5)]">{[game.year, developers.slice(0, 2).join(', ')].filter(Boolean).join('  \u00b7  ')}</p>
            </div>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="wrap safe-bottom -mt-9 space-y-7 outline-none">
        <section className="panel relative z-10 p-4" aria-label="Download">
          <DownloadButton port={primary} gameTitle={game.title} />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={status} />
            <Pill icon="gamepad">{controllerLabel(primary)}</Pill>
            {game.ports.length > 1 && (
              <button type="button" onClick={() => document.getElementById('ports')?.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'reduce' ? 'auto' : 'smooth' })} className="badge badge-plain !cursor-pointer underline">
                Compare Ports
              </button>
            )}
          </div>
          {meta.warnings.map((w) => (
            <p key={w} className="mt-3 flex gap-2 text-sm font-medium text-[var(--warn)]">
              <Icon name="warn" size={18} className="mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </section>

        <section aria-label="Quick facts" className="panel grid gap-4 p-4 sm:grid-cols-2">
          <Fact icon="verified" label="Compatibility" value={STATUS_META[status].label} note={primary.notes || STATUS_META[status].hint} />
          <Fact icon="gamepad" label="Controls" value={controllerLabel(primary)} />
          <Fact icon="folder" label="Game files" value={filesLabel(primary)} note={primary.filesNote} />
          {primary.updated || primary.added ? <Fact icon="calendar" label="Last update" value={formatDate(primary.updated || primary.added)} note={[primary.version, timeAgo(primary.updated || primary.added)].filter(Boolean).join('  \u00b7  ')} /> : <Fact icon="calendar" label="Last update" value="Not listed" />}
          {engine && <Fact icon="chip" label="Runs on" value={engine.title} />}
        </section>

        <section aria-labelledby="h-about">
            <h2 id="h-about" className="section-title mb-3">
            About
          </h2>
          <div className="panel p-4">
            {paragraphs.length ? (
              <div className={expanded ? '' : 'line-clamp-6'}>
                {paragraphs.map((p, i) => (
                  <p key={i} className="mb-3 text-[0.95rem] leading-relaxed last:mb-0">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink2">No description is available for this entry yet.</p>
            )}
            {paragraphs.join(' ').length > 330 && (
              <button type="button" className="mt-2 flex min-h-[44px] items-center gap-1 text-sm font-bold text-[var(--link)]" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : 'Read more'}
                <Icon name="down" size={18} className={expanded ? 'rotate-180' : ''} />
              </button>
            )}
            {game.genres.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Collections">
                {game.genres.map((id) => (
                  <li key={id}>
                    <Link to="/library" params={{ genre: id }} className="chip !min-h-[38px]">
                      {collectionById.get(id)?.name ?? id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink2">
              {game.descSource === 'wikipedia' ? 'Description from Wikipedia, licensed CC BY-SA 4.0.' : game.launchbox ? 'Game details from the LaunchBox Games Database.' : ''}
              {game.steam ? ' Artwork from the Steam store.' : ''}
              {game.genreSource === 'OpenGameDB' ? ' Genres: OpenGameDB (MIT).' : game.genreSource ? ' Genres: curated from published game information.' : ''}
            </p>
          </div>
        </section>

        {shots.length > 0 && (
          <section aria-labelledby="h-shots" className="-mx-4">
            <div className="wrap">
              <h2 id="h-shots" className="section-title">
                Screenshots
              </h2>
              <p className="mt-2 text-xs text-ink2">{game.shotNote || 'Images from the original game or a community port; appearance may vary by version.'} Other available images can come from Steam, Libretro or community projects.</p>
            </div>
            <div className="rail">
              {shots.map((s, i) => (
                <Shot key={s} src={s} index={i} onOpen={setViewer} />
              ))}
            </div>
          </section>
        )}

        {isEngine && supports.length > 0 && (
          <section aria-labelledby="h-sup">
            <h2 id="h-sup" className="section-title mb-3">
              Supported Games
            </h2>
            <div className="grid-games">
              {supports.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          </section>
        )}

        <section id="ports" aria-labelledby="h-ports" className="scroll-mt-4">
          <h2 id="h-ports" className="section-title mb-3">
            Available Ports
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {game.ports.map((p, i) => (
              <PortCard key={`${p.url}-${i}`} port={p} gameTitle={game.title} engine={p.engine ? (gameById.get(p.engine) ? { id: p.engine, title: gameById.get(p.engine)!.title } : undefined) : undefined} />
            ))}
          </div>
        </section>

        {githubPort && <ReleaseCard port={githubPort} />}

        <section aria-labelledby="h-before" className="panel p-4">
          <h2 id="h-before" className="mb-3 text-lg font-bold">
            Before you install
          </h2>
          <ul className="space-y-3 text-sm leading-snug">
            <li className="flex gap-3">
              <Icon name="folder" size={20} className="mt-0.5 shrink-0 text-[var(--link)]" />
              {primary.files === 'none' ? 'This port does not need extra game files.' : 'Have your own legally obtained copy of the game ready. Ports do not include it, and Re:Port does not host game files.'}
            </li>
            <li className="flex gap-3">
              <Icon name="download" size={20} className="mt-0.5 shrink-0 text-[var(--link)]" />
              Android may ask you to allow installs from your browser or file manager. Allow it only for the app you are downloading with.
            </li>
            <li className="flex gap-3">
              <Icon name="info" size={20} className="mt-0.5 shrink-0 text-[var(--link)]" />
              This is an unofficial project. Read the developer's notes, and report bugs to them first.
            </li>
          </ul>
          <Link to="/submit" params={{ mode: 'report', title: game.title }} className="btn-glass mt-4 w-full">
            <Icon name="warn" size={18} />
            Report a problem or broken link
          </Link>
        </section>

        {more.length > 0 && (
          <section aria-labelledby="h-more" className="-mx-4">
            <SectionHeader id="h-more" title="More Like This" />
            <div className="rail">
              {more.map((g) => (
                <RailCard key={g.id} game={g} />
              ))}
            </div>
          </section>
        )}
      </main>

      {viewer !== null && <ImageViewer images={shots} index={viewer} title={game.title} onClose={() => setViewer(null)} />}
    </>
  );
}

export default function Detail({ id }: { id: string }) {
  const game = gameById.get(id);
  if (!game) return <NotFound title="That game is not in the library" text="The link may be old or mistyped. Try searching for it." />;
  return <DetailView key={game.id} game={game} />;
}

export { portName };
