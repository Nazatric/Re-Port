import packageInfo from "../../package.json";

/** This version is also written to Android's versionName by prepare-android.mjs. */
export const APP_VERSION = packageInfo.version;
export const RELEASES_URL = "https://github.com/Nazatric/Re-Port/releases/latest";
const API_URL = "https://api.github.com/repos/Nazatric/Re-Port/releases/latest";
export type UpdateResult = { status: "new" | "current"; version: string } | { status: "error" };

/** Compare stable three-part release versions. Reject unknown tag formats rather than guess. */
export function compareVersions(a: string, b: string): number | null {
  const parse = (v: string) => {
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(v.trim());
    if (!match) return null;
    const parts = match.slice(1).map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
  };
  const left = parse(a), right = parse(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

export async function checkForUpdate(fetcher: typeof fetch = fetch): Promise<UpdateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(API_URL, { headers: { Accept: "application/vnd.github+json" }, signal: controller.signal });
    if (!response.ok) return { status: "error" };
    const release: unknown = await response.json();
    if (!release || typeof release !== "object" || !("tag_name" in release) || typeof release.tag_name !== "string") return { status: "error" };
    const comparison = compareVersions(release.tag_name, APP_VERSION);
    if (comparison === null) return { status: "error" };
    return { status: comparison > 0 ? "new" : "current", version: release.tag_name.replace(/^v/, "") };
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}
