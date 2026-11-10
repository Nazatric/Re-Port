import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { t } from "@/lib/i18n";

export interface Blade { id: string; title: string; subtitle: string; icon: LucideIcon; action: string; onOpen: () => void }
const COLLAPSED = 40;
const STEP = 34;

/** Keep card geometry fixed during the animation: only position, clipping and opacity change. */
export function BladeStack({ blades }: { blades: Blade[] }) {
  const [sel, setSel] = useState(0);
  const [width, setWidth] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const n = blades.length;
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const expandedWidth = Math.max(COLLAPSED, width - (n - 1) * STEP);
  return (
    <div className="relative pb-14 pt-2">
      <div className="blade-floor pointer-events-none absolute inset-x-0 bottom-0 h-[140px]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.75) 55%, rgba(255,255,255,.95))" }} />
      <div ref={stage} className="relative mx-4 h-[150px]" style={{ perspective: 900, overflow: "clip", overflowClipMargin: 12 }}>
        {width > 0 && blades.map((b, i) => {
          const active = i === sel;
          const Icon = b.icon;
          const x = i <= sel ? i * STEP : width - COLLAPSED - (n - 1 - i) * STEP;
          return (
            <div key={b.id} className="blade-tile pointer-events-none absolute inset-y-0 left-0"
              style={{ width: expandedWidth, zIndex: active ? 50 : 40 - i, transform: `translate3d(${x}px,0,0) ${active ? "rotateY(0deg)" : i < sel ? "rotateY(14deg) scale(.96)" : "rotateY(-14deg) scale(.96)"}`, transformOrigin: "left center" }}>
              <div className="blade-surface glass-lime sheen absolute inset-0 rounded-[12px]"
                style={{ clipPath: active ? "inset(0 0 0 0 round 12px)" : `inset(0 ${expandedWidth - COLLAPSED}px 0 0 round 12px)` }} />
              <button type="button" aria-label={active ? t("{title}: {action}", { title: b.title, action: b.action }) : t("Select {title}", { title: b.title })}
                onClick={() => { if (active) b.onOpen(); else setSel(i); }}
                className="pointer-events-auto absolute inset-y-0 left-0 z-[2] cursor-pointer text-left"
                style={{ width: active ? expandedWidth : COLLAPSED }}>
                <div className={cn("absolute inset-y-0 left-0 flex w-10 items-center justify-center transition-opacity duration-200", active ? "opacity-0" : "opacity-100")}><Icon size={20} strokeWidth={2.3} className="text-white drop-shadow" /></div>
                <div className={cn("absolute inset-0 flex flex-col justify-between p-3.5 transition-opacity duration-200", active ? "opacity-100 delay-100" : "pointer-events-none opacity-0")}>
                  <div className="flex items-start justify-between">
                    <span className="icon-gloss grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-white to-[#e4f3c8] text-lime-deep"><Icon size={21} strokeWidth={2.3} className="relative z-[1]" /></span>
                    <span className="text-[11px] font-semibold text-white/90 tabular-nums">{t("{i} of {n}", { i: i + 1, n })}</span>
                  </div>
                  <div className="min-w-0"><div className="t-shadow truncate text-[18px] font-semibold leading-tight text-white">{b.title}</div><div className="truncate text-[11.5px] text-white/90">{b.subtitle}</div></div>
                  <div className="flex items-center gap-2"><span className="glass sheen inline-flex h-8 items-center gap-1 rounded-full pl-3 pr-2 text-[12px] font-semibold text-lime-deep"><span className="relative z-[2]">{b.action}</span><ChevronRight size={14} strokeWidth={3} className="relative z-[2]" /></span></div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
