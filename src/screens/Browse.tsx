import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, Check, Heart } from "lucide-react";
import {
  activeFilterCount, allDecades, allEngines, allEvidence, allFileNeeds, allGenres, allKinds,
  allPlatforms, applyFilters, collections, emptyFilters, evidenceLabels, fileLabels, games,
  kindLabels, type Filters, type Game, type SortMode,
} from "@/data/ports";
import { useApp } from "@/state";
import { GameArt } from "@/components/Artwork";
import { TapSurface } from "@/components/TapSurface";
import { Chip, EmptyState } from "@/components/ui";
import { cn } from "@/utils/cn";

// Smaller batches keep image decoding and scrolling responsive; all results remain available.
const PAGE = 24;

const sortLabels: Record<SortMode, string> = {
  relevance: "Relevance", name: "Title A–Z", newest: "Newest", oldest: "Oldest",
  popular: "Most viewed", ports: "Most ports", rating: "Top rated",
};

function Group({ title, options, selected, onToggle, label }: {
  title: string; options: string[]; selected: string[]; onToggle: (v: string) => void; label?: (v: string) => string;
}) {
  return <div className="mb-4">
    <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{title}</div>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => <button key={o} onClick={() => onToggle(o)} className={cn("press relative flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold", selected.includes(o) ? "glass-lime sheen text-white" : "glass text-ink-soft")}>
        <span className="relative z-[2]">{label ? label(o) : o}</span>{selected.includes(o) && <Check size={12} className="relative z-[2]" />}
      </button>)}
    </div>
  </div>;
}

function FilterSheet({ filters, setFilters, onClose }: { filters: Filters; setFilters: (f: Filters) => void; onClose: () => void }) {
  const count = applyFilters(filters, new Set()).length;
  const toggle = (key: keyof Filters, v: string) => {
    const list = filters[key] as string[];
    setFilters({ ...filters, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
  };
  return <div className="absolute inset-0 z-[70] flex flex-col justify-end">
    <button className="anim-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close filters" />
    <div className="anim-sheet-in glass relative z-[2] flex max-h-[88%] flex-col rounded-t-[26px] p-4">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
      <div className="mb-3 flex items-center justify-between">
        <div><div className="text-[18px] font-bold text-ink">Filters</div><div className="text-[11.5px] text-ink-soft tabular-nums">{count} of {games.length} ports match</div></div>
        <button onClick={onClose} className="press grid h-10 w-10 place-items-center rounded-full bg-black/[0.06]"><X size={18} /></button>
      </div>
      <div className="v-scroll -mx-1 flex-1 overflow-y-auto px-1 pb-2">
        <Group title="Collections" options={collections.map((c) => c.id)} selected={filters.collections} onToggle={(v) => toggle("collections", v)} label={(v) => collections.find((c) => c.id === v)?.name ?? v} />
        <Group title="Genre" options={allGenres} selected={filters.genres} onToggle={(v) => toggle("genres", v)} />
        <Group title="Original platform" options={allPlatforms} selected={filters.platforms} onToggle={(v) => toggle("platforms", v)} />
        <Group title="Download source" options={allKinds} selected={filters.kinds} onToggle={(v) => toggle("kinds", v)} label={(v) => kindLabels[v] ?? v} />
        <Group title="Engine" options={allEngines} selected={filters.engines} onToggle={(v) => toggle("engines", v)} />
        <Group title="Game files" options={allFileNeeds} selected={filters.fileNeeds} onToggle={(v) => toggle("fileNeeds", v)} label={(v) => fileLabels[v] ?? v} />
        <Group title="Android evidence" options={allEvidence} selected={filters.evidence} onToggle={(v) => toggle("evidence", v)} label={(v) => evidenceLabels[v] ?? v} />
        <Group title="Release decade" options={allDecades.map(String)} selected={filters.decades.map(String)} onToggle={(v) => {
          const d = Number(v);
          setFilters({ ...filters, decades: filters.decades.includes(d) ? filters.decades.filter((x) => x !== d) : [...filters.decades, d] });
        }} label={(v) => `${v}s`} />
        <div className="mb-3">
          <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-soft">Show only</div>
          <div className="flex flex-wrap gap-2">
            <Chip active={filters.onlySaved} onClick={() => setFilters({ ...filters, onlySaved: !filters.onlySaved })}>Saved</Chip>
            <Chip active={filters.onlyApk} onClick={() => setFilters({ ...filters, onlyApk: !filters.onlyApk })}>Has APK release</Chip>
            <Chip active={filters.onlyRated} onClick={() => setFilters({ ...filters, onlyRated: !filters.onlyRated })}>Critically rated</Chip>
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2 border-t border-black/[0.06] pt-3">
        <button onClick={() => setFilters({ ...emptyFilters, query: filters.query })} className="press h-11 flex-1 rounded-full bg-black/[0.06] text-[13px] font-semibold text-ink-soft">Clear</button>
        <button onClick={onClose} className="glass-lime sheen press h-11 flex-[2] rounded-full text-[13px] font-semibold text-white">Show {count} ports</button>
      </div>
    </div>
  </div>;
}

export function GameCard({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const { saved, toggleSaved } = useApp();
  const wished = saved.has(game.id);
  return <div className="masonry-item glass relative mb-3 p-2">
    <TapSurface onTap={onOpen} ariaLabel={`Open ${game.title}`} className="relative w-full">
      <GameArt game={game} radius={12} className="w-full" />
      <span className={cn("absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[9.5px] font-bold text-white", game.ports.some((p) => p.apk) ? "bg-[#5f9f22]" : "bg-amber-600")}>
        {game.ports.some((p) => p.apk) ? "APK release" : "Project source"}
      </span>
      {game.metacritic != null && <span className="absolute right-2 bottom-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">{game.metacritic}</span>}
    </TapSurface>
    <button onClick={() => toggleSaved(game.id)} className="press absolute right-4 top-4 z-[3] grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow" aria-label="Save port">
      <Heart size={16} className={cn(wished ? "text-[#e0452f]" : "text-ink-soft")} fill={wished ? "currentColor" : "none"} strokeWidth={2.4} />
    </button>
    <TapSurface onTap={onOpen} className="px-1 pb-1 pt-2 text-left">
      <div className="line-clamp-2 text-[13.5px] font-semibold leading-tight text-ink">{game.title}</div>
      <div className="mt-0.5 truncate text-[11px] text-ink-soft">{game.steamDeveloper || game.ports[0]?.developer || game.ports[0]?.name}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-soft tabular-nums">
        <span className="truncate">{game.platform} · {game.year || "—"}</span>
        {game.price && <span className="shrink-0 font-semibold text-ink">{game.price}</span>}
      </div>
    </TapSurface>
  </div>;
}

export function Browse() {
  const { push, saved, browsePreset } = useApp();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    if (!browsePreset) return;
    setFilters((f) => ({ ...emptyFilters, query: f.query, fileNeeds: browsePreset.fileNeeds ?? [], onlyApk: browsePreset.onlyApk ?? false }));
    setLimit(PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browsePreset]);
  const results = useMemo(() => applyFilters(filters, saved), [filters, saved]);
  const visible = results.slice(0, limit);
  const count = activeFilterCount(filters);
  const activeChips: { label: string; clear: () => void }[] = [
    ...filters.collections.map((v) => ({ label: collections.find((c) => c.id === v)?.name ?? v, clear: () => setFilters({ ...filters, collections: filters.collections.filter((x) => x !== v) }) })),
    ...filters.genres.map((v) => ({ label: v, clear: () => setFilters({ ...filters, genres: filters.genres.filter((x) => x !== v) }) })),
    ...filters.platforms.map((v) => ({ label: v, clear: () => setFilters({ ...filters, platforms: filters.platforms.filter((x) => x !== v) }) })),
    ...filters.kinds.map((v) => ({ label: kindLabels[v] ?? v, clear: () => setFilters({ ...filters, kinds: filters.kinds.filter((x) => x !== v) }) })),
    ...filters.engines.map((v) => ({ label: v, clear: () => setFilters({ ...filters, engines: filters.engines.filter((x) => x !== v) }) })),
    ...filters.fileNeeds.map((v) => ({ label: fileLabels[v] ?? v, clear: () => setFilters({ ...filters, fileNeeds: filters.fileNeeds.filter((x) => x !== v) }) })),
    ...filters.decades.map((d) => ({ label: `${d}s`, clear: () => setFilters({ ...filters, decades: filters.decades.filter((x) => x !== d) }) })),
    ...(filters.onlySaved ? [{ label: "Saved", clear: () => setFilters({ ...filters, onlySaved: false }) }] : []),
    ...(filters.onlyApk ? [{ label: "Has APK", clear: () => setFilters({ ...filters, onlyApk: false }) }] : []),
    ...(filters.onlyRated ? [{ label: "Rated", clear: () => setFilters({ ...filters, onlyRated: false }) }] : []),
  ];

  return (
    <div className="v-scroll relative h-full overflow-y-auto pb-[116px]">
      <header className="px-5 pt-[calc(var(--sat)+16px)]">
        <h1 className="t-light t-white-shadow text-[34px] leading-none text-ink">Browse</h1>
        <div className="mt-1.5 text-[12.5px] text-ink-soft tabular-nums">{games.length} unofficial Android ports · {collections.length} collections</div>
      </header>

      <div className="mt-4 flex items-center gap-2 px-4">
        <label className="glass flex h-12 flex-1 items-center gap-2 rounded-full px-4">
          <Search size={18} className="relative z-[2] text-ink-soft" />
          <input value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} placeholder="Games, port projects, engines, repos…" className="relative z-[2] w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-soft/70" />
          {filters.query && <button onClick={() => setFilters({ ...filters, query: "" })} className="relative z-[2] grid h-8 w-8 place-items-center rounded-full bg-black/10"><X size={13} /></button>}
        </label>
        <button aria-label="Open filters" onClick={() => setSheet(true)} className={cn("sheen press relative grid h-12 w-12 place-items-center rounded-full", count ? "glass-lime text-white" : "glass text-ink")}>
          <SlidersHorizontal size={19} className="relative z-[2]" />
          {count > 0 && <span className="absolute -right-1 -top-1 z-[3] grid h-[19px] min-w-[19px] place-items-center rounded-full bg-[#e0452f] px-1 text-[10px] font-bold text-white tabular-nums">{count}</span>}
        </button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
        <Chip active={!filters.collections.length} onClick={() => setFilters({ ...filters, collections: [] })}>All</Chip>
        {collections.map((c) => <Chip key={c.id} active={filters.collections.includes(c.id)} onClick={() => setFilters({ ...filters, collections: filters.collections.includes(c.id) ? filters.collections.filter((x) => x !== c.id) : [...filters.collections, c.id] })}>{c.name}</Chip>)}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 px-4">
        <span className="text-[12px] font-semibold text-ink-soft tabular-nums">{results.length} results</span>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortMode })} className="glass h-9 rounded-full px-3 text-[12px] font-semibold text-ink outline-none">
          {(Object.keys(sortLabels) as SortMode[]).map((k) => <option key={k} value={k}>{sortLabels[k]}</option>)}
        </select>
      </div>

      {activeChips.length > 0 && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto px-4">
          {activeChips.map((c) => <button key={c.label} onClick={c.clear} className="press flex h-7 shrink-0 items-center gap-1 rounded-full bg-lime-deep px-2.5 text-[11px] font-semibold text-white">{c.label}<X size={11} strokeWidth={3} /></button>)}
          <button onClick={() => setFilters({ ...emptyFilters, query: filters.query })} className="press h-7 shrink-0 rounded-full bg-black/10 px-2.5 text-[11px] font-semibold text-ink-soft">Clear all</button>
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState icon={Search} title="No ports match" subtitle="Try a different search or remove a filter.">
          <button onClick={() => setFilters(emptyFilters)} className="glass-lime sheen press h-10 rounded-full px-5 text-[13px] font-semibold text-white">Reset filters</button>
        </EmptyState>
      ) : (
        <>
          <div className="masonry mt-4 px-4">{visible.map((g) => <GameCard key={g.id} game={g} onOpen={() => push({ type: "game", id: g.id })} />)}</div>
          <div className="h-10" />
          {limit < results.length && (
            <div className="px-4 pb-4 text-center">
              <button onClick={() => setLimit((n) => n + PAGE)} className="press h-10 rounded-full bg-white/80 px-5 text-[12.5px] font-semibold text-ink shadow">
                Load more · {results.length - limit} remaining
              </button>
            </div>
          )}
        </>
      )}
      {sheet && <FilterSheet filters={filters} setFilters={setFilters} onClose={() => setSheet(false)} />}
    </div>
  );
}
