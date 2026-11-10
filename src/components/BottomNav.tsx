import { Home, Bookmark, Search, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp, type Tab } from "@/state";
import type { TKey } from "@/lib/i18n";

const tabs: { id: Tab; key: TKey; icon: LucideIcon }[] = [
  { id: "home", key: "Home", icon: Home },
  { id: "browse", key: "Browse", icon: Search },
  { id: "library", key: "Library", icon: Bookmark },
  { id: "settings", key: "Settings", icon: Settings },
];

export function BottomNav() {
  const { tab, setTab, t: tr } = useApp();
  const idx = Math.max(0, tabs.findIndex((t) => t.id === tab));
  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 px-3 pb-[calc(var(--sab)+10px)]">
      <div className="glass relative h-[66px] rounded-[22px]">
        <div className="pointer-events-none absolute inset-1.5">
          <div className="absolute inset-y-0 left-0 w-1/4 transition-transform duration-[460ms]" style={{ transform: `translateX(${idx * 100}%)`, transitionTimingFunction: "var(--ease-out-expo)" }}>
            <div className="glass-lime sheen absolute inset-y-0 inset-x-[3px] rounded-[16px]" />
          </div>
        </div>
        <div className="relative z-[2] flex h-full p-1.5">
          {tabs.map((t) => {
            const active = t.id === tab;
            const Icon = t.icon;
            return <button key={t.id} onClick={() => setTab(t.id)} className={cn("press relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] transition-colors duration-300", active ? "text-white" : "text-ink-soft")}>
              <Icon size={21} strokeWidth={active ? 2.5 : 2} />
              <span className={cn("text-[10px] font-semibold tracking-wide", active && "t-shadow")}>{tr(t.key)}</span>
            </button>;
          })}
        </div>
      </div>
    </nav>
  );
}
