#!/usr/bin/env node
/**
 * Refreshes every upstream port list PortDeck reads and normalises the new entries into
 * data/source/extras.json, which scripts/build-data.mjs merges into the shipped catalog.
 *
 * Sources
 *  1. NAPL community sheet (Google Sheets CSV)            data/source/napl-sheet.csv
 *  2. Awesome Android Native Ports (abduznik)            data/source/awesome-android-native-ports.md
 *  3. OpenPortsGames catalog API (CC BY 4.0)             data/source/openports.json
 *  4. Awesome Decomp Games data feed (auto-refreshed)    data/source/decompgames.json
 *  5. PortCove Android candidate table (GitHub issue)    data/source/portcove.json
 *
 * Every source is cached, so re-runs are cheap and the script works offline with --offline.
 * Entries are de-duplicated by their release URL, so a port listed in several places is only
 * added once and the copy with the strongest real-world signal (downloads, stars) is kept.
 *
 * Usage: node scripts/fetch-sources.mjs [--offline]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const OFFLINE = process.argv.includes('--offline');
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const UA = { 'user-agent': 'PortDeckCatalogSync/1.0 (+https://github.com)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const manifest = fs.existsSync(path.join(SRC, 'sync-manifest.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'sync-manifest.json'), 'utf8')) : { sources: {} };

async function fetchText(url, { tries = 3, json = false } = {}) {
  const headers = { ...UA };
  if (json) headers.accept = 'application/json';
  if (TOKEN && url.includes('api.github.com')) headers.authorization = `Bearer ${TOKEN}`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000), redirect: 'follow' });
      if (res.status === 429 || res.status === 403) {
        await sleep(10000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8'));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => fs.writeFileSync(path.join(SRC, file), JSON.stringify(value));

/* --------------------------------------------------------------- helpers */
const normUrl = (u) => String(u || '').replace(/\/+$/, '').replace(/^http:/, 'https:').toLowerCase();
const repoOf = (u) => {
  try {
    const p = new URL(u).pathname.split('/').filter(Boolean);
    return p.length >= 2 ? `${p[0]}/${p[1]}`.toLowerCase() : '';
  } catch {
    return '';
  }
};

const GENRE_MAP = {
  strategy: 'strategy',
  'action-adventure': 'adventure',
  adventure: 'adventure',
  shooter: 'shooter',
  simulation: 'simulation',
  racing: 'racing',
  rpg: 'rpg',
  roleplaying: 'rpg',
  platformer: 'platformer',
  puzzle: 'puzzle',
  fighting: 'fighting',
  sports: 'sports',
  'open-world': 'sandbox',
  sandbox: 'sandbox',
  horror: 'horror',
  beatemup: 'fighting',
  'beat-\'em-up': 'fighting',
  casual: 'casual',
  indie: 'indie',
  action: 'action',
};

const PLATFORM_MAP = {
  'nintendo 64': 'n64',
  n64: 'n64',
  'ms-dos': 'pc',
  dos: 'pc',
  pc: 'pc',
  windows: 'pc',
  macintosh: 'pc',
  linux: 'pc',
  playstation: 'ps1',
  ps1: 'ps1',
  psx: 'ps1',
  'playstation 2': 'ps2',
  ps2: 'ps2',
  'playstation 3': 'ps3',
  'playstation 4': 'ps4',
  psp: 'psp',
  'playstation portable': 'psp',
  xbox: 'xbox',
  'xbox 360': 'xbox360',
  'xbox one': 'xbox',
  gamecube: 'gamecube',
  wii: 'wii',
  'wii u': 'wiiu',
  switch: 'switch',
  'nintendo switch': 'switch',
  'game boy': 'gb',
  'game boy color': 'gbc',
  'game boy advance': 'gba',
  gba: 'gba',
  'super nintendo': 'snes',
  snes: 'snes',
  nes: 'nes',
  'nintendo entertainment system': 'nes',
  'nintendo ds': 'nds',
  'nintendo 3ds': 'n3ds',
  'sega mega drive / genesis': 'genesis',
  genesis: 'genesis',
  'mega drive': 'genesis',
  'sega cd / mega-cd': 'genesis',
  'sega 32x': 'genesis',
  dreamcast: 'dreamcast',
  'sega saturn': 'saturn',
  saturn: 'saturn',
  arcade: 'pc',
  amiga: 'pc',
  unknown: 'pc',
};

const mapPlatform = (value) => PLATFORM_MAP[String(value || '').trim().toLowerCase()] || '';
const mapGenres = (raw) =>
  String(raw || '')
    .split(/[,;/]/)
    .map((g) => GENRE_MAP[g.trim().toLowerCase()])
    .filter(Boolean);

const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Android targeting phrases we accept as evidence that a project actually ships an Android build. */


/* ------------------------------------------------------- existing entries */
const extras = readJson('extras.json', []);
const knownUrls = new Set(extras.map((e) => normUrl(e.url)));
const githubRepos = readJson('github-repos.json', { repos: {} });
const evidence = (url) => githubRepos.repos[repoOf(url)] || null;
const manualTitles = new Set(extras.filter((e) => e.list === 'manual').map((e) => slug(e.title)));

function push(entry) {
  const url = normUrl(entry.url);
  if (!url) return false;
  if (knownUrls.has(url)) {
    // Enrich an existing entry with data the first source did not have.
    const existing = extras.find((e) => normUrl(e.url) === url);
    if (existing) {
      existing.stars = Math.max(existing.stars || 0, entry.stars || 0);
      existing.downloads = Math.max(existing.downloads || 0, entry.downloads || 0);
      existing.version = existing.version || entry.version || '';
      existing.updated = existing.updated || entry.updated || '';
      existing.originalPlatforms = [...new Set([...(existing.originalPlatforms || []), ...(entry.originalPlatforms || [])])].filter(Boolean);
      existing.status = existing.status || entry.status || '';
      existing.warning = existing.warning || entry.warning || '';
      existing.alsoListedIn = [...new Set([...(existing.alsoListedIn || []), entry.list])];
    }
    return false;
  }
  knownUrls.add(url);
  extras.push(entry);
  return true;
}

/* --------------------------------------------------- 1. NAPL sheet (CSV) */
const NAPL_URL = 'https://docs.google.com/spreadsheets/d/1CO7dH7mbj9sl67g4e94wczHESp0NAsOa7_chKKii9OA/export?format=csv';
if (!OFFLINE) {
  const csv = await fetchText(NAPL_URL);
  if (csv && csv.length > 10000) {
    fs.writeFileSync(path.join(SRC, 'napl-sheet.csv'), csv);
    manifest.sources.napl = { fetchedAt: new Date().toISOString(), bytes: csv.length };
  }
}

/* ------------------------- 2. Awesome Android Native Ports (markdown) */
const AWESOME_URL = 'https://raw.githubusercontent.com/abduznik/awesome-android-native-ports/main/README.md';
if (!OFFLINE) {
  const md = await fetchText(AWESOME_URL);
  if (md && md.includes('Awesome Android Native Ports')) {
    fs.writeFileSync(path.join(SRC, 'awesome-android-native-ports.md'), md);
    manifest.sources.awesomeAndroid = { fetchedAt: new Date().toISOString(), bytes: md.length };
  }
}

/* ------------------------------------- 3. OpenPortsGames catalog (JSON) */
const OPENPORTS_URL = 'https://openportsgames.com/api/ports.json';
let openports = readJson('openports.json', null);
if (!OFFLINE) {
  const raw = await fetchText(OPENPORTS_URL, { json: true });
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.ports) && parsed.ports.length > 100) {
      openports = parsed;
      writeJson('openports.json', { generatedAt: parsed.generatedAt, ports: parsed.ports });
      manifest.sources.openports = { fetchedAt: new Date().toISOString(), generatedAt: parsed.generatedAt, entries: parsed.ports.length };
    }
  } catch {
    /* keep the cached copy */
  }
}
let addedOpen = 0;
for (const p of openports?.ports || []) {
  if (p.kind && p.kind !== 'game') continue;
  if (!p.platforms?.includes('android')) continue;
  const source = (p.sources || []).find((s) => /^https?:\/\//.test(s));
  if (!source) continue;
  const systems = (p.originalSystems || []).map(mapPlatform).filter(Boolean);
  const warning = p.warning || '';
  const notes = [p.notes, warning].filter(Boolean).join(' ');
  const shipsFiles = /distributes the game|ships the game/i.test(warning);
  const needsOwn = /your own|bring your own|needs? (your|the) (game|rom|disc)/i.test(notes);
  const verified = evidence(source);
  addedOpen += push({
    title: p.game || p.title,
    project: p.title && p.title.toLowerCase() !== (p.game || '').toLowerCase() ? p.title : '',
    developer: (p.developers || [])[0] || '',
    platform: systems[0] || 'pc',
    originalPlatforms: systems,
    url: source,
    year: p.originalYear || 0,
    genres: mapGenres(p.genre),
    cover: p.cover?.src || '',
    description: p.summary || '',
    version: p.release?.version || verified?.apkVersion || '',
    updated: p.release?.date || verified?.apkDate || '',
    stars: verified?.stars || 0,
    downloads: verified?.apkDownloads || 0,
    status: p.status || '',
    portType: p.portType || '',
    warning: warning || '',
    files: shipsFiles ? 'none' : needsOwn ? 'files' : '',
    list: 'OpenPortsGames',
    credit: 'OpenPortsGames (CC BY 4.0)',
    alsoListedIn: [],
  })
    ? 1
    : 0;
}

/* ---------------------------------- 4. Awesome Decomp Games data (JSON) */
const DECOMP_URL = 'https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/data/games.json';
let decompgames = readJson('decompgames.json', null);
if (!OFFLINE) {
  const raw = await fetchText(DECOMP_URL, { json: true });
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.games) && parsed.games.length > 100) {
      decompgames = parsed;
      writeJson('decompgames.json', { generatedAt: parsed.generated_at, games: parsed.games });
      manifest.sources.decompGames = { fetchedAt: new Date().toISOString(), generatedAt: parsed.generated_at, entries: parsed.games.length };
    }
  } catch {
    /* keep the cached copy */
  }
}

let addedDecomp = 0;
for (const g of decompgames?.games || []) {
  if (!g.url || g.inactive) continue;
  const repo = repoOf(g.url);
  const verified = evidence(repo);
  const haystack = [g.note, g.description, g.title, g.homepage, g.play_url].filter(Boolean).join(' ');
  // A project only qualifies when an Android build is documented in the release assets or the
  // project text itself. "A PC port of the Android version" is the reverse direction and is excluded.
  const reverseDirection = /port of the android (version|build)|android (armv7|version) of/i.test(haystack);
  const textual = false; // Mixed-platform source notes are discovery leads, not proof.
  const verifiedApk = Boolean(verified?.apkEvidenceVersion === 1 && verified?.hasApk);
  if (reverseDirection) continue;
  if (!verifiedApk && !verified?.androidReadme && !textual) continue;
  if (verified?.missing || verified?.archived) continue;
  const platform = mapPlatform(g.platform) || 'pc';
  const cleaned = (g.title || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  addedDecomp += push({
    title: cleaned || g.title,
    project: /\(([^)]+)\)\s*$/.exec(g.title || '')?.[1] || '',
    platform,
    originalPlatforms: [platform],
    url: verifiedApk && verified.releaseUrl ? g.url : g.release_url || g.url,
    year: 0,
    genres: mapGenres(g.type === 'engine-remake' ? '' : ''),
    cover: '',
    description: g.note || g.description || '',
    version: verifiedApk ? verified.apkVersion : g.release || '',
    updated: verifiedApk ? verified.apkDate : g.release_date ? String(g.release_date).slice(0, 10) : '',
    stars: verified?.stars || g.stars || 0,
    downloads: verifiedApk ? verified.apkDownloads : 0,
    status: '',
    files: g.needs_assets ? 'files' : '',
    list: 'Awesome Decomp Games',
    credit: 'Awesome Decomp Games',
    alsoListedIn: [],
  })
    ? 1
    : 0;
}

/* ------------------------------ 5. PortCove Android candidate table */
const PORTCOVE_ISSUE = 'https://api.github.com/repos/boburning/portcove/issues/410';
let portcove = readJson('portcove.json', null);
if (!OFFLINE) {
  const raw = await fetchText(PORTCOVE_ISSUE, { json: true });
  try {
    const parsed = JSON.parse(raw);
    if (parsed.body) {
      portcove = { updated_at: parsed.updated_at, body: parsed.body };
      writeJson('portcove.json', portcove);
      manifest.sources.portcove = { fetchedAt: new Date().toISOString(), updatedAt: parsed.updated_at };
    }
  } catch {
    /* keep the cached copy */
  }
}
let addedPortcove = 0;
if (portcove?.body) {
  const rows = portcove.body.split('\n').filter((l) => /^\|\s*#?\d+\s*\|/.test(l));
  for (const line of rows) {
    const cells = line.split('|').map((c) => c.trim());
    const label = (cells[1] || '').replace(/^#\d+\s*/, '');
    const linkCell = cells[2] || '';
    const link = /https:\/\/[^\s)|]+/.exec(linkCell)?.[0];
    const finding = (cells[3] || '').replace(/\s+/g, ' ').trim();
    if (!label || !link) continue;
    const repo = repoOf(link.replace(/\/releases\/tag\/.*$/, ''));
    const projectUrl = repo ? `https://github.com/${repo}` : link.replace(/\/releases\/tag\/.*$/, '');
    if (knownUrls.has(normUrl(projectUrl)) || knownUrls.has(normUrl(link))) continue;
    // Keep only candidates that are Android deliverables.
    if (!/android|\bapk\b/i.test(`${linkCell} ${finding}`)) continue;
    addedPortcove += push({
      title: label,
      platform: '',
      url: projectUrl,
      year: 0,
      genres: [],
      description: '',
      version: /tag\/([^)]+)$/.exec(link)?.[1] || '',
      notes: finding,
      list: 'PortCove candidate research',
      credit: 'PortCove issue research',
      alsoListedIn: [],
    })
      ? 1
    : 0;
  }
}

/* ----------------------------------------------------------------- prune */
// Automated sources are re-evaluated on every run, so an entry that no longer qualifies (its
// repository vanished, or it turned out to publish no Android build) disappears instead of
// lingering. Curated entries are never pruned automatically.
const AUTOMATED = new Set(['OpenPortsGames', 'Awesome Decomp Games']);
let pruned = 0;
for (let i = extras.length - 1; i >= 0; i--) {
  const e = extras[i];
  if (!AUTOMATED.has(e.list)) continue;
  const repo = evidence(e.url);
  const haystack = [e.description, e.project, e.title, e.notes].filter(Boolean).join(' ');
  const reverse = /port of the android (version|build)|android (armv7|version) of/i.test(haystack);
  const textual = false; // Rebuilt from original sources with per-port evidence below.
  const keep = !repo?.missing && !repo?.archived && !reverse && (repo?.apkEvidenceVersion === 1 && repo?.hasApk || repo?.androidReadme || textual);
  if (!keep) {
    extras.splice(i, 1);
    pruned++;
  }
}

/* ------------------------------------------------------------- write out */
// Manual curation always wins over any automated source.
const ordered = [...extras.filter((e) => e.list === 'manual'), ...extras.filter((e) => e.list !== 'manual')];
writeJson('extras.json', ordered);
if (!OFFLINE) {
  const fetched = Object.values(manifest.sources).map((s) => s.fetchedAt).filter(Boolean).sort();
  manifest.lastRun = fetched.at(-1) || manifest.lastRun || '';
}
manifest.counts = { openports: addedOpen, decompGames: addedDecomp, portcove: addedPortcove, pruned, total: ordered.length };
manifest.protectedManual = ordered.filter((e) => e.list === 'manual').length;
writeJson('sync-manifest.json', manifest);
console.log(`sources synced: +${addedOpen} OpenPortsGames, +${addedDecomp} Decomp Games, +${addedPortcove} PortCove, -${pruned} pruned → ${ordered.length} entries`);
