import { useEffect, useState } from 'react';
import { Avatar } from './Cover';
import { Icon, kindIcon } from './Icons';
import { Pill, StatusBadge } from './ui';
import { controllerLabel, filesLabel, githubRepo, linkMeta, platformById, portName, portStatus } from '../lib/catalog';
import { portAvatarOwner } from '../lib/images';
import { fetchLatestRelease, apkAssets, type ReleaseResult } from '../lib/github';
import { formatBytes, formatDate, timeAgo } from '../lib/format';
import { haptic } from '../lib/ui';
import type { Port } from '../lib/types';
import { cn } from '../utils/cn';

export function AvatarFor({ port, name, size = 40 }: { port: Port; name: string; size?: number }) {
  return <Avatar owner={portAvatarOwner(port)} name={port.developer || name} size={size} />;
}

/** The real download link: opens the developer's release page (GitHub latest release) or wherever the port is published. */
export function DownloadButton({ port, size = 'large', gameTitle }: { port: Port; size?: 'large' | 'small'; gameTitle: string }) {
  const meta = linkMeta(port);
  const isRelease = port.kind === 'github';
  return (
    <a
      href={port.download}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => haptic(12)}
      className={cn('btn-a', size === 'large' ? 'w-full' : 'small w-full')}
      aria-label={`Download ${gameTitle} port${port.name ? ` ${port.name}` : ''}. ${meta.sub}. Opens in a new tab.`}
    >
      <span className="orb" aria-hidden="true">
        <Icon name="download" size={size === 'large' ? 18 : 16} />
      </span>
      <span className="text-left leading-tight">
        Download
        {size === 'large' && <small className="block text-[0.72rem] font-semibold opacity-95">{isRelease ? 'Latest release on GitHub' : meta.sub}</small>}
      </span>
      <Icon name={kindIcon(port.kind)} size={20} className="opacity-90" />
    </a>
  );
}

export function Fact({ icon, label, value, note }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string; note?: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--link)]">
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="eyebrow !text-[0.64rem]">{label}</p>
        <p className="text-sm font-semibold leading-snug">{value}</p>
        {note && <p className="mt-0.5 text-xs leading-snug text-ink2">{note}</p>}
      </div>
    </div>
  );
}

export function PortCard({ port, gameTitle, engine }: { port: Port; gameTitle: string; engine?: { id: string; title: string } }) {
  const meta = linkMeta(port);
  const repo = githubRepo(port);
  const sourcePlatforms = (port.platforms?.length ? port.platforms : port.platform ? [port.platform] : [])
    .map((id) => platformById.get(id)?.name)
    .filter((x): x is string => Boolean(x));
  return (
    <article className="panel min-w-0 p-4" aria-label={`${portName(port)} by ${port.developer || 'unknown developer'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <AvatarFor port={port} name={portName(port)} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold leading-tight">{portName(port)}</h3>
          <p className="truncate text-sm text-ink2">{port.developer ? `by ${port.developer}` : 'Developer not listed'}</p>
        </div>
        <StatusBadge status={portStatus(port)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill icon={kindIcon(port.kind)}>{meta.label}</Pill>
        {port.version && <Pill icon="bolt">{port.version.length > 18 ? `${port.version.slice(0, 18)}...` : port.version}</Pill>}
        {port.paid && <Pill icon="info">Paid</Pill>}
        {port.mirror && <Pill icon="warn">Mirror</Pill>}
        {port.lifecycle === 'paused' && <Pill icon="clock">On Hiatus</Pill>}
        {port.lifecycle === 'experimental' && <Pill icon="bolt">Experimental</Pill>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sourcePlatforms.length > 0 && <Fact icon="gamepad" label="Ported From" value={sourcePlatforms.join(', ')} />}
        <Fact icon="gamepad" label="Controls" value={controllerLabel(port)} />
        <Fact icon="folder" label="Game files" value={filesLabel(port)} note={port.filesNote} />
        {(port.updated || port.added) && <Fact icon="calendar" label="Last update" value={formatDate(port.updated || port.added)} note={timeAgo(port.updated || port.added)} />}
        {engine && <Fact icon="chip" label="Runs on" value={engine.title} />}
      </div>

      {port.notes && (
        <p className="mt-3 flex gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm leading-snug">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-[var(--link)]" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{port.notes}</span>
        </p>
      )}
      {port.instructions && (
        <details className="mt-3 rounded-xl bg-[var(--surface-2)] p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Install notes</summary>
          <p className="mt-2 leading-snug text-ink2">{port.instructions}</p>
        </details>
      )}
      {meta.warnings.map((w) => (
        <p key={w} className="mt-3 flex gap-2 text-sm font-medium text-[var(--warn)]">
          <Icon name="warn" size={18} className="mt-0.5 shrink-0" />
          {w}
        </p>
      ))}

      <div className="mt-4 grid grid-cols-1 gap-2">
        <DownloadButton port={port} size="small" gameTitle={gameTitle} />
        {repo && (
          <a href={port.url} target="_blank" rel="noopener noreferrer" className="btn-glass !min-h-[44px]">
            <Icon name="github" size={18} />
            Source code
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  );
}

/** Live release info from the GitHub API. Never blocks the download button; degrades quietly when offline. */
export function ReleaseCard({ port }: { port: Port }) {
  const repo = githubRepo(port);
  const [result, setResult] = useState<ReleaseResult | 'loading'>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!repo) return;
    const ctrl = new AbortController();
    setResult('loading');
    fetchLatestRelease(repo.owner, repo.repo, ctrl.signal).then((r) => !ctrl.signal.aborted && setResult(r));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.owner, repo?.repo, nonce]);

  if (!repo) return null;
  return (
    <section className="panel p-4" aria-label="Latest release on GitHub" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <Icon name="github" size={20} />
          Latest release
        </h3>
        <button type="button" onClick={() => setNonce((n) => n + 1)} aria-label="Refresh release information" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)]">
          <Icon name="refresh" size={18} />
        </button>
      </div>
      {result === 'loading' && <div className="mt-3 h-12 animate-pulse rounded-xl bg-[var(--surface-2)]" aria-label="Loading release information" />}
      {result !== 'loading' && result.state === 'ok' && (
        <div className="mt-3">
          <p className="text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{result.info.name || result.info.tag}</p>
          <p className="mt-0.5 text-sm text-ink2">
            {result.info.date ? `Published ${formatDate(result.info.date)} (${timeAgo(result.info.date)})` : 'Publish date unavailable'}
            {result.info.prerelease ? ' \u00b7 Pre-release' : ''}
          </p>
          {apkAssets(result.info).length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Android packages in this release">
              {apkAssets(result.info)
                .slice(0, 6)
                .map((a) => (
                  <li key={a.name} className="badge badge-plain max-w-full">
                    <span className="min-w-0 truncate">{a.name}</span>
                    {a.size > 0 && <span className="shrink-0 opacity-80">{formatBytes(a.size)}</span>}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {result !== 'loading' && result.state === 'none' && <p className="mt-3 text-sm text-ink2">No releases are published on GitHub yet. The download button opens the releases page.</p>}
      {result !== 'loading' && result.state === 'limited' && <p className="mt-3 text-sm text-ink2">Live release details are paused because GitHub's request limit was reached. The download button still works.</p>}
      {result !== 'loading' && result.state === 'error' && <p className="mt-3 text-sm text-ink2">Live release details are unavailable right now, for example while offline. The download button still works.</p>}
    </section>
  );
}
