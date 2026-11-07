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
  return {
    tag: r.tag_name || '',
    name: r.name || r.tag_name || '',
    date: (r.published_at || '').slice(0, 10),
    prerelease: Boolean(r.prerelease),
    url: r.html_url || '',
    assets: (r.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
  };
}

export function apkAssets(info: ReleaseInfo): ReleaseAsset[] {
  return info.assets.filter((a) => /\.(apk|apks|aab|xapk)$/i.test(a.name));
}

function readCache(o: string, r: string): ReleaseResult | null {
  try {
    const s = localStorage.getItem(key(o, r));
    if (!s) return null;
    const v = JSON.parse(s) as { t: number; v: ReleaseResult };
    return Date.now() - v.t < TTL ? v.v : null;
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
export async function fetchLatestRelease(owner: string, repo: string, signal?: AbortSignal): Promise<ReleaseResult> {
  const cached = readCache(owner, repo);
  if (cached) return cached;
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
      const arr = list.ok ? ((await list.json()) as RawRelease[]) : [];
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
