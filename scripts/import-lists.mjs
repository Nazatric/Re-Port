#!/usr/bin/env node
/**
 * Imports ports from community lists that are not in the main sheet:
 *   - data/source/awesome-android-native-ports.md   (abduznik/awesome-android-native-ports)
 *   - data/source/manual-picks.json                 (projects found through GitHub topic searches)
 * Game metadata (cover, summary, release year, genre) comes from Wikipedia and Wikidata
 * with strict title matching. Output: data/source/extras.json (consumed by build-data.mjs).
 *
 * Usage: node scripts/import-lists.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const CACHE = path.join(SRC, 'wiki-cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const UA = { 'user-agent': 'PortDeckBuild/1.0 (catalog build script)', accept: 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '');

/* ----------------------------------------------------------- parsing */
const md = fs.readFileSync(path.join(SRC, 'awesome-android-native-ports.md'), 'utf8').split('\n');
const SKIP_SECTIONS = ['Contents', 'Tools & Frameworks', 'Related Lists', 'Contributing', 'Disclaimer', 'Credits'];
const rows = [];
let section = '';
for (const line of md) {
  if (line.startsWith('## ')) {
    section = line.slice(3).trim();
    continue;
  }
  if (SKIP_SECTIONS.includes(section)) continue;
  const m = /^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|?\s*$/.exec(line);
  if (m) rows.push({ section, raw: m[1].trim(), url: m[2].trim(), note: m[3].trim(), author: m[4].trim() });
}
const manual = fs.existsSync(path.join(SRC, 'manual-picks.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'manual-picks.json'), 'utf8')) : [];
for (const p of manual) rows.push({
  section: p.source || 'manual',
  raw: p.title,
  url: p.url,
  note: p.note || '',
  author: p.developer,
  project: p.project || '',
  platform: p.platform,
  downloads: p.downloads || 0,
  year: p.year || 0,
  version: p.version || '',
  updated: p.updated || '',
  lifecycle: p.lifecycle || '',
  works: p.works || '',
  controller: p.controller || '',
  files: p.files || '',
  sharedProject: p.sharedProject === true,
  manualDescription: p.description || '',
  manual: true,
});
console.log('rows parsed:', rows.length);

const PLATFORM_RULES = [
  [/game ?cube|\bgcn\b/i, 'gamecube'],
  [/wii u/i, 'wiiu'],
  [/\bwii\b/i, 'wii'],
  [/nintendo switch|switch game|of the switch|\(switch\)|for switch/i, 'switch'],
  [/\bn64\b|nintendo 64/i, 'n64'],
  [/xbox 360/i, 'xbox360'],
  [/original xbox|\(xbox\)|xbox game|\bxbox\b/i, 'xbox'],
  [/playstation 2|\bps2\b/i, 'ps2'],
  [/playstation portable|\bpsp\b/i, 'psp'],
  [/playstation 3|\bps3\b/i, 'ps3'],
  [/playstation|\bps1\b|\bpsx\b/i, 'ps1'],
  [/game boy advance|\bgba\b/i, 'gba'],
  [/game boy color|\bgbc\b/i, 'gbc'],
  [/game boy|\bgb\b/i, 'gb'],
  [/\bsnes\b|super nintendo|super famicom/i, 'snes'],
  [/\bnes\b|famicom/i, 'nes'],
  [/3ds/i, 'n3ds'],
  [/nintendo ds|\bnds\b|\bds\b/i, 'nds'],
  [/mega drive|sega genesis|\bgenesis\b/i, 'genesis'],
  [/dreamcast/i, 'dreamcast'],
  [/saturn/i, 'saturn'],
];
const SECTION_DEFAULT = { 'N64: Recompiled': 'n64', 'Xbox 360 Recompilations': 'xbox360' };

function inferPlatform(r, parenthetical) {
  if (r.platform) return r.platform;
  if (SECTION_DEFAULT[r.section]) return SECTION_DEFAULT[r.section];
  for (const [re, id] of PLATFORM_RULES) if (re.test(parenthetical)) return id;
  for (const [re, id] of PLATFORM_RULES) if (re.test(r.note)) return id;
  return 'pc';
}

const isEngine = (r) => /\band more\b|\bgames\)|^classic adventure|^gamemaker games/i.test(r.raw) || r.section === 'Games on Their Own Runtimes & Launchers' && /\(.*\)/.test(r.raw) && /games?\b/i.test(r.raw);
const PLATFORM_WORDS = /^(gamecube|wii u?|xbox( 360)?|ps[123]|psp|switch|n64|android|android and .*|ios|pc|gba|snes|nes|nds|3ds|dual screen|enhanced|android and quest|apple.*)$/i;

function splitTitle(raw) {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw);
  if (!m) return { title: raw, paren: '' };
  return { title: m[1].trim(), paren: m[2].trim() };
}

/* -------------------------------------------------------- wikipedia */
let failures = 0;
async function getJson(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(15000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch {
      await sleep(1500);
    }
  }
  failures++;
  return null;
}

async function wikiSummary(title) {
  return getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`);
}

function acceptable(sum, wanted) {
  if (!sum || sum.type !== 'standard') return false;
  if (!/game/i.test(sum.description || '')) return false;
  const a = norm(String(sum.title).replace(/\s*\(.*?\)\s*$/, ''));
  const b = norm(wanted);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

async function lookup(title) {
  const key = norm(title);
  if (cache[key]) return cache[key];
  if (key in cache && cache[key] === false) return null;
  if (process.env.CACHE_ONLY) return null; // use only what is already cached (no network)
  const failuresBefore = failures;
  let found = null;
  for (const cand of [`${title} (video game)`, title]) {
    const s = await wikiSummary(cand);
    if (acceptable(s, title)) {
      found = s;
      break;
    }
  }
  if (!found) {
    const q = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=2&format=json&srsearch=${encodeURIComponent(title + ' video game')}`);
    for (const hit of q?.query?.search || []) {
      const s = await wikiSummary(hit.title);
      if (acceptable(s, title)) {
        found = s;
        break;
      }
    }
  }
  if (failures > failuresBefore) return null; // transient errors are never cached
  cache[key] = found
    ? {
        page: found.title,
        description: found.description,
        extract: found.extract,
        image: (found.originalimage?.source || found.thumbnail?.source || '').split('?')[0],
        qid: found.wikibase_item || '',
      }
    : false;
  return cache[key] || null;
}

/* --------------------------------------------------------- wikidata */
const GENRE_RULES = [
  [/shooter|shoot/i, 'shooter'],
  [/platform/i, 'platformer'],
  [/racing|kart/i, 'racing'],
  [/role-playing|rpg|roguelike|dungeon crawl/i, 'rpg'],
  [/strategy|tactic|tower defense|4x|real-time/i, 'strategy'],
  [/horror/i, 'horror'],
  [/fighting|beat/i, 'fighting'],
  [/simulat|management|flight|city-building|construction|farming/i, 'simulation'],
  [/puzzle/i, 'puzzle'],
  [/sport|football|soccer|basketball|golf|wrestling|skate/i, 'sports'],
  [/sandbox|open world|survival/i, 'sandbox'],
  [/adventure|point-and-click|visual novel|metroidvania/i, 'adventure'],
  [/action/i, 'action'],
  [/party|music|rhythm|pinball/i, 'casual'],
];
async function wikidataGenres(qids) {
  const result = {};
  const unique = [...new Set(qids.filter(Boolean))];
  const genreIds = new Set();
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=claims&format=json`);
    for (const q of chunk) {
      const claims = j?.entities?.[q]?.claims?.P136 || [];
      result[q] = claims.map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
      result[q].forEach((g) => genreIds.add(g));
    }
  }
  const labels = {};
  const gids = [...genreIds];
  for (let i = 0; i < gids.length; i += 40) {
    const chunk = gids.slice(i, i + 40);
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=en&format=json`);
    for (const g of chunk) labels[g] = j?.entities?.[g]?.labels?.en?.value || '';
  }
  const out = {};
  for (const q of unique) {
    const ids = [];
    for (const g of result[q] || []) {
      const label = labels[g] || '';
      for (const [re, id] of GENRE_RULES) if (re.test(label) && !ids.includes(id)) ids.push(id);
    }
    out[q] = ids.slice(0, 3);
  }
  return out;
}

/* -------------------------------------------------------------- main */
const prepared = [];
const engineOut = [];
for (const r of rows) {
  const { title, paren } = splitTitle(r.raw);
  if (isEngine(r)) {
    engineOut.push({ title: r.raw.replace(/\s*\(.*\)\s*$/, '') === r.raw ? r.raw : paren || r.raw, note: r.note, url: r.url, author: r.author });
    continue;
  }
  const project = r.project || (paren && !PLATFORM_WORDS.test(paren) ? paren : '');
  prepared.push({ ...r, title, project, platform: inferPlatform(r, paren) });
}

// strip platform tags from titles like "Animal Crossing (GameCube)" handled above; resolve wikipedia
const queue = [...new Set(prepared.map((p) => p.title))];
let idx = 0;
async function worker() {
  while (idx < queue.length) {
    const t = queue[idx++];
    await lookup(t);
    if (!process.env.CACHE_ONLY) await sleep(450);
    if (idx % 20 === 0) {
      fs.writeFileSync(CACHE, JSON.stringify(cache));
      console.log(`lookup ${idx}/${queue.length}`);
    }
  }
}
await worker();
fs.writeFileSync(CACHE, JSON.stringify(cache));

const genreMap = await wikidataGenres(queue.map((t) => cache[norm(t)]?.qid));

const extras = [];
for (const p of prepared) {
  const w = cache[norm(p.title)];
  const year = Number(p.year) || (w ? Number((/(\d{4})/.exec(w.description) || [])[1]) || 0 : 0);
  const genres = w ? genreMap[w.qid] || [] : [];
  const extract = w?.extract ? w.extract.replace(/\s+/g, ' ').trim() : '';
  extras.push({
    title: p.title,
    project: p.project,
    platform: p.platform,
    url: p.url,
    developer: p.author,
    year,
    genres,
    cover: w?.image || '',
    description: p.manualDescription || extract,
    descSource: extract && !p.manualDescription ? 'wikipedia' : undefined,
    notes: p.note,
    added: '2026-10-21',
    files: p.files || (/bring your own|needs your|requires|your own|original game|from your|rom|disc|iso/i.test(p.note) ? 'files' : ''),
    works: p.works || '',
    controller: p.controller || '',
    downloads: Number(p.downloads) || 0,
    version: p.version || '',
    updated: p.updated || '',
    lifecycle: p.lifecycle || undefined,
    sharedProject: p.sharedProject || false,
    list: p.manual ? `Community research (${p.source || 'GitHub'})` : 'Awesome Android Native Ports',
  });
}
for (const e of engineOut) {
  extras.push({
    title: e.title,
    platform: 'engine',
    url: e.url,
    developer: e.author,
    description: e.note,
    genres: [],
    added: '2026-10-21',
    list: 'Awesome Android Native Ports',
  });
}
fs.writeFileSync(path.join(SRC, 'extras.json'), JSON.stringify(extras, null, 1));
const withCover = extras.filter((e) => e.cover).length;
console.log(`extras written: ${extras.length} (covers ${withCover}, genres ${extras.filter((e) => e.genres.length).length}, engines ${engineOut.length})`);
