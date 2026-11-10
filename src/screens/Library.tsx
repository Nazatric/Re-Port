import { useState } from "react";
import { Bookmark, Clock, Heart, X } from "lucide-react";
import { games, gameById, primaryPort, type Game } from "@/data/ports";
import { useApp } from "@/state";
import { GameArt } from "@/components/Artwork";
import { TapSurface } from "@/components/TapSurface";
import { EmptyState, Glass, SectionHeader } from "@/components/ui";
import { cn } from "@/utils/cn";

type Seg = "saved" | "recent";

export function Library() {
  const { saved, toggleSaved, recent, push, setTab } = useApp();
  const [seg, setSeg] = useState<Seg>("saved");
  const savedGames = [...saved].map(gameById).filter((g): g is Game => !!g);
  const recentGames = recent.map(gameById).filter((g): g is Game => !!g);
  const list = seg === "saved" ? savedGames : recentGames;

  return <div className="v-scroll h-full overflow-y-auto pb-[116px]">
    <header className="px-5 pt-[calc(var(--sat)+16px)]">
      <h1 className="t-light t-white-shadow text-[34px] leading-none text-ink">Library</h1>
      <div className="mt-1.5 text-[12.5px] text-ink-soft tabular-nums">{saved.size} saved · {recent.length} recently viewed</div>
    </header>
    <div className="mt-4 px-4">
      <div className="glass flex h-10 rounded-full p-1">
        {([["saved", `Saved ${saved.size}`], ["recent", `Recent ${recentGames.length}`]] as [Seg, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setSeg(v)} className={cn("press relative z-[2] flex flex-1 items-center justify-center rounded-full text-[12.5px] font-semibold transition-colors", seg === v ? "glass-lime sheen text-white" : "text-ink-soft")}>{label}</button>
        ))}
      </div>
    </div>
    {list.length === 0 ? (
      <EmptyState icon={seg === "saved" ? Bookmark : Clock} title={seg === "saved" ? "Nothing saved yet" : "No history yet"}
        subtitle={seg === "saved" ? "Tap the heart on a port to keep it here." : "Ports you open show up here for quick access."}>
        <button onClick={() => setTab("browse")} className="glass-lime sheen press h-10 rounded-full px-5 text-[13px] font-semibold text-white">Browse catalog</button>
      </EmptyState>
    ) : (
      <section className="mt-4 px-4">
        <SectionHeader title={seg === "saved" ? "Saved ports" : "Recently viewed"} />
        <Glass className="divide-y divide-black/[0.06] p-1.5">
          {list.map((g) => (
            <div key={g.id} className="relative z-[2] flex items-center gap-3 p-2">
              <TapSurface onTap={() => push({ type: "game", id: g.id })} className="shrink-0"><GameArt game={g} radius={10} className="w-[54px]" /></TapSurface>
              <TapSurface onTap={() => push({ type: "game", id: g.id })} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[13.5px] font-semibold text-ink">{g.title}</div>
                <div className="truncate text-[11.5px] text-ink-soft">{primaryPort(g).name} · {g.platform}</div>
              </TapSurface>
              <button onClick={() => toggleSaved(g.id)} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full" aria-label={seg === "saved" ? "Remove" : "Save"}>
                {seg === "saved" ? <X size={16} className="text-ink-soft" /> : <Heart size={16} className={saved.has(g.id) ? "text-[#e0452f]" : "text-ink-soft"} fill={saved.has(g.id) ? "currentColor" : "none"} />}
              </button>
            </div>
          ))}
        </Glass>
      </section>
    )}
    <div className="mt-6 px-6 text-center text-[11px] leading-relaxed text-ink-soft">
      Your library is stored locally. {games.length} ports are available in the catalog.
    </div>
  </div>;
}
