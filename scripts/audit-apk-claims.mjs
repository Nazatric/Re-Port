// Checks every catalog port that claims an APK: does its download release really contain an .apk file?
// Usage: node scripts/audit-apk-claims.mjs [outFile]   (needs gh auth; network to api.github.com)
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const catalog = JSON.parse(await readFile(new URL("../src/data/catalog.json", import.meta.url), "utf8"));

const ghJson = async (path) => {
  try {
    const { stdout } = await run("gh", ["api", path], { maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, data: JSON.parse(stdout) };
  } catch (err) {
    const msg = String(err?.stderr || err?.message || "");
    return { ok: false, status: /HTTP 404|Not Found/.test(msg) ? 404 : 0, message: msg.slice(0, 200) };
  }
};

const repoOf = (url) => {
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(url || "");
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null;
};
const tagOf = (download) => {
  const m = /\/releases\/tag\/([^?#]+)/.exec(download || "");
  return m ? decodeURIComponent(m[1]) : null;
};

// One row per APK-claiming port.
const rows = [];
for (const g of catalog.games) for (const p of g.ports) if (p.apk) rows.push({ gameId: g.id, title: g.title, port: p.name, url: p.url, download: p.download });

const repoCache = new Map();
const repoKey = (r) => `${r.owner}/${r.repo}`.toLowerCase();
const uniqueRepos = [...new Map(rows.map((r) => [repoOf(r.url) && repoKey(repoOf(r.url)), repoOf(r.url)])).values()].filter(Boolean);
const releaseCache = new Map();

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }));
}

await pool(uniqueRepos, 6, async (r) => {
  repoCache.set(repoKey(r), await ghJson(`repos/${r.owner}/${r.repo}`));
});

const results = [];
await pool(rows, 6, async (row) => {
  const r = repoOf(row.url);
  if (!r) return results.push({ ...row, verdict: "not-github" });
  const repo = repoCache.get(repoKey(r));
  if (!repo?.ok) return results.push({ ...row, verdict: repo?.status === 404 ? "repo-missing" : "repo-error", detail: repo?.message });
  if (repo.data.archived) return results.push({ ...row, verdict: "archived" });
  const tag = tagOf(row.download);
  const relKey = `${repoKey(r)}@${tag ?? "latest"}`;
  if (!releaseCache.has(relKey)) {
    releaseCache.set(relKey, await ghJson(tag ? `repos/${r.owner}/${r.repo}/releases/tags/${encodeURIComponent(tag)}` : `repos/${r.owner}/${r.repo}/releases/latest`));
  }
  const rel = releaseCache.get(relKey);
  if (!rel.ok) {
    // The release page is not a tagged release: check whether ANY release has an APK.
    const all = await ghJson(`repos/${r.owner}/${r.repo}/releases?per_page=30`);
    const anyApk = all.ok && all.data.some((x) => (x.assets ?? []).some((a) => /\.apk$/i.test(a.name)));
    return results.push({ ...row, verdict: anyApk ? "apk-in-other-release" : "no-release", detail: tag ?? "latest" });
  }
  const apks = (rel.data.assets ?? []).filter((a) => /\.apk$/i.test(a.name)).map((a) => a.name);
  results.push({ ...row, verdict: apks.length ? "apk-ok" : "release-without-apk", apks, releaseTag: rel.data.tag_name });
});

const counts = {};
for (const r of results) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
results.sort((a, b) => a.verdict.localeCompare(b.verdict) || a.title.localeCompare(b.title));
const out = { generated: new Date().toISOString(), totalApkClaims: rows.length, counts, results };
const file = process.argv[2] ?? "/tmp/apk-claims.json";
await writeFile(file, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(counts));
console.log("wrote", file);
