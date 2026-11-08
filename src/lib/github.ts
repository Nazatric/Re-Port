export interface ReleaseAsset {
  name: string;
  size: number;
  url: string;
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  date: string;
  prerelease: boolean;
  url: string;
  assets: ReleaseAsset[];
}

export type ReleaseResult = { state: 'ok'; info: ReleaseInfo } | { state: 'none' } | { state: 'limited' } | { state: 'error' };

const TTL = 3 * 60 * 60 * 1000;
const key = (o: string, r: string) => `portdeck.rel.${o}/${r}`.toLowerCase();

interface RawRelease {
  tag_name?: string;
  name?: string | null;
  published_at?: string;
  prerelease?: boolean;
  html_url?: string;
  assets?: { name: string; size: number; browser_download_url: string }[];
}

export function toReleaseInfo(r: RawRelease): ReleaseInfo {
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  const tag = text(r?.tag_name);
  const assets = Array.isArray(r?.assets) ? r.assets : [];
  return {
    tag,
    name: text(r?.name) || tag,
    date: text(r?.published_at).slice(0, 10),
    prerelease: r?.prerelease === true,
    url: text(r?.html_url),
    assets: assets.filter((a) => a && typeof a.name === 'string' && typeof a.browser_download_url === 'string')
      .map((a) => ({ name: a.name, size: typeof a.size === 'number' && Number.isFinite(a.size) ? a.size : 0, url: a.browser_download_url })),
  };
}

function validCachedResult(value: unknown): value is ReleaseResult {
  if (!value || typeof value !== 'object' || !('state' in value)) return false;
  const result = value as ReleaseResult;
  if (result.state === 'none' || result.state === 'limited' || result.state === 'error') return true;
  if (result.state !== 'ok' || !result.info || typeof result.info !== 'object') return false;
  const info = result.info;
  return [info.tag, info.name, info.date, info.url].every((v) => typeof v === 'string') && typeof info.prerelease === 'boolean' &&
    Array.isArray(info.assets) && info.assets.every((a) => a && typeof a.name === 'string' && typeof a.url === 'string' && typeof a.size === 'number' && Number.isFinite(a.size));
}

export function apkAssets(info: ReleaseInfo): ReleaseAsset[] {
  return info.assets.filter((a) => /\.(apk|apks|aab|xapk)$/i.test(a.name));
}

function readCache(o: string, r: string): ReleaseResult | null {
  try {
    const s = localStorage.getItem(key(o, r));
    if (!s) return null;
    const v = JSON.parse(s) as { t: number; v: ReleaseResult };
    return typeof v.t === 'number' && Date.now() - v.t >= 0 && Date.now() - v.t < TTL && validCachedResult(v.v) ? v.v : null;
  } catch {
    return null;
  }
}

function writeCache(o: string, r: string, v: ReleaseResult) {
  try {
    localStorage.setItem(key(o, r), JSON.stringify({ t: Date.now(), v }));
  } catch {
    /* ignore */
  }
}

/** Reads live release data from the public GitHub API. Cached for three hours to respect rate limits. */
export async function fetchLatestRelease(owner: string, repo: string, signal?: AbortSignal, force = false): Promise<ReleaseResult> {
  const cached = readCache(owner, repo);
  if (cached && !force) return cached;
  try {
    const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const res = await fetch(`${base}/releases/latest`, { signal, headers: { accept: 'application/vnd.github+json' } });
    if (res.status === 403 || res.status === 429) return { state: 'limited' };
    let result: ReleaseResult;
    if (res.ok) {
      result = { state: 'ok', info: toReleaseInfo(await res.json()) };
    } else if (res.status === 404) {
      // No stable release; fall back to the newest pre-release if one exists.
      const list = await fetch(`${base}/releases?per_page=1`, { signal, headers: { accept: 'application/vnd.github+json' } });
      if (list.status === 403 || list.status === 429) return { state: 'limited' };
      if (!list.ok) return { state: 'error' };
      const arr: unknown = await list.json();
      if (!Array.isArray(arr)) return { state: 'error' };
      result = arr.length ? { state: 'ok', info: toReleaseInfo(arr[0]) } : { state: 'none' };
    } else {
      return { state: 'error' };
    }
    writeCache(owner, repo, result);
    return result;
  } catch {
    return { state: 'error' };
  }
}
