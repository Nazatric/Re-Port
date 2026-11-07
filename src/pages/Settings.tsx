import { useEffect, useState } from 'react';
import { Icon } from '../components/Icons';
import { Hero, Switch } from '../components/ui';
import { Link } from '../lib/router';
import { catalog, stats } from '../lib/catalog';
import { autoRefresh, setAutoUpdate, setCatalogStatus, setRemoteUrl, useCatalogMeta, useCatalogStatus } from '../lib/remoteCatalog';
import { favoritesStore, recentsStore, useSettings } from '../lib/store';
import { showToast } from '../lib/ui';
import { formatBytes, formatDate } from '../lib/format';
import type { Settings as S, ThemeId } from '../lib/types';
import { useOnline } from '../lib/useOnline';

const THEMES: { id: ThemeId; name: string; sub: string; swatch: string }[] = [
  { id: 'system', name: 'System', sub: 'Azure light · Graphite dark', swatch: 'linear-gradient(135deg,#7fd0ff 0%,#0c4fa0 48%,#373d47 52%,#101215 100%)' },
  { id: 'azure', name: 'Azure', sub: 'Light', swatch: 'linear-gradient(135deg,#7fd0ff,#0c4fa0)' },
  { id: 'graphite', name: 'Graphite', sub: 'Dark', swatch: 'linear-gradient(135deg,#4a525d,#101215 70%,#f0a30a)' },
  { id: 'lime', name: 'Lime', sub: 'Classic green', swatch: 'linear-gradient(135deg,#b7ee54,#2a6b08)' },
];

function CatalogUpdates() {
  const meta = useCatalogMeta();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const status = useCatalogStatus();

  const check = async () => {
    setBusy(true);
    setCatalogStatus('Checking for a newer catalog...');
    const result = await autoRefresh(true);
    setBusy(false);
    if (!result) return setCatalogStatus('Automatic updates are turned off.');
    if (result.status === 'updated') {
      setCatalogStatus(`Updated. ${result.added > 0 ? `${result.added} new titles added. ` : ''}Build ${result.generated}.`);
      showToast('Catalog updated');
    } else if (result.status === 'current') setCatalogStatus(`Already up to date. Build ${result.generated}.`);
    else setCatalogStatus(online ? 'No catalog source is reachable right now.' : 'You are offline. The downloaded catalog is still in use.');
  };

  const when = meta.fetchedAt ? `${formatDate(meta.fetchedAt.slice(0, 10))} at ${meta.fetchedAt.slice(11, 16)}` : 'never on this device';

  return (
    <section className="panel px-4 py-2" aria-labelledby="h-catalog">
      <h2 id="h-catalog" className="flex items-center gap-2 pb-1 pt-3 text-lg font-bold">
        <Icon name="refresh" size={20} /> Catalog updates
      </h2>
      <p className="pb-2 text-sm text-ink2">
        New ports and release details are published continuously and picked up here automatically, so the library grows without an app update. Last checked: {when}.
      </p>
      <Switch label="Automatic updates" hint="Check for a newer catalog when the app opens." checked={meta.auto} onChange={(v) => setAutoUpdate(v)} />
      <div className="flex flex-wrap items-center gap-3 border-t border-line py-3">
        <button type="button" className="btn-glass" onClick={check} disabled={busy || !online} aria-busy={busy}>
          <Icon name="download" size={18} /> {busy ? 'Checking...' : 'Check now'}
        </button>
        {status && <p className="text-sm text-ink2" role="status">{status}</p>}
      </div>
      <details className="border-t border-line py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Catalog source</summary>
        <p className="mt-2 text-ink2">Re:Port reads a published catalog file. You can point it at your own copy:</p>
        <label htmlFor="catalog-url" className="mt-2 block text-xs font-bold text-ink2">
          Catalog URL
        </label>
        <input
          id="catalog-url"
          className="field mt-1"
          type="url"
          inputMode="url"
          placeholder="https://example.com/catalog.json"
          defaultValue={meta.url || ''}
          onBlur={(e) => setRemoteUrl(e.target.value.trim())}
        />
      </details>
    </section>
  );
}

function Segment<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} aria-pressed={value === o.id} className="chip" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const [s, update] = useSettings();
  const online = useOnline();
  const [usage, setUsage] = useState('');

  const refreshUsage = () => {
    navigator.storage?.estimate?.().then((e) => setUsage(e.usage ? formatBytes(e.usage) : '')).catch(() => setUsage(''));
  };
  useEffect(refreshUsage, []);

  const clearImages = async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('portdeck-img')).map((k) => caches.delete(k)));
      showToast('Image cache cleared');
    } catch {
      showToast('Nothing to clear');
    }
    refreshUsage();
  };

  return (
    <>
      <Hero title="Settings" />
      <main id="main" tabIndex={-1} className="wrap safe-bottom -mt-4 space-y-6 outline-none">
        <section className="panel p-4" aria-labelledby="h-look">
          <h2 id="h-look" className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Icon name="palette" size={20} /> Appearance
          </h2>
          <div role="radiogroup" aria-label="Color theme" className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {THEMES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={s.theme === t.id} onClick={() => update({ theme: t.id })} className="rounded-2xl border-2 p-2 text-left transition-transform active:scale-[0.97]" style={{ borderColor: s.theme === t.id ? 'var(--accent)' : 'var(--line)', background: 'var(--surface-2)' }}>
                <span className="block h-14 rounded-xl border border-white/50" style={{ background: t.swatch }} />
                <span className="mt-2 flex items-center gap-1 text-sm font-bold">
                  {s.theme === t.id && <Icon name="check" size={16} className="text-[var(--link)]" />}
                  {t.name}
                </span>
                <span className="block text-xs text-ink2">{t.sub}</span>
              </button>
            ))}
          </div>
          <h3 className="mb-2 mt-5 flex items-center gap-2 font-semibold">
            <Icon name="textSize" size={20} /> Text size
          </h3>
          <Segment<S['text']> label="Text size" value={s.text} options={[{ id: 0, label: 'Default' }, { id: 1, label: 'Large' }, { id: 2, label: 'Larger' }]} onChange={(v) => update({ text: v })} />
        </section>

        <section className="panel px-4 py-2" aria-labelledby="h-acc">
          <h2 id="h-acc" className="flex items-center gap-2 pb-1 pt-3 text-lg font-bold">
            <Icon name="access" size={20} /> Accessibility
          </h2>
          <Switch label="High contrast" hint="Stronger borders and text colours." checked={s.contrast} onChange={(v) => update({ contrast: v })} />
          <div className="py-3">
            <p className="mb-1 font-semibold">Motion</p>
            <p className="mb-2 text-sm text-ink2">Animations such as the cover-flow tilt and page transitions.</p>
            <Segment<S['motion']> label="Motion" value={s.motion} options={[{ id: 'system', label: 'Match device' }, { id: 'reduce', label: 'Reduce' }, { id: 'full', label: 'Full' }]} onChange={(v) => update({ motion: v })} />
          </div>
          <Switch label="Haptic feedback" hint="A short vibration on key actions, where the device supports it." checked={s.haptics} onChange={(v) => update({ haptics: v })} />
        </section>

        <section className="panel px-4 py-2" aria-labelledby="h-data">
          <h2 id="h-data" className="flex items-center gap-2 pb-1 pt-3 text-lg font-bold">
            <Icon name={online ? 'download' : 'cloudOff'} size={20} /> Data and offline
          </h2>
          <p className="pb-2 text-sm text-ink2" role="status">
            {online ? 'You are online. Artwork is streamed on demand and kept for offline use.' : 'You are offline. The full catalog and any artwork you have already seen are still available.'}
          </p>
          <Switch label="Data saver" hint="Skip remote artwork and show generated covers instead." checked={s.dataSaver} onChange={(v) => update({ dataSaver: v })} />
          <div className="flex flex-wrap items-center gap-3 py-3">
            <button type="button" className="btn-glass" onClick={clearImages}>
              <Icon name="trash" size={18} /> Clear cached artwork
            </button>
            {usage && <span className="text-sm text-ink2">Using about {usage} on this device</span>}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line py-3">
            <button
              type="button"
              className="btn-glass"
              onClick={() => {
                favoritesStore.set([]);
                recentsStore.set([]);
                showToast('Saved list and history cleared');
              }}
            >
              Clear saved list and history
            </button>
          </div>
        </section>

        <CatalogUpdates />

        <section className="panel p-4" aria-labelledby="h-lib">
          <h2 id="h-lib" className="mb-3 text-lg font-bold">
            The library
          </h2>
          <ul className="grid gap-2">
            <li>
              <Link to="/about" className="row-card !grid-cols-[auto_1fr_auto]">
                <Icon name="info" className="text-[var(--link)]" />
                <span>
                  <b className="block">About, sources and credits</b>
                  <span className="text-sm text-ink2">Where the data comes from and how it is checked.</span>
                </span>
                <Icon name="chevron" className="text-ink2" />
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-xs text-ink2">
            Catalog build {catalog.generated}. {stats.games.toLocaleString('en-US')} titles and {stats.ports.toLocaleString('en-US')} ports listed.
          </p>
        </section>
      </main>
    </>
  );
}
