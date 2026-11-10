import type { PortProject } from "@/data/ports";

/**
 * Open the publisher's release page directly; never scan GitHub or guess an APK.
 * Non-GitHub distributors and source-only projects keep their original link.
 */
export function downloadDestination(port: PortProject): string {
  const source = port.download || port.url;
  const repo = githubRepo(source) ?? (port.apk && !port.download ? githubRepo(port.url) : null);
  if (!repo) return source;

  let url: URL;
  try { url = new URL(source); } catch { return source; }
  // A source-only repository is not guaranteed to publish releases.
  if (!port.apk && !/\/releases(?:\/|$)/i.test(url.pathname)) return source;

  const base = `https://github.com/${repo.owner}/${repo.repo}/releases`;
  // GitHub's /latest excludes prereleases; use the release list when the
  // catalog identifies a nightly, beta, alpha or release candidate.
  const isPrerelease = /(?:^|[\W_])(nightly|alpha|beta|preview|pre[-_.]?release|rc\d*)(?:$|[\W_\d])/i
    .test(`${port.version} ${decodeTag(url.pathname)}`);
  return isPrerelease ? base : `${base}/latest`;
}

function githubRepo(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== "github.com" || !["http:", "https:"].includes(parsed.protocol)) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
  } catch { return null; }
}

function decodeTag(path: string): string {
  try { return decodeURIComponent(path); } catch { return path; }
}
