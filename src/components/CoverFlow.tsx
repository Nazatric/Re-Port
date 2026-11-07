import { useId, useMemo } from 'react';
import { CoverImage } from './Cover';
import { Icon } from './Icons';
import { useCoverFlow } from './useCoverFlow';
import { Link, navigate } from '../lib/router';
import { haptic } from '../lib/ui';
import { platformById } from '../lib/catalog';
import type { Game } from '../lib/types';
import './cover-flow.css';

function CoverFlowView({ items }: { items: Game[] }) {
  const { viewport, selected, settled, go, step, blocksClick } = useCoverFlow(items.length);
  const captionId = useId();
  const viewportId = useId();
  const current = items[selected];

  const move = (direction: number) => {
    step(direction);
    haptic(6);
  };

  return (
    <section className="coverflow" aria-label="Featured ports" aria-roledescription="carousel" data-selected={selected} data-settled={settled}>
      <div
        id={viewportId}
        ref={viewport}
        className="coverflow-viewport"
        role="group"
        aria-label="Game covers. Swipe, drag, or use the left and right arrow keys."
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.altKey || e.ctrlKey || e.metaKey) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            move(e.key === 'ArrowRight' ? 1 : -1);
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            go(e.key === 'Home' ? 0 : items.length - 1);
          } else if (e.key === 'Enter' && e.target === e.currentTarget) {
            e.preventDefault();
            navigate(`/game/${current.id}`);
          }
        }}
        onClickCapture={(e) => {
          if (blocksClick() && e.detail !== 0) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {items.map((game, i) => (
          <div key={game.id} className="coverflow-slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}`}>
            <Link
              to={`/game/${game.id}`}
              className="coverflow-cover"
              data-active={i === selected}
              tabIndex={i === selected ? 0 : -1}
              aria-label={i === selected ? `View ${game.title}` : `Select ${game.title}`}
              draggable={false}
              onClick={(e) => {
                if (i !== selected && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  go(i);
                }
              }}
            >
              <CoverImage game={game} width={900} eager={Math.abs(i - selected) <= 2} sizes="(min-width: 520px) 248px, 52vw" />
            </Link>
          </div>
        ))}
      </div>

      <div className="coverflow-footer">
        <div id={captionId} className="coverflow-caption">
          {/* Hidden captions reserve the longest title's height, so the controls never jump. */}
          {items.map((game, i) => (
            <div key={game.id} className="coverflow-caption-item" data-active={i === selected} aria-hidden={i !== selected}>
              <h2 className="coverflow-title">{game.title}</h2>
              <p className="coverflow-meta">{[game.year, platformById.get(game.platform)?.name].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
        </div>

        <div className="coverflow-actions">
          <button type="button" className="btn-glass coverflow-arrow" aria-label="Previous featured port" aria-controls={viewportId} disabled={selected === 0} onClick={() => move(-1)}>
            <Icon name="chevronLeft" />
          </button>
          <Link to={`/game/${current.id}`} className="btn-a small coverflow-details" aria-describedby={captionId}>
            <span className="orb"><Icon name="chevron" size={18} /></span>
            <span>View details</span>
          </Link>
          <button type="button" className="btn-glass coverflow-arrow" aria-label="Next featured port" aria-controls={viewportId} disabled={selected === items.length - 1} onClick={() => move(1)}>
            <Icon name="chevron" />
          </button>
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {items[settled]?.title}. {settled + 1} of {items.length}.
      </span>
    </section>
  );
}

export function CoverFlow({ items }: { items: Game[] }) {
  const unique = useMemo(() => Array.from(new Map(items.map((game) => [game.id, game])).values()), [items]);
  if (!unique.length) return null;
  // Reset only when the actual selection changes, not when a parent creates a new array.
  return <CoverFlowView key={unique.map((game) => game.id).join('|')} items={unique} />;
}
