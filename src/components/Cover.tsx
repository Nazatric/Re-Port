import { createContext, memo, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { coverCandidates, avatarSrc, retryUrl, type ImageCandidate } from '../lib/images';
import { hashString, initials } from '../lib/format';
import { platformById } from '../lib/catalog';
import type { Game } from '../lib/types';
import { cn } from '../utils/cn';

export const DataSaverContext = createContext(false);

const HUES = [96, 118, 142, 168, 192, 212, 236, 28, 42];

export function GeneratedArt({ title, platform, className }: { title: string; platform: string; className?: string }) {
  const h = hashString(title);
  const hue = HUES[h % HUES.length];
  const short = platformById.get(platform)?.short ?? '';
  return (
    <div
      role="img"
      aria-label={`${title} placeholder artwork`}
      className={cn('absolute inset-0 flex flex-col items-center justify-center overflow-hidden text-white', className)}
      style={{ background: `radial-gradient(120% 80% at 20% 0%, hsl(${hue} 70% 62%), transparent 60%), linear-gradient(170deg, hsl(${hue} 62% 36%), hsl(${(hue + 24) % 360} 66% 14%))` }}
    >
      <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" />
      <span className="absolute -left-8 bottom-6 h-28 w-28 rounded-full bg-white/10" />
      <span className="relative text-[2.4rem] font-light leading-none tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]">{initials(title)}</span>
      {short && <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-xs font-bold tracking-wider">{short}</span>}
    </div>
  );
}

/**
 * Fills its (relatively positioned) parent with the game's cover art.
 * Each candidate gets one retry (transient CDN or network errors are common on mobile), then the next
 * candidate is tried. When every candidate fails the card shows generated art instead of a blank tile.
 */
export const CoverImage = memo(function CoverImage({ game, width = 240, fit = 'cover', eager = false, alt = '', sizes }: { game: Game; width?: number; fit?: 'cover' | 'contain'; eager?: boolean; alt?: string; sizes?: string }) {
  const saver = useContext(DataSaverContext);
  const candidates = useMemo(() => (saver ? [] : coverCandidates(game, width)), [game, width, saver]);
  return <CoverPicture key={`${game.id}:${saver}:${candidates.map((c) => c.src).join('|')}`} game={game} candidates={candidates} width={width} fit={fit} eager={eager} alt={alt} sizes={sizes} />;
});

function CoverPicture({ game, candidates, width, fit, eager, alt, sizes }: {
  game: Game; candidates: ImageCandidate[]; width: number; fit: 'cover' | 'contain'; eager: boolean; alt: string; sizes?: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [i, setI] = useState(0);
  const [retried, setRetried] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const c = candidates[i];

  // Cached images can finish before React attaches onLoad. Do not leave them transparent.
  useLayoutEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
  }, [c?.src, retried]);

  if (!c) return <GeneratedArt title={game.title} platform={game.platform} />;
  return (
    <>
      {!loaded && <span className="art-skel" aria-hidden="true" />}
      <img
        ref={image}
        key={`${c.src}-${retried ? 'r' : 'o'}`}
        src={retried ? retryUrl(c.src) : c.src}
        srcSet={retried ? undefined : c.srcSet}
        sizes={sizes ?? `${Math.round(width)}px`}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        crossOrigin={c.cors ? 'anonymous' : undefined}
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          if (!retried) {
            setRetried(true);
          } else {
            setRetried(false);
            setI((n) => n + 1);
          }
        }}
        style={{ objectFit: fit, opacity: loaded ? 1 : 0 }}
      />
    </>
  );
}

/** Small round developer avatar (GitHub owner picture), falling back to initials. */
export function Avatar({ owner, name, size = 40 }: { owner?: string; name: string; size?: number }) {
  const saver = useContext(DataSaverContext);
  const [failed, setFailed] = useState(false);
  const show = owner && !failed && !saver;
  const hue = HUES[hashString(name) % HUES.length];
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 text-xs font-bold text-white shadow"
      style={{ width: size, height: size, background: `linear-gradient(160deg, hsl(${hue} 60% 42%), hsl(${hue} 66% 22%))` }}
      aria-hidden="true"
    >
      {show ? <img src={avatarSrc(owner!, size * 2)} alt="" loading="lazy" decoding="async" crossOrigin="anonymous" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : initials(name).slice(0, 2)}
    </span>
  );
}
