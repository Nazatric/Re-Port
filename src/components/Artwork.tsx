import { useEffect, useState, type CSSProperties } from "react";
import type { Game } from "@/data/ports";
import { resolveArtwork } from "@/lib/artwork";
import { cn } from "@/utils/cn";
import { t } from "@/lib/i18n";

/** Steam serves 1920×1080 originals; lists and heroes only need its 600×338 thumbnail. */
export function thumbShot(url: string): string {
  return url.replace(/\.1920x1080\.jpg/, ".600x338.jpg");
}

/** Renders artwork at its real measured aspect ratio — no crops, no letterboxing.
 *  The URL is never upscaled by the browser: the element is constrained by the
 *  container width and the intrinsic ratio, so the CDN serves its native size. */
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
  const [src, setSrc] = useState(game.cover);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Games without a bundled cover resolve one from the keyless artwork sources once, then show it.
  useEffect(() => {
    if (game.cover) return;
    let live = true;
    resolveArtwork(game).then((url) => { if (!live) return; if (url) setSrc(url); else setFailed(true); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [game]);

  const handleError = async () => {
    if (retrying || failed) return;
    setRetrying(true);
    try {
      const next = await resolveArtwork(game);
      if (next && next !== src) { setLoaded(false); setSrc(next); }
      else setFailed(true);
    } catch { setFailed(true); } finally { setRetrying(false); }
  };

  if (failed || !src) {
    return (
      <div className={cn("grid place-items-center overflow-hidden bg-gradient-to-br from-[#3d5a22] to-[#16220e] text-white", className)}
        style={{ borderRadius: radius, aspectRatio: String(game.coverRatio || 0.75), ...style }}>
        <span className="px-3 text-center text-[13px] font-semibold leading-tight">{game.title}</span>
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-[#6d9f31] to-[#315321]", className)}
      style={{ borderRadius: radius, aspectRatio: String(game.coverRatio || 0.75), boxShadow: shadow ? "0 10px 26px -12px rgba(0,0,0,.5)" : undefined, ...style }}>
      {!loaded && <span className="absolute inset-0 grid place-items-center px-3 text-center text-[13px] font-semibold leading-tight text-white/90">{game.title}</span>}
      <img
        src={src}
        alt={t("{title} cover art", { title: game.title })}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={handleError}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
        className="block h-full w-full object-fill"
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
