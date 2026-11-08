import { describe, expect, it } from 'vitest';
import { apkAssets, toReleaseInfo } from './github';
import { sanitizeSettings, DEFAULT_SETTINGS } from './store';

describe('GitHub release mapping', () => {
  const raw = {
    tag_name: 'v1.2.3',
    name: null,
    published_at: '2026-10-12T10:00:00Z',
    prerelease: true,
    html_url: 'https://github.com/a/b/releases/tag/v1.2.3',
    assets: [
      { name: 'app-arm64.apk', size: 1000, browser_download_url: 'https://x/a.apk' },
      { name: 'source.zip', size: 5, browser_download_url: 'https://x/s.zip' },
      { name: 'bundle.XAPK', size: 7, browser_download_url: 'https://x/b.xapk' },
    ],
  };
  it('maps the API payload', () => {
    const info = toReleaseInfo(raw);
    expect(info).toMatchObject({ tag: 'v1.2.3', name: 'v1.2.3', date: '2026-10-12', prerelease: true });
    expect(info.assets).toHaveLength(3);
  });
  it('keeps only Android packages', () => {
    expect(apkAssets(toReleaseInfo(raw)).map((a) => a.name)).toEqual(['app-arm64.apk', 'bundle.XAPK']);
  });
  it('survives an empty payload', () => {
    expect(toReleaseInfo({})).toMatchObject({ tag: '', name: '', date: '', assets: [] });
  });
});

describe('settings sanitising', () => {
  it('falls back to defaults for bad data', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'neon', text: 9, motion: 'wild', view: 'cards' })).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid values', () => {
    expect(sanitizeSettings({ theme: 'graphite', text: 2, motion: 'reduce', contrast: true, dataSaver: true, haptics: false, view: 'list' })).toEqual({
      theme: 'graphite',
      text: 2,
      motion: 'reduce',
      contrast: true,
      dataSaver: true,
      haptics: false,
      view: 'list',
    });
  });
});

describe('release refresh', () => {
  it('refreshes the cache on request and does not mistake a server failure for no releases', async () => {
    const { vi } = await import('vitest');
    const { fetchLatestRelease } = await import('./github');
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tag_name: 'v1', assets: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tag_name: 'v2', assets: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect(await fetchLatestRelease('owner', 'repo')).toMatchObject({ state: 'ok', info: { tag: 'v1' } });
      expect(await fetchLatestRelease('owner', 'repo')).toMatchObject({ state: 'ok', info: { tag: 'v1' } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await fetchLatestRelease('owner', 'repo', undefined, true)).toMatchObject({ state: 'ok', info: { tag: 'v2' } });
      expect(await fetchLatestRelease('owner', 'other')).toEqual({ state: 'error' });
    } finally { vi.unstubAllGlobals(); }
  });
});
