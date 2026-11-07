#!/usr/bin/env node
/** Verify Android packages and project README claims. Cached results are refreshed after 14 days.
 * Only APK/APKS/XAPK files count; OBB files and CPU architectures are not Android builds.
 * Network failures and rate limits leave prior evidence untouched. Usage: --max=API_CALLS [--force].
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidListRows } from './android-list.mjs';
import { githubRepo, isAndroidPackage, readmeAndroidLine } from './android-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const FILE = path.join(SRC, 'github-repos.json');
const FORCE = process.argv.includes('--force');
const MAX = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1]) || 55;
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const cache = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { repos: {} };
const read = (f, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8')); } catch { return fallback; } };
const candidates = new Map();
const add = (url, priority) => { const key = githubRepo(url); if (key) candidates.set(key, Math.min(priority, candidates.get(key) ?? 99)); };
// New, Android-focused discoveries first; mixed-platform decomp candidates last.
for (const row of read('reddit-candidates.json', [])) add(row.url, 0);
for (const row of read('manual-discovery.json', [])) add(row.url, 0);
for (const rows of Object.values(read('discovery-lists.json', {}))) for (const row of rows) add(row.url, 0);
for (const row of androidListRows(path.join(SRC, 'awesome-android-native-ports.md'))) add(row.url, 0);
// NAPL may contain several game rows for one repository; check that project only once.
const napl = fs.readFileSync(path.join(SRC, 'napl-sheet.csv'), 'utf8');
for (const match of napl.matchAll(/https?:\/\/github\.com\/[^\s,;"<>]+/gi)) add(match[0], 1);
// The issue uses project names rather than canonical game titles. Verify candidates here;
// only map them to games through a separate catalog with a known identity.
for (const match of String(read('portcove.json', {}).body || '').matchAll(/https?:\/\/github\.com\/[^\s|)<>]+/gi)) add(match[0], 2);
for (const p of read('openports.json', {}).ports || []) if (p.platforms?.includes('android')) for (const u of p.sources || []) add(u, 1);
for (const e of read('extras.json', [])) { add(e.url, 2); for (const p of e.siblingPorts || []) add(p.url, 2); }
for (const g of read('decompgames.json', {}).games || []) if (!g.inactive) add(g.url, 3);
// Re-check old cache entries because the old verifier mistakenly included OBB-only releases.
const stale = (e) => !e?.checkedAt || e.apkEvidenceVersion !== 1 || Date.now() - Date.parse(e.checkedAt) > 14 * 86400000;
const queue = [...candidates].filter(([k]) => FORCE || stale(cache.repos[k])).sort((a, b) => a[1] - b[1]);
console.log(`${candidates.size} candidates; ${queue.length} need checking; API budget ${MAX}`);
const headers = { 'user-agent': 'RePortAndroidVerifier/2.0', accept: 'application/vnd.github+json' };
if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
let budget = MAX, limited = false, completed = 0;
async function request(url) {
  if (budget <= 0 || limited) return null;
  budget--;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    if (res.status === 403 || res.status === 429) { limited = true; return null; }
    if (res.status === 404) return { missing: true };
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function verify(key, priority) {
  const old = cache.repos[key] || {};
  const [releases, readme] = await Promise.all([
    request(`https://api.github.com/repos/${key}/releases?per_page=20`),
    request(`https://api.github.com/repos/${key}/readme`),
  ]);
  // Do not downgrade valid evidence because of a transient API failure or quota exhaustion.
  if (!releases || !readme) return;
  if (releases.missing && readme.missing) {
    cache.repos[key] = { ...old, missing: true, checkedAt: new Date().toISOString(), apkEvidenceVersion: 1 };
    return;
  }
  if (!Array.isArray(releases)) return;
  const apkAssets = releases.flatMap((r) => (r.assets || []).filter((a) => isAndroidPackage(a.name)).map((a) => ({ ...a, release: r })));
  const newest = apkAssets[0];
  const line = readme.missing ? '' : readmeAndroidLine(readme.content, key);
  cache.repos[key] = {
    ...old, missing: false, checkedAt: new Date().toISOString(), priority, apkEvidenceVersion: 1,
    hasApk: apkAssets.length > 0, apkAssets: apkAssets.length,
    apkDownloads: apkAssets.reduce((s, a) => s + (a.download_count || 0), 0),
    apkVersion: newest?.release.tag_name || '', apkDate: (newest?.release.published_at || '').slice(0, 10),
    apkRelease: newest?.release.html_url || '', androidReadme: Boolean(line), androidReadmeLine: line,
  };
  completed++;
}
async function worker() {
  while (queue.length && budget >= 2 && !limited) {
    const [key, priority] = queue.shift();
    await verify(key, priority);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(FILE, JSON.stringify(cache));
console.log(`Checked ${completed}; ${Object.values(cache.repos).filter((v) => v.apkEvidenceVersion === 1 && v.hasApk).length} with APKs, ${Object.values(cache.repos).filter((v) => v.androidReadme).length} with Android README evidence; API calls remaining ${budget}${limited ? ' (rate limited)' : ''}`);
