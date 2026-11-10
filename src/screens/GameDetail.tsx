import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, Bookmark, CheckCircle2, Download, ExternalLink, FolderOpen,
  Heart, Info, Share2,
} from "lucide-react";
import {
  evidenceLabels, fileLabels, gameById, games, kindLabels, primaryPortIndex, primaryPort, rankedPortIndices,
  type Game,
} from "@/data/ports";
import { useApp } from "@/state";
import { GameArt, GameShot, thumbShot } from "@/components/Artwork";
import { TapSurface } from "@/components/TapSurface";
import { BackHeader, Glass, GlossButton, IconButton, SectionHeader } from "@/components/ui";
import { downloadDestination } from "@/lib/download";
import { cn } from "@/utils/cn";
import { openExternal } from "@/lib/external";

type Tab = "overview" | "files" | "gallery" | "projects";

export function GameDetail({ id }: { id: string }) {
  const g = gameById(id);
  if (!g) return <div className="grid h-full place-items-center text-ink">{t("Port not found.")}</div>;
  return <GameDetailContent key={id} game={g} />;
}

function GameDetailContent({ game: g }: { game: Game }) {
  const { push, saved, toggleSaved, visit, localViews, showToast } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  // Screenshots wait until the push animation has finished so they never compete with it.
  const [mediaReady, setMediaReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setMediaReady(true), 620); return () => window.clearTimeout(t); }, [g.id]);
  const [selected, setSelected] = useState(() => primaryPortIndex(g));
  const wished = saved.has(g.id);
  const port = g.ports[selected] ?? primaryPort(g);
  const ranked = rankedPortIndices(g);

  const visitedId = useRef<string | null>(null);
  useEffect(() => { if (visitedId.current !== g.id) { visitedId.current = g.id; visit(g.id); } }, [g.id, visit]);

  const onDownload = (project = port) => {
    const destination = downloadDestination(project);
    void openExternal(destination).catch(() => showToast("Could not open the download link"));
  };

  const related = games.filter((x) => x.id !== g.id && (x.platform === g.platform || x.genres.some((v) => g.genres.includes(v)))).slice(0, 6);
  const primaryDev = port.developer || g.steamDeveloper || "";

  return (
    <div className="v-scroll relative h-full overflow-y-auto pb-14">
      {/* Quiet hero: real screenshot at natural ratio, no filters, no bubbles. */}
      <div className="detail-hero pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden bg-[#e8f1d6]">
        <div className="absolute inset-0 opacity-[0.32]">
          {mediaReady && g.shots[0]
            ? <img src={thumbShot(g.shots[0])} alt="" draggable={false} className="block h-auto w-full" />
            : <GameArt game={g} radius={0} className="w-full" />}
        </div>
        <div className="detail-hero-wash absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.78) 62%, #fff)" }} />
      </div>

      <BackHeader right={<>
        <IconButton icon={Heart} onClick={() => toggleSaved(g.id)} className={cn(wished && "text-[#e0452f]")} />
        <IconButton icon={Share2} onClick={() => { navigator.clipboard?.writeText(`${g.title} — ${port.download || port.url}`); showToast("Link copied"); }} />
      </>} />

      <div className="relative mt-2 flex items-end gap-4 px-5">
        <GameArt game={g} radius={20} priority shadow className="w-[110px] shrink-0" />
        <div className="min-w-0 pb-1">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{g.platform}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", g.ports.some((p) => p.apk) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{g.ports.some((p) => p.apk) ? t("APK release") : "Source project"}</span>
          </div>
          <h1 className="t-white-shadow mt-1.5 text-[22px] font-bold leading-tight tracking-tight text-ink">{g.title}</h1>
          <div className="mt-0.5 text-[12.5px] font-semibold text-azure tabular-nums">{g.releaseDate || g.year || ""}</div>
          <div className="truncate text-[11.5px] text-ink-soft">{g.genres.slice(0, 3).map((x) => t(x)).join(" · ")}</div>
        </div>
      </div>

      {/* Real download resolution */}
      <section className="relative mt-4 px-4">
        <Glass className="p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
            <ExternalLink size={13} /> {t(kindLabels[port.kind] ?? port.kind)}{primaryDev ? ` · ${primaryDev}` : ""}
          </div>
          {g.ports.length > 1 && (
            <select value={selected} onChange={(e) => setSelected(Number(e.target.value))} className="mb-2 h-10 w-full rounded-full bg-black/[0.05] px-3 text-[12.5px] font-semibold text-ink outline-none">
              {ranked.map((i) => { const p = g.ports[i]; return <option key={`${p.url}-${i}`} value={i}>{p.name || p.developer}</option>; })}
            </select>
          )}
          <GlossButton variant="lime" size="lg" icon={Download} className="w-full" onClick={() => onDownload()}>
            {port.apk ? t("Get latest APK") : t("Open download source")}
          </GlossButton>
          <div className="mt-2 flex gap-2">
            <a href={port.url} target="_blank" rel="noreferrer" className="press flex h-10 flex-1 items-center justify-center gap-1 rounded-full bg-black/[0.06] text-[11.5px] font-semibold text-ink-soft">Project page <ExternalLink size={12} /></a>
            <button onClick={() => onDownload()} className="press flex h-10 flex-1 items-center justify-center gap-1 rounded-full bg-black/[0.06] text-[11.5px] font-semibold text-ink-soft">Release link <ArrowUpRight size={12} /></button>
          </div>
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-soft">
            {port.apk ? "Opens the project's release page in your browser. Choose the APK that works for your device; Re:Port does not host or verify it." : "Opens the project's download source in your browser."}
          </p>
        </Glass>
      </section>

      {/* Scores strip */}
      <div className="relative mt-4 px-4">
        <Glass className="grid grid-cols-3 divide-x divide-black/[0.06] py-3 text-center">
          {[
            [t("Metascore"), g.metacritic != null ? String(g.metacritic) : "—"],
            [t("Ports"), String(g.ports.length)],
            [t("Your views"), (localViews[g.id] || 0).toLocaleString()],
          ].map(([k, v]) => <div key={k} className="px-1"><div className="truncate text-[13px] font-bold text-ink tabular-nums">{v}</div><div className="truncate text-[10px] uppercase tracking-wide text-ink-soft">{k}</div></div>)}
        </Glass>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-soft">{t("Metascore is the original game's Metacritic critic score, not a port rating. Ports counts listed projects. Your views counts opens on this device only; it is not a global popularity figure.")}</p>
      </div>

      <div className="relative mt-4 px-4">
        <div className="glass flex h-10 rounded-full p-1">
          {([["overview", t("Overview")], ["files", t("Files")], ["gallery", t("Gallery")], ["projects", t("Ports {n}", { n: g.ports.length })]] as [Tab, string][]).map(([tabKey, label]) => (
            <button key={tabKey} onClick={() => setTab(tabKey)} className={cn("press relative z-[2] flex flex-1 items-center justify-center rounded-full text-[12px] font-semibold transition-colors", tab === tabKey ? "glass-lime sheen text-white" : "text-ink-soft")}>{label}</button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="relative mt-4 space-y-4 px-4">
          <Glass className="p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-ink"><Info size={15} className="text-lime-deep" /> About this game</div>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">{g.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{g.genres.map((x) => <span key={x} className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink-soft">{t(x)}</span>)}</div>
          </Glass>

          <section>
            <SectionHeader title={t("Game information")} />
            <Glass className="divide-y divide-black/[0.06] px-4">
              {[
                [t("Developer"), g.steamDeveloper || "—"],
                [t("Publisher"), g.steamPublisher || "—"],
                [t("Released"), g.releaseDate || (g.year ? String(g.year) : "—")],
                [t("Metascore"), g.metacritic ? String(g.metacritic) : "—"],
                [t("Reviews"), g.reviewCount ? g.reviewCount.toLocaleString() : "—"],
              ].map(([k, v]) => <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-[12.5px]"><span className="shrink-0 text-ink-soft">{k}</span><span className="truncate text-right font-semibold text-ink tabular-nums">{v}</span></div>)}
            </Glass>
          </section>

          <section>
            <SectionHeader title={t("Native port requirements")} />
            <Glass className="divide-y divide-black/[0.06] px-4">
              {[
                [t("Project"), port.name],
                [t("Port author"), port.developer || t("Community")],
                [t("Game files"), t(fileLabels[port.files] ?? port.files)],
                [t("Android evidence"), t((evidenceLabels[port.evidence] ?? port.evidence) || t("Community listing"))],
                [t("Engine"), port.engine || t("See project")],
                [t("Controller"), port.controller || t("See project")],
                [t("Updated"), port.updated || "—"],
              ].map(([k, v]) => <div key={k} className="flex items-start justify-between gap-4 py-2.5 text-[12.5px]"><span className="shrink-0 text-ink-soft">{k}</span><span className="text-right font-semibold text-ink">{v}</span></div>)}
            </Glass>
          </section>

          {mediaReady && g.shots.length > 0 && (
            <section>
              <SectionHeader title={t("Screenshots")} />
              <div className="h-scroll no-scrollbar flex gap-3 pb-2 pt-1" style={{ touchAction: "pan-x pan-y" }}>
                {g.shots.slice(0, 4).map((s, i) => <GameShot key={s + i} src={s} alt={`${g.title} screenshot ${i + 1}`} className="h-[150px] w-auto max-w-[260px] shrink-0" radius={12} />)}
              </div>
            </section>
          )}

          <div className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-lime-deep" />
            <p className="text-[11.5px] leading-relaxed text-ink-soft">{t("Re:Port is a directory. It links to each project's own source and never bundles copyrighted game data, ROMs or keys.")}</p>
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="relative mt-4 space-y-4 px-4">
          <Glass className="p-4">
            <div className="flex items-center gap-2 text-[14px] font-bold text-ink"><FolderOpen size={17} className="text-lime-deep" /> Files you need</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
              {port.files === "none" ? "This port ships with everything it needs — no ROM, disc or PC installation is required." :
                port.files === "rom" ? "This port needs a disc image or ROM dumped from a copy you own. Follow the linked project instructions to place it." :
                  port.files === "app" ? "This is a complete native Android app. Install the APK and open it directly." :
                    "Native ports ship the engine only. Copy the original game files from a legally owned copy to the folder described by the project."}
            </p>
            {port.filesNote && <div className="mt-3 rounded-xl bg-black/[0.05] p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">{t("Project notes")}</div><div className="mt-1 text-[12px] text-ink">{port.filesNote}</div></div>}
            <div className="mt-3 rounded-xl bg-black/[0.05] p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">{t("Typical Android data folder")}</div><code className="mt-1 block truncate font-mono text-[11px] font-semibold text-ink">/storage/emulated/0/Android/data/…/files/</code></div>
          </Glass>
          <a href={port.url} target="_blank" rel="noreferrer" className="glass press flex items-center justify-between rounded-2xl p-3.5">
            <div className="flex items-center gap-2.5"><ExternalLink size={17} className="text-azure" /><div><div className="text-[13px] font-semibold text-ink">{t("Read the project setup guide")}</div><div className="text-[11px] text-ink-soft">{t("Exact paths and file names from the maintainer")}</div></div></div>
            <ArrowUpRight size={17} className="text-azure" />
          </a>
        </div>
      )}

      {tab === "gallery" && (
        <div className="relative mt-4 space-y-4 px-4">
          <SectionHeader title={t("Cover art")} />
          <div className="flex justify-center"><GameArt game={g} radius={18} priority shadow className="w-[240px]" /></div>
          <SectionHeader title={`Screenshots ${g.shots.length}`} className="pt-2" />
          <div className="space-y-3">{mediaReady && g.shots.map((s, i) => <GameShot key={s + i} src={s} alt={`${g.title} screenshot ${i + 1}`} className="w-full" />)}</div>
        </div>
      )}

      {tab === "projects" && (
        <div className="relative mt-4 space-y-3 px-4">
          <SectionHeader title={t(g.ports.length === 1 ? "{n} community port" : "{n} community ports", { n: g.ports.length })} />
          {ranked.map((i) => { const p = g.ports[i]; return (
            <Glass key={`${p.url}-${i}`} className={cn("p-3.5", selected === i && "ring-2 ring-lime-deep")}>
              <TapSurface onTap={() => setSelected(i)} className="w-full">
                <div className="flex items-start justify-between gap-2"><div className="text-[13.5px] font-bold text-ink">{p.name}</div><span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{kindLabels[p.kind] ?? p.kind}</span></div>
                <div className="mt-1 text-[11.5px] text-ink-soft">{p.developer}{p.version ? ` · ${p.version}` : ""}{p.updated ? ` · ${p.updated}` : ""}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.apk && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">APK</span>}
                  {p.stars > 0 && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink-soft tabular-nums">★ {p.stars}</span>}
                  {p.downloads > 0 && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink-soft tabular-nums">↓ {p.downloads}</span>}
                  {p.files && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{t(fileLabels[p.files] ?? p.files)}</span>}
                  {p.engine && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{p.engine}</span>}
                </div>
              </TapSurface>
              <div className="mt-3 flex gap-2">
                <a href={p.url} target="_blank" rel="noreferrer" className="press flex h-10 flex-1 items-center justify-center gap-1 rounded-full bg-black/[0.06] text-[11.5px] font-semibold text-ink-soft">Source <ExternalLink size={11} /></a>
                <button onClick={() => onDownload(p)} className="press flex h-10 flex-1 items-center justify-center gap-1 rounded-full bg-black/[0.06] text-[11.5px] font-semibold text-ink-soft">Download <ArrowUpRight size={11} /></button>
              </div>
            </Glass>
          ); })}
        </div>
      )}

      <section className="relative mt-7">
        <SectionHeader title={t("More from the catalog")} className="px-5" />
        <div className="h-scroll no-scrollbar flex gap-3 px-5 pb-2 pt-1" style={{ touchAction: "pan-x pan-y" }}>
          {related.map((r) => (
            <TapSurface key={r.id} onTap={() => push({ type: "game", id: r.id })} className="w-[92px] shrink-0">
              <GameArt game={r} radius={12} className="w-full" />
              <div className="mt-1.5 line-clamp-2 text-center text-[11px] font-semibold leading-tight text-ink">{r.title}</div>
            </TapSurface>
          ))}
        </div>
      </section>
      <div className="relative mt-7 flex justify-center">
        <button onClick={() => toggleSaved(g.id)} className="press flex h-10 items-center gap-2 rounded-full bg-white/70 px-4 text-[12px] font-semibold text-ink">
          <Bookmark size={14} />{wished ? t("Saved to Library") : t("Save to Library")}
        </button>
      </div>
    </div>
  );
}
