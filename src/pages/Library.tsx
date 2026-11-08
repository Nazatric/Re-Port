import { useEffect, useMemo, useRef, useState } from 'react';
import { GameCard, GameRow } from '../components/GameCard';
import { Icon } from '../components/Icons';
import { EmptyState, Hero, Sheet } from '../components/ui';
import { Link, navigate, pageMemory, useRoute } from '../lib/router';
import { DEFAULT_FILTERS, LIST_OPTIONS, SORT_OPTIONS, SOURCE_OPTIONS, activeFilterCount, collectionById, collections, filtersFromParams, filtersToParams, platformById, platforms, queryGames, sourceOptionCounts, useCatalogVersion } from '../lib/catalog';
import { useSettings } from '../lib/store';
import { plural } from '../lib/format';
import type { Filters, SortKey } from '../lib/types';

const PAGE = 36;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-5 border-0 p-0">
      <legend className="eyebrow mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export default function Library() {
  const route = useRoute();
  const catalogVersion = useCatalogVersion();
  const filters = useMemo(() => filtersFromParams(route.query), [route.raw]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(() => queryGames(filters), [filters, catalogVersion]);
  const optionCounts = useMemo(() => sourceOptionCounts(), [catalogVersion]);
  const listOptions = useMemo(() => LIST_OPTIONS.map((s) => ({ ...s, count: optionCounts.lists.get(s.id) || 0 })).filter((s) => s.count), [optionCounts]);
  const sourceOptions = useMemo(() => SOURCE_OPTIONS.map((s) => ({ ...s, count: optionCounts.sources.get(s.id) || 0 })).filter((s) => s.count), [optionCounts]);
  const [settings, update] = useSettings();
  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState(filters.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestFilters = useRef(filters);
  latestFilters.current = filters;
  const sentinel = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(() => pageMemory.get(route.raw) ?? PAGE);

  const apply = (patch: Partial<Filters>) => navigate('/library', filtersToParams({ ...latestFilters.current, ...patch }), { replace: true, keepScroll: true });

  useEffect(() => setText(filters.q), [filters.q]);
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => apply({ q: text.trim() }), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  useEffect(() => {
    if (route.query.get('focus')) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setCount(pageMemory.get(route.raw) ?? PAGE), [route.raw]);
  useEffect(() => {
    pageMemory.set(route.raw, count);
  }, [count, route.raw]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setCount((c) => Math.min(results.length, c + PAGE)), { rootMargin: '900px' });
    io.observe(el);
    return () => io.disconnect();
  }, [results, count]);

  const active = activeFilterCount(filters);
  const chips: { key: keyof Filters; label: string }[] = [];
  if (filters.genre) chips.push({ key: 'genre', label: collectionById.get(filters.genre)?.name ?? filters.genre });
  if (filters.platform) chips.push({ key: 'platform', label: platformById.get(filters.platform)?.name ?? filters.platform });
  if (filters.list) chips.push({ key: 'list', label: LIST_OPTIONS.find((s) => s.id === filters.list)?.label ?? filters.list });
  if (filters.source) chips.push({ key: 'source', label: SOURCE_OPTIONS.find((s) => s.id === filters.source)?.label ?? filters.source });
  if (filters.works) chips.push({ key: 'works', label: 'Works' });
  if (filters.files) chips.push({ key: 'files', label: 'No game files needed' });
  if (filters.controller) chips.push({ key: 'controller', label: 'Controller support' });

  const shown = results.slice(0, count);
  const draftCount = results.length;

  return (
    <>
      <Hero title="Library" />
      <div className="sticky top-0 z-30 -mt-5 border-b border-line bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] pb-2.5 pt-2.5 shadow-[0_6px_14px_var(--shadow-c)]">
        <div className="wrap flex items-center gap-2">
          <form role="search" className="relative min-w-0 flex-1" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="lib-q" className="sr-only">
              Search the library
            </label>
            <input ref={inputRef} id="lib-q" type="search" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="search" autoComplete="off" placeholder="Search the library" className="field !min-h-[48px] !rounded-full !pl-11 !pr-10" />
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2" size={22} />
            {text && (
              <button type="button" aria-label="Clear search" onClick={() => { setText(''); apply({ q: '' }); inputRef.current?.focus(); }} className="absolute right-0 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center text-ink2">
                <Icon name="close" size={20} />
              </button>
            )}
          </form>
          <button type="button" onClick={() => setSheet(true)} className="btn-glass relative !h-12 !min-h-0 !px-4" aria-label={`Filters${active ? `, ${active} active` : ''}`} aria-haspopup="dialog">
            <Icon name="filter" size={20} />
            <span className="hidden min-[380px]:inline">Filters</span>
            {active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[0.7rem] font-extrabold text-[var(--accent-ink)]">{active}</span>}
          </button>
        </div>
        <div className="wrap mt-2 flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Sort by</span>
            <select value={filters.sort} onChange={(e) => apply({ sort: e.target.value as SortKey })} className="chip w-full appearance-none !pr-9">
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Icon name="down" size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </label>
          <div className="flex rounded-full border border-line bg-[var(--chip)] p-0.5" role="group" aria-label="Layout">
            {(['grid', 'list'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={settings.view === v} onClick={() => update({ view: v })} aria-label={v === 'grid' ? 'Grid view' : 'List view'} className="grid h-10 w-11 place-items-center rounded-full aria-pressed:bg-[var(--accent)] aria-pressed:text-[var(--accent-ink)]">
                <Icon name={v === 'grid' ? 'viewGrid' : 'viewList'} size={20} />
              </button>
            ))}
          </div>
        </div>
        {chips.length > 0 && (
          <ul className="no-scrollbar wrap mt-2 flex gap-2 overflow-x-auto" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.key} className="shrink-0">
                <button type="button" className="chip !min-h-[38px] !pr-2" aria-pressed="true" onClick={() => apply({ [c.key]: '' } as Partial<Filters>)} aria-label={`Remove filter ${c.label}`}>
                  {c.label}
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <main id="main" tabIndex={-1} className="wrap safe-bottom pt-4 outline-none">
        <p className="mb-3 text-sm font-semibold text-ink2" aria-live="polite" role="status">
          {plural(results.length, 'result')}
          {filters.q ? ` for "${filters.q}"` : ''}
        </p>

        {results.length === 0 ? (
          <EmptyState title="No ports match" text="Try a shorter search or remove a filter. If a port is missing, you can suggest it.">
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-a small" onClick={() => navigate('/library', {}, { replace: true, keepScroll: true })}>
                Reset filters
              </button>
              <Link to="/submit" params={{ title: filters.q || undefined }} className="btn-glass">
                Suggest a port
              </Link>
            </div>
          </EmptyState>
        ) : settings.view === 'grid' ? (
          <div className="grid-games">
            {shown.map((g, i) => (
              <GameCard key={g.id} game={g} eager={i < 6} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </div>
        )}
        {shown.length < results.length && <div ref={sentinel} className="h-24" aria-hidden="true" />}
        {shown.length >= results.length && results.length > PAGE && <p className="py-8 text-center text-sm text-ink2">End of the list. {plural(results.length, 'result')} shown.</p>}
      </main>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <button type="button" className="btn-glass flex-1" onClick={() => navigate('/library', filtersToParams({ ...DEFAULT_FILTERS, q: filters.q, sort: filters.sort }), { replace: true, keepScroll: true })} disabled={active === 0}>
              Reset
            </button>
            <button type="button" className="btn-a small flex-[2]" onClick={() => setSheet(false)} data-autofocus>
              Show {plural(draftCount, 'game')}
            </button>
          </div>
        }
      >
        <Group label="Quick filters">
          <button type="button" className="chip" aria-pressed={filters.works === 'yes'} onClick={() => apply({ works: filters.works ? '' : 'yes' })}>
            Works
          </button>
          <button type="button" className="chip" aria-pressed={filters.files === 'none'} onClick={() => apply({ files: filters.files ? '' : 'none' })}>
            No game files needed
          </button>
          <button type="button" className="chip" aria-pressed={filters.controller === 'yes'} onClick={() => apply({ controller: filters.controller ? '' : 'yes' })}>
            Controller support
          </button>
        </Group>
        <Group label="Collection">
          {collections.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={filters.genre === c.id} onClick={() => apply({ genre: filters.genre === c.id ? '' : c.id })}>
              {c.name}
              <span className="text-xs opacity-75">{c.count}</span>
            </button>
          ))}
        </Group>
        <p className="mb-4 text-xs leading-relaxed text-ink2">Counts show the full catalog. Compatibility, files, source and controller filters must match the same port; platforms describe the original game releases.</p>
        <Group label="Original game platform">
          {platforms.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={filters.platform === p.id} onClick={() => apply({ platform: filters.platform === p.id ? '' : p.id })}>
              {p.name}
              <span className="text-xs opacity-75">{p.count}</span>
            </button>
          ))}
        </Group>
        <Group label="Catalog list">
          {listOptions.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={filters.list === s.id} onClick={() => apply({ list: filters.list === s.id ? '' : s.id })}>
              {s.label}<span className="text-xs opacity-75">{s.count}</span>
            </button>
          ))}
        </Group>
        <Group label="Released on">
          {sourceOptions.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={filters.source === s.id} onClick={() => apply({ source: filters.source === s.id ? '' : s.id })}>
              {s.label}<span className="text-xs opacity-75">{s.count}</span>
            </button>
          ))}
        </Group>
      </Sheet>
    </>
  );
}
