import { memo } from 'react';
import { CoverImage } from './Cover';
import { Icon } from './Icons';
import { StatusBadge } from './ui';
import { Link } from '../lib/router';
import { collectionById, gameStatus, platformById } from '../lib/catalog';
import type { Game } from '../lib/types';

function subtitle(g: Game): string {
  if (g.platform === 'engine') return 'Engine or launcher';
  return [platformById.get(g.platform)?.name, g.year || ''].filter(Boolean).join('  \u00b7  ');
}

export const GameCard = memo(function GameCard({ game, eager = false, note }: { game: Game; eager?: boolean; note?: string }) {
  const status = gameStatus(game);
  const plat = platformById.get(game.platform);
  return (
    <Link to={`/game/${game.id}`} className="gcard">
      <div className="art">
        <CoverImage game={game} width={240} eager={eager} />
        {plat && (
          <span className="tag-glass right-2 top-2" aria-hidden="true">
            {plat.short}
          </span>
        )}
        {status === 'working' && (
          <span className="tag-glass left-2 top-2 !px-1.5" title="Reported working">
            <Icon name="check" size={13} />
            <span className="sr-only">Works.</span>
          </span>
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 min-h-[2.5em] text-[0.95rem] font-semibold leading-tight">{game.title}</h3>
        <p className="mt-1 truncate text-[0.82rem] text-ink2">{note || subtitle(game)}</p>
      </div>
    </Link>
  );
});

export const RailCard = memo(function RailCard({ game, note }: { game: Game; note?: string }) {
  return (
    <div className="w-[148px] sm:w-[164px]">
      <GameCard game={game} note={note} />
    </div>
  );
});

export const GameRow = memo(function GameRow({ game, rank }: { game: Game; rank?: number }) {
  const genre = game.genres[0] ? collectionById.get(game.genres[0])?.name : '';
  return (
    <Link to={`/game/${game.id}`} className="row-card">
      <div className="relative">
        <div className="art !rounded-xl border border-white/60 shadow">
          <CoverImage game={game} width={160} />
        </div>
        {rank !== undefined && (
          <span className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-xs font-extrabold text-[var(--accent-ink)] shadow ring-2 ring-white">{rank}</span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-semibold leading-tight">{game.title}</h3>
        <p className="mt-0.5 truncate text-xs text-ink2">{[subtitle(game), genre].filter(Boolean).join('  \u00b7  ')}</p>
        {game.summary && <p className="mt-1 line-clamp-2 text-[0.8rem] leading-snug text-ink2">{game.summary}</p>}
        <div className="mt-1.5">
          <StatusBadge status={gameStatus(game)} />
        </div>
      </div>
      <Icon name="chevron" className="text-ink2" />
    </Link>
  );
});
