import { useEffect, useRef, useState, type PointerEvent } from "react";
import { primaryPort, type Game } from "@/data/ports";
import { useApp } from "@/state";
import { cn } from "@/utils/cn";
import { GameArt } from "./Artwork";

const HEIGHT = 164;
const SPACING = 62;
const CENTER_GAP = 72;
const PX_PER_ITEM = 130;

/** Native aspect-ratio cover flow: each tile keeps its own width/height ratio. */
export function CoverFlow({ games, onOpen }: { games: Game[]; onOpen: (g: Game) => void }) {
  const { settings, haptic } = useApp();
  const start = Math.min(2, games.length - 1);
  const [index, setIndex] = useState(start);
  const [pos, setPos] = useState(start);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startPos: number; moved: boolean; target: number | null } | null>(null);
  const last = games.length - 1;

  const settle = (i: number) => {
    const c = Math.max(0, Math.min(last, i));
    if (c !== index) haptic();
    setIndex(c); setPos(c);
  };
  useEffect(() => {
    if (!settings.autoplay || dragging) return;
    const t = setInterval(() => setIndex((i) => { const n = i >= last ? 0 : i + 1; setPos(n); return n; }), 4200);
    return () => clearInterval(t);
  }, [settings.autoplay, dragging, last]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-idx]");
    drag.current = { startX: e.clientX, startPos: pos, moved: false, target: t ? Number(t.dataset.idx) : null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 8) { d.moved = true; setDragging(true); }
    if (d.moved) setPos(Math.max(-0.45, Math.min(last + 0.45, d.startPos - dx / PX_PER_ITEM)));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) { setDragging(false); settle(Math.round(pos)); return; }
    const dy = 0;
    if (d.target !== null && Math.abs(e.clientX - d.startX) < 10 && Math.abs(dy) === 0) {
      if (d.target === index) { haptic(); onOpen(games[index]); }
      else settle(d.target);
    }
  };

  const cur = games[index];
  const tileWidth = (g: Game) => Math.max(108, Math.min(230, Math.round(HEIGHT * g.coverRatio)));

  return (
    <div className="select-none">
      <div className="relative mx-auto w-full" style={{ height: HEIGHT + (settings.reflections ? 90 : 20), perspective: 1000, perspectiveOrigin: "50% 40%", touchAction: "pan-y" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
        {games.map((g, i) => {
          const o = i - pos, ao = Math.abs(o);
          if (ao > 3.6) return null;
          const c = Math.max(-1, Math.min(1, o));
          const w = tileWidth(g);
          const x = o * SPACING + c * CENTER_GAP;
          const z = -Math.min(ao, 1) * 130 - Math.max(ao - 1, 0) * 26;
          const scale = 1 - Math.min(ao, 1) * 0.1;
          return (
            <div key={g.id} data-idx={i} className={cn("preserve-3d backface-hidden absolute top-2 cursor-pointer", !dragging && "transition-transform duration-[560ms]")}
              style={{ left: "50%", width: w, marginLeft: -w / 2, zIndex: 100 - Math.round(ao * 10), transform: `translate3d(${x}px,0,${z}px) rotateY(${-c * 58}deg) scale(${scale})`, transitionTimingFunction: "var(--ease-out-expo)" }}>
              <GameArt game={g} radius={10} priority={i === index} className="w-full" style={{ height: HEIGHT, aspectRatio: "auto" }} />
              {settings.reflections && (
                <div className="pointer-events-none mt-[3px] overflow-hidden" style={{ height: HEIGHT * 0.5, WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,.4), rgba(0,0,0,0) 88%)", maskImage: "linear-gradient(to bottom, rgba(0,0,0,.4), rgba(0,0,0,0) 88%)" }}>
                  <div style={{ height: HEIGHT, transform: "scaleY(-1)" }}><GameArt game={g} radius={10} className="w-full" style={{ height: HEIGHT, aspectRatio: "auto" }} /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div key={cur.id} className="anim-rise -mt-1 px-6 text-center">
        <div className="t-white-shadow truncate text-[17px] font-semibold tracking-tight text-ink">{cur.title}</div>
        <div className="truncate text-[12px] text-ink-soft">{primaryPort(cur).name} · {cur.platform}</div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {games.map((g, i) => <button key={g.id} onClick={() => settle(i)} className="h-[6px] rounded-full transition-all duration-300" style={{ width: i === index ? 18 : 6, background: i === index ? "#5f9f22" : "rgba(0,0,0,.18)" }} aria-label={`Go to ${g.title}`} />)}
      </div>
    </div>
  );
}
