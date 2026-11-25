import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Game } from "@/data/ports";
import { resolveArtwork } from "@/lib/artwork";
import { cn } from "@/utils/cn";
import { t } from "@/lib/i18n";

/** Steam serves 1920×1080 originals; lists and heroes only need its 600×338 thumbnail. */
export function thumbShot(url: string): string {
  return url.replace(/\.1920x1080\.jpg/, ".600x338.jpg");
}

/** Artwork fills its frame with no borders. The frame adopts the artwork's own shape once it loads
 *  (clamped so extreme posters and banners stay a sensible size), so nothing is stretched or padded. */
const MIN_RATIO = 0.62, MAX_RATIO = 1.6;
export function GameArt({
  game, className, style, radius = 14, priority = false, shadow = false,
}: {
  game: Game;
  className?: string;
  style?: CSSProperties;
  radius?: number;
  priority?: boolean;
  shadow?: boolean;
}) {
  // Every image the catalog has for this game, best first. A failed one moves to the next.
  // A generated title card (data: URL) is not real artwork, so it is skipped.
  const candidates = useMemo(() => {
    const list = [
      game.cover && !game.cover.startsWith("data:") ? game.cover : "",
      game.hero ?? "",
      game.shots[0] ? thumbShot(game.shots[0]) : "",
      game.readmeShots?.[0] ?? "",
    ];
    return [...new Set(list.filter(Boolean))];
  }, [game]);
  const [pos, setPos] = useState(0);
  // undefined = not looked up yet, null = no keyless match.
  const [keyless, setKeyless] = useState<string | null | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [sawError, setSawError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const exhausted = pos >= candidates.length;
  const src = exhausted ? (keyless || null) : candidates[pos];

  // A different game starts from its first candidate again.
  useEffect(() => {
    setPos(0); setKeyless(undefined); setRound(0); setSawError(false); setFailed(false); setLoaded(false);
  }, [game.id]);

  // Every catalog candidate failed: look up a keyless Steam cover once.
  useEffect(() => {
    if (!exhausted || keyless !== undefined || failed) return;
    let live = true;
    resolveArtwork(game).then((u) => { if (live) setKeyless(u ?? null); }).catch(() => { if (live) setKeyless(null); });
    return () => { live = false; };
  }, [exhausted, keyless, failed, game]);

  useEffect(() => {
    if (!exhausted || keyless === undefined || keyless) return;
    // Nothing to try at all: show the title card straight away.
    if (!sawError) { setFailed(true); return; }
    // Images failed (often a network blip): retry the list a couple of times before giving up.
    if (round >= 2) { setFailed(true); return; }
    const timer = window.setTimeout(() => {
      setPos(0); setKeyless(undefined); setSawError(false); setRound((r) => r + 1);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [exhausted, keyless, round, sawError]);

  const handleError = () => {
    setLoaded(false);
    setSawError(true);
    if (!exhausted) setPos((p) => p + 1);
    else setKeyless(null);
  };

  // The frame uses the catalog's ratio from the first paint and never changes after an image loads.
  // Changing it on load reflowed the whole masonry grid while scrolling. object-cover still fills the frame.
  const shape = Math.min(MAX_RATIO, Math.max(MIN_RATIO, game.coverRatio || 0.75));
  if (failed || !src) {
    return (
      <div className={cn("grid place-items-center overflow-hidden bg-gradient-to-br from-[#3d5a22] to-[#16220e] text-white", className)}
        style={{ borderRadius: radius, aspectRatio: String(shape), ...style }}>
        <span className="px-3 text-center text-[13px] font-semibold leading-tight">{game.title}</span>
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-[#6d9f31] to-[#315321]", className)}
      style={{ borderRadius: radius, aspectRatio: String(shape), boxShadow: shadow ? "0 10px 26px -12px rgba(0,0,0,.5)" : undefined, ...style }}>
      {!loaded && <span className="absolute inset-0 grid place-items-center px-3 text-center text-[13px] font-semibold leading-tight text-white/90">{game.title}</span>}
      <img
        key={src}
        src={src}
        alt={t("{title} cover art", { title: game.title })}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={handleError}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
        className="block h-full w-full object-cover"
      />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[inherit] bg-gradient-to-b from-white/10 to-transparent" />
    </div>
  );
}

/** Screenshots keep their intrinsic size: `width:100%; height:auto`. */
export function GameShot({ src: original, alt, className, radius = 14 }: { src: string; alt: string; className?: string; radius?: number }) {
  const [failed, setFailed] = useState(false);
  const src = thumbShot(original);
  if (failed || !src) return <div className={cn("min-h-[120px] rounded-[14px] bg-black/[0.05]", className)} />;
  return (
    <div className={cn("relative overflow-hidden bg-black/[0.04]", className)} style={{ borderRadius: radius }}>
      <img src={src} alt={alt} draggable={false} loading="lazy" decoding="async" onError={() => setFailed(true)}
        className="anim-image-in block h-auto w-full" />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10" />
    </div>
  );
}
