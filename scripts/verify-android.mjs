#!/usr/bin/env node
/**
 * Verifies, against the GitHub API, that a candidate project really publishes an Android build.
 * For every repository it records the newest release that ships an APK, its version and date, and
 * the real download counts of those APK assets. That evidence is what lets the catalog include a
 * port (and pick the most downloaded fork) without anybody hand-curating it.
 *
 * Results are cached in data/source/github-repos.json and the script is resumable: each run only
 * spends API calls on repositories that are missing or stale, so it can run on a schedule with an
 * unauthenticated quota and finish the backlog over a few runs.
 *
 * Usage: node scripts/verify-android.mjs [--force] [--max=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const FILE = path.join(SRC, 'github-repos.json');
const FORCE = process.argv.includes('--force');
const MAX = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1]) || 55;
const TTL_DAYS = 14;
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const cache = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { repos: {} };
const stale = (entry) => !entry?.checkedAt || Date.now() - Date.parse(entry.checkedAt) > TTL_DAYS * 86400000;

/** Which source a repository came from decides how urgently it needs verification. */
const PRIORITY = {
  decompgames: 10,
  'Awesome Decomp Games': 10,
  'OpenPortsGames': 20,
  openportsgames: 20,
  'Awesome Android Native Ports': 30,
  'Community research (GitHub)': 15,
};

/** Collect candidate repositories from every source that has not been verified yet. */
function collect() {
  const wanted = new Map();
  const order = [];
  const add = (url, reason) => {
    try {
      const u = new URL(url);
      if (u.host !== 'github.com') return;
      const [owner, repo] = u.pathname.split('/').filter(Boolean);
      if (!owner || !repo) return;
      const key = `${owner}/${repo}`.toLowerCase();
      const existing = wanted.get(key) || { owner, repo, reasons: [], priority: 99 };
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      existing.priority = Math.min(existing.priority, PRIORITY[reason] ?? 50);
      if (!wanted.has(key)) order.push(key);
      wanted.set(key, existing);
    } catch {
      /* not GitHub */
    }
  };

  const read = (f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    } catch {
      return null;
    }
  };

  for (const p of read('openports.json')?.ports || []) {
    if (!p.platforms?.includes('android')) continue;
    for (const s of p.sources || []) add(s, 'openportsgames');
  }
  for (const g of read('decompgames.json')?.games || []) {
    if (g.url) add(g.url, 'decompgames');
  }
  for (const e of read('extras.json') || []) {
    if (e.url) add(e.url, e.list || 'extras');
  }
  // Verification is rate limited, so spend the budget where it changes catalog decisions first.
  return order.map((key) => wanted.get(key)).sort((a, b) => a.priority - b.priority);
}

const candidates = collect().filter((c) => FORCE || stale(cache.repos[`${c.owner}/${c.repo}`.toLowerCase()]));
console.log(`candidates: ${collect().length} total, ${candidates.length} need verification`);

const headers = { 'user-agent': 'PortDeckAndroidVerifier/1.0', accept: 'application/vnd.github+json' };
if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
const APK = /\.(apk|apks|xapk|obb)$/i;

let budget = MAX;
let limited = false;

async function verify({ owner, repo, priority }) {
  const key = `${owner}/${repo}`.toLowerCase();
  const entry = cache.repos[key] || {};
  try {
    // Release assets are the ground truth for "does an Android build exist", so spend the first
    // call there. Repository metadata (stars, archived) is only fetched when it adds information.
    const rel = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`, { headers, signal: AbortSignal.timeout(20000) });
    if (rel.status === 403 || rel.status === 429) {
      limited = true;
      return null;
    }
    if (rel.status === 404) return { ...entry, missing: true, checkedAt: new Date().toISOString() };
    if (!rel.ok) throw new Error(`releases HTTP ${rel.status}`);
    budget--;
    const releases = await rel.json();

    const apkAssets = releases.flatMap((r) => (r.assets || []).filter((a) => APK.test(a.name)).map((a) => ({ ...a, release: r.tag_name, date: r.published_at })));
    const newestApk = apkAssets.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const latest = releases[0];

    let meta = {};
    if (apkAssets.length && (!entry.stars || entry.stars === 0)) {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers, signal: AbortSignal.timeout(20000) });
      if (res.status === 403 || res.status === 429) {
        limited = true;
      } else if (res.ok) {
        budget--;
        const info = await res.json();
        meta = { archived: Boolean(info.archived), pushedAt: (info.pushed_at || '').slice(0, 10), stars: info.stargazers_count || 0 };
      }
    }

    return {
      ...entry,
      checkedAt: new Date().toISOString(),
      priority,
      archived: meta.archived ?? entry.archived ?? false,
      pushedAt: meta.pushedAt ?? entry.pushedAt ?? '',
      stars: meta.stars ?? entry.stars ?? 0,
      hasApk: apkAssets.length > 0,
      apkAssets: apkAssets.length,
      apkDownloads: apkAssets.reduce((sum, a) => sum + (a.download_count || 0), 0),
      apkVersion: newestApk?.release || '',
      apkDate: newestApk ? String(newestApk.date).slice(0, 10) : '',
      releaseTag: latest?.tag_name || '',
      releaseDate: latest?.published_at ? String(latest.published_at).slice(0, 10) : '',
      releaseUrl: newestApk ? `https://github.com/${owner}/${repo}/releases` : '',
      androidName: /android|apk|arm64/i.test(JSON.stringify(apkAssets.slice(0, 12).map((a) => a.name))),
    };
  } catch {
    return { ...entry, checkedAt: new Date().toISOString() };
  }
}

for (const candidate of candidates) {
  if (budget <= 0 || limited) break;
  const result = await verify(candidate);
  if (!result) break;
  cache.repos[`${candidate.owner}/${candidate.repo}`.toLowerCase()] = result;
}

fs.writeFileSync(FILE, JSON.stringify(cache));
const all = Object.entries(cache.repos);
console.log(
  `verified ${all.length} repos, ${all.filter(([, v]) => v.hasApk).length} publish an APK, ${all.filter(([, v]) => v.missing).length} gone; budget left ${Math.max(budget, 0)}${limited ? ' (rate limited)' : ''}`,
);
