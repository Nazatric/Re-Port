import { Capacitor } from "@capacitor/core";
import { openExternal } from "./external";
import type { Game, PortProject } from "@/data/ports";
import { readCache, swrJson, writeCache, NetworkError } from "./cache";

/** Resolve a public GitHub APK or link to the upstream project. This does not verify signatures. */

interface ReleaseAsset { name: string; browser_download_url: string; size: number }
interface GitHubRelease { tag_name: string; published_at: string; html_url: string; assets: ReleaseAsset[]; prerelease: boolean }

export interface ResolvedDownload {
  kind: "apk" | "external";
  url: string;
  label: string;
  fileName?: string;
  sizeMb?: number;
  version?: string;
  source: string;
}

export function ghRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch { return null; }
}

export function pickApkAsset(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  const apks = assets.filter((a) => /\.apk$/i.test(a.name) && !/(debug|test|unsigned)/i.test(a.name));
  if (!apks.length) return undefined;
  const score = (n: string) => {
    const l = n.toLowerCase();
    if (/arm64|arm64-v8a|aarch64/.test(l)) return 100;
    if (/universal|allabi|full/.test(l)) return 90;
    if (/armeabi-v7a|armv7/.test(l)) return 60;
    if (/x86_64/.test(l)) return 40;
    return 75; // unlabelled builds are usually universal
  };
  return [...apks].sort((a, b) => score(b.name) - score(a.name) || b.size - a.size)[0];
}

export async function resolveDownload(_game: Game, port: PortProject): Promise<ResolvedDownload> {
  const source = port.download || port.url;
  if (!source) throw new NetworkError("This project has no published download link", 0);
  const repo = ghRepo(port.url || source);
  if (!repo || !port.apk) {
    return {
      kind: "external",
      url: source,
      label: port.kind === "telegram" ? "Open Telegram channel" : port.kind === "discord" ? "Open Discord" : "Open download source",
      source: new URL(source).hostname,
    };
  }
  const base = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
  const api = `${base}/releases/latest`;
  const cacheKey = `gh:release:${repo.owner}/${repo.repo}`;
  const cached = readCache<GitHubRelease>(cacheKey);
  const releaseList = `${base}/releases?per_page=10`;
  const externalFallback = (): ResolvedDownload => ({
    kind: "external",
    url: /\/releases(\/|$)/.test(port.download) ? port.download : `${port.url.replace(/\/$/, "")}/releases`,
    label: "Open releases page", source: "github.com",
  });

  let release: GitHubRelease | null = null;
  try {
    release = await swrJson<GitHubRelease>(cacheKey, api, 30 * 60 * 1000);
  } catch {
    // No `/latest` (draft/prerelease-only repos) -> read the release index itself.
    if (cached) release = cached.value;
    else {
      try {
        const list = await swrJson<GitHubRelease[]>(`gh:list:${repo.owner}/${repo.repo}`, releaseList, 15 * 60 * 1000);
        release = list.find((r) => pickApkAsset(r.assets ?? [])) ?? list[0] ?? null;
      } catch {
        // The release page is still the correct destination; never fake a download.
        return externalFallback();
      }
    }
  }
  if (!release) return externalFallback();
  const asset = pickApkAsset(release.assets ?? []);
  if (asset) {
    return {
      kind: "apk", url: asset.browser_download_url, label: "Download latest APK",
      fileName: asset.name, sizeMb: Math.round((asset.size / 1_000_000) * 10) / 10,
      version: release.tag_name, source: "github.com",
    };
  }
  return {
    kind: "external", url: port.download.includes("/releases/") ? port.download : release.html_url || `${port.url}/releases`,
    label: "Open releases page", version: release.tag_name, source: "github.com",
  };
}

/** Platform download action. Web triggers a real file download / opens the source. */
export function performDownload(res: ResolvedDownload, onStatus: (m: string) => void) {
  if (Capacitor.isNativePlatform()) {
    void openExternal(res.url).then(() => onStatus(`Opened ${res.source} in your browser`))
      .catch(() => onStatus("Could not open the download link"));
  } else if (res.kind === "apk") {
    const a = document.createElement("a");
    a.href = res.url;
    a.download = res.fileName ?? "port.apk";
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    onStatus(`Downloading ${res.fileName ?? "APK"} from ${res.source}`);
  } else {
    window.open(res.url, "_blank", "noopener,noreferrer");
    onStatus(`Opened ${res.source} in your browser`);
  }
}

/** Record the resolved link for the local history. */
export function rememberDownload(gameId: string, res: ResolvedDownload) {
  writeCache(`download:${gameId}`, { url: res.url, fileName: res.fileName, at: Date.now() }, 30 * 24 * 60 * 60 * 1000);
}
