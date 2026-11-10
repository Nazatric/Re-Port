import { useEffect, useState } from "react";
import { Bookmark, CheckCircle2, FolderOpen, Search, Sparkles } from "lucide-react";
import { collections, featuredGames, games, primaryPort, type Game } from "@/data/ports";
import { useApp } from "@/state";
import { CoverFlow } from "@/components/CoverFlow";
import { BladeStack, type Blade } from "@/components/BladeStack";
import { GameArt } from "@/components/Artwork";
import { TapSurface } from "@/components/TapSurface";
import { Glass, IconButton, InitialAvatar, RePortLogo, SectionHeader } from "@/components/ui";

// Catalog-derived sections do not depend on user state or the clock.
const readyCount = games.filter((g) => g.ports.some((p) => p.files === "none")).length;
const apkCount = games.filter((g) => g.ports.some((p) => p.apk)).length;
const needFilesCount = games.filter((g) => g.ports.some((p) => p.files === "files" || p.files === "rom")).length;
const latest = [...games].filter((g) => g.added).sort((a, b) => b.added.localeCompare(a.added)).slice(0, 6);

function useClock() {
  const [d, setD] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setD(new Date()), 20000); return () => clearInterval(t); }, []);
  return d;
}

export function Home() {
  const { push, setTab, goBrowse, name, saved, recent, setEditNameOpen } = useApp();
  const now = useClock();
  const h24 = now.getHours();
  const date = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const greeting = h24 < 12 ? "Good morning" : h24 < 18 ? "Good afternoon" : "Good evening";
  const recentGames = recent.map((id) => games.find((g) => g.id === id)).filter((g): g is Game => !!g).slice(0, 6);

  const blades: Blade[] = [
    { id: "library", title: "My Library", subtitle: `${saved.size} saved · ${recent.length} viewed`, icon: Bookmark, action: "Open Library", onOpen: () => setTab("library") },
    { id: "ready", title: "Ready to play", subtitle: `${readyCount} ports · no files needed`, icon: CheckCircle2, action: "See them", onOpen: () => goBrowse({ fileNeeds: ["none"] }) },
    { id: "apk", title: "APK releases", subtitle: `${apkCount} with Android builds`, icon: Sparkles, action: "Browse catalog", onOpen: () => goBrowse({ onlyApk: true }) },
    { id: "files", title: "Bring your own files", subtitle: `${needFilesCount} need a legal copy`, icon: FolderOpen, action: "View requirements", onOpen: () => goBrowse({ fileNeeds: ["files", "rom"] }) },
  ];

  const open = (g: Game) => push({ type: "game", id: g.id });

  return (
    <div className="v-scroll h-full overflow-y-auto pb-[116px]">
      <header className="flex items-center justify-between px-5 pt-[calc(var(--sat)+14px)]">
        <div className="flex items-center gap-2.5">
          <RePortLogo size={40} />
          <span className="t-light t-white-shadow text-[24px] font-semibold text-ink">Re:Port</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton icon={Search} onClick={() => setTab("browse")} />
          <TapSurface onTap={() => setEditNameOpen(true)} className="glass sheen flex h-11 items-center gap-2 rounded-full pl-1.5 pr-3">
            <InitialAvatar name={name} size={32} />
            <span className="relative z-[2] max-w-[86px] truncate text-[12.5px] font-semibold text-ink">{name || "Add name"}</span>
          </TapSurface>
        </div>
      </header>

      <div className="px-5 pb-1 pt-7">
        <div className="t-light t-white-shadow flex items-end gap-2 leading-none text-ink">
          <span className="text-[64px] tabular-nums" style={{ letterSpacing: "-0.045em" }}>{h24 % 12 || 12}:{String(now.getMinutes()).padStart(2, "0")}</span>
          <span className="mb-2 text-[16px] text-ink-soft">{h24 >= 12 ? "PM" : "AM"}</span>
        </div>
        <div className="mt-1.5 text-[13px] text-ink-soft">{date} · {greeting}{name ? `, ${name}` : ""}</div>
      </div>

      <section className="pt-4">
        <SectionHeader title="Featured community ports" action="See all" className="px-5" onAction={() => setTab("browse")} />
        <CoverFlow games={featuredGames} onOpen={open} />
      </section>

      <section className="mt-3"><BladeStack blades={blades} /></section>

      {recentGames.length > 0 && (
        <section className="mt-2 px-4">
          <SectionHeader title="Recently viewed" action="Library" onAction={() => setTab("library")} />
          <div className="h-scroll no-scrollbar -mx-4 flex gap-3 px-4 pb-2 pt-1" style={{ touchAction: "pan-x pan-y" }}>
            {recentGames.map((g) => (
              <TapSurface key={g.id} onTap={() => open(g)} className="w-[92px] shrink-0">
                <GameArt game={g} radius={14} className="w-full shadow-lg" />
                <div className="mt-1.5 line-clamp-2 text-center text-[11px] font-semibold leading-tight text-ink">{g.title}</div>
              </TapSurface>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 px-4">
        <SectionHeader title="Collections" action="Browse" onAction={() => setTab("browse")} />
        <div className="grid grid-cols-3 gap-3">
          {collections.slice(0, 6).map((c, i) => {
            const count = games.filter((g) => g.collections.includes(c.id)).length;
            return (
              <TapSurface key={c.id} onTap={() => push({ type: "collection", name: c.name })} className="icon-gloss relative flex h-[92px] flex-col items-start justify-end rounded-[16px] p-2.5 text-left"
                style={{ background: `linear-gradient(160deg, ${["#b91c1c", "#0284c7", "#854d0e", "#64748b", "#15803d", "#7c3aed"][i]}, #1c2530)` }}>
                <span className="t-shadow relative z-[1] text-[13px] font-semibold text-white">{c.name}</span>
                <span className="relative z-[1] text-[10px] text-white/80 tabular-nums">{count} ports</span>
              </TapSurface>
            );
          })}
        </div>
      </section>

      <section className="mt-5 px-4">
        <SectionHeader title="Recently added ports" action="See all" onAction={() => setTab("browse")} />
        <Glass className="divide-y divide-black/[0.06] p-1.5">
          {latest.map((g) => (
            <TapSurface key={g.id} onTap={() => open(g)} className="flex items-center gap-3 p-2">
              <GameArt game={g} radius={10} className="w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">{g.title}</div>
                <div className="truncate text-[11.5px] text-ink-soft">{primaryPort(g).name} · {g.platform}</div>
              </div>
              <span className="shrink-0 text-[10.5px] text-ink-soft tabular-nums">{g.added.slice(5)}</span>
            </TapSurface>
          ))}
        </Glass>
      </section>

      <footer className="mt-8 px-6 text-center">
        <div className="glass inline-block rounded-full px-5 py-2.5">
          <div className="t-light relative z-[2] text-[13px] italic text-ink">A directory, not an emulator.</div>
          <div className="relative z-[2] mt-0.5 text-[11px] text-ink-soft tabular-nums">{games.length} unofficial ports · {collections.length} collections</div>
        </div>
      </footer>
    </div>
  );
}
