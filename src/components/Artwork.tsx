import { useEffect, useState, type CSSProperties } from "react";
import type { Game } from "@/data/ports";
import { cn } from "@/utils/cn";
import { findArtwork } from "@/lib/artwork";
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
  const placeholder = !game.cover || game.cover.startsWith("data:") || game.cover.includes("/covers/generated/");
  // Candidates in order: the bundled cover first, then art found on the device for games without one.
  const [candidates, setCandidates] = useState<string[]>(() => (placeholder ? [] : [game.cover]));
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setIndex(0); setLoaded(false); setMeasured(null);
    setCandidates(placeholder ? [] : [game.cover]);
    if (!placeholder) return () => { live = false; };
    findArtwork(game).then((found) => {
      if (!live) return;
      setCandidates(found?.cover ?? []);
    }).catch(() => { if (live) setCandidates([]); });
    return () => { live = false; };
  }, [game, placeholder]);

  const src = candidates[index];
  const failed = !src;
  const handleError = () => { setLoaded(false); setIndex((i) => i + 1); };

  if (failed) {
    return (
      <div className={cn("grid place-items-center overflow-hidden bg-gradient-to-br from-[#3d5a22] to-[#16220e] text-white", className)}
        style={{ borderRadius: radius, aspectRatio: String(game.coverRatio || 0.75), ...style }}>
        <span className="px-3 text-center text-[13px] font-semibold leading-tight">{game.title}</span>
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-[#6d9f31] to-[#315321]", className)}
      style={{ borderRadius: radius, aspectRatio: String(measured || game.coverRatio || 0.75), boxShadow: shadow ? "0 10px 26px -12px rgba(0,0,0,.5)" : undefined, ...style }}>
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
        onLoad={(e) => { setLoaded(true); const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setMeasured(im.naturalWidth / im.naturalHeight); }}
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
