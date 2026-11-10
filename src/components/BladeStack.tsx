import { useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export interface Blade { id: string; title: string; subtitle: string; icon: LucideIcon; action: string; onOpen: () => void }
const COLLAPSED = 40;

/** NXE-style blades. Width changes are transform-driven (scaleX on an inner tile)
 *  so accordion motion never triggers layout reflow in the middle of a scroll. */
export function BladeStack({ blades }: { blades: Blade[] }) {
  const [sel, setSel] = useState(0);
  const n = blades.length;
  return (
    <div className="relative pb-14 pt-2">
      <div className="blade-floor pointer-events-none absolute inset-x-0 bottom-0 h-[140px]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.75) 55%, rgba(255,255,255,.95))" }} />
      <div className="relative flex h-[150px] items-stretch px-4" style={{ perspective: 900 }}>
        {blades.map((b, i) => {
          const active = i === sel;
          const Icon = b.icon;
          return (
            <div key={b.id}
              onClick={() => { if (active) b.onOpen(); else setSel(i); }}
              className="glass-lime sheen press relative cursor-pointer overflow-hidden rounded-[12px] transition-[flex-grow,transform] duration-[520ms]"
              style={{
                flexGrow: active ? 1 : 0, flexBasis: COLLAPSED, minWidth: COLLAPSED,
                marginLeft: i === 0 ? 0 : -6, zIndex: active ? 50 : 40 - i,
                transform: active ? "rotateY(0deg) scale(1)" : i < sel ? "rotateY(14deg) scale(.96)" : "rotateY(-14deg) scale(.96)",
                transformOrigin: i < sel ? "right center" : "left center",
                transitionTimingFunction: "var(--ease-out-expo)",
              }}>
              <div className={cn("absolute inset-0 z-[2] flex items-center justify-center transition-opacity duration-300", active ? "opacity-0" : "opacity-100")}><Icon size={20} strokeWidth={2.3} className="text-white drop-shadow" /></div>
              <div className={cn("absolute inset-0 z-[2] flex flex-col justify-between p-3.5 transition-opacity duration-300", active ? "opacity-100 delay-150" : "pointer-events-none opacity-0")}>
                <div className="flex items-start justify-between">
                  <span className="icon-gloss grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-white to-[#e4f3c8] text-lime-deep"><Icon size={21} strokeWidth={2.3} className="relative z-[1]" /></span>
                  <span className="text-[11px] font-semibold text-white/90 tabular-nums">{i + 1} of {n}</span>
                </div>
                <div className="min-w-0"><div className="t-shadow truncate text-[18px] font-semibold leading-tight text-white">{b.title}</div><div className="truncate text-[11.5px] text-white/90">{b.subtitle}</div></div>
                <div className="flex items-center gap-2"><span className="glass sheen inline-flex h-8 items-center gap-1 rounded-full pl-3 pr-2 text-[12px] font-semibold text-lime-deep"><span className="relative z-[2]">{b.action}</span><ChevronRight size={14} strokeWidth={3} className="relative z-[2]" /></span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
