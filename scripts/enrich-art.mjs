#!/usr/bin/env node
/**
 * Adds real box art and in-game screenshots to console games using the Libretro thumbnail
 * project (free, no API key). For each game it probes a handful of naming variants against
 * `Named_Boxarts` and `Named_Snaps`, keeps the first hit of each kind, and caches the answer in
 * data/source/art-map.json so repeat runs cost almost nothing.
 *
 * The result is read by scripts/build-data.mjs: `cover` fills missing art, `shots` fills the
 * "How it looks" gallery.
 *
 * Usage: node scripts/enrich-art.mjs [--max=300] [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const FILE = path.join(SRC, 'art-map.json');
const MAX = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1]) || 260;
const FORCE = process.argv.includes('--force');

const raw = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const normTitle = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[™®©\u2060]/g, '').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '');
const map = {};
for (const [k, v] of Object.entries(raw)) map[normTitle(v?.title || k)] = v;
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));

const SYSTEMS = {
  n64: 'Nintendo - Nintendo 64',
  gba: 'Nintendo - Game Boy Advance',
  gbc: 'Nintendo - Game Boy Color',
  gb: 'Nintendo - Game Boy',
  snes: 'Nintendo - Super Nintendo Entertainment System',
  nes: 'Nintendo - Entertainment System',
  genesis: 'Sega - Mega Drive - Genesis',
  ps1: 'Sony - PlayStation',
  psx: 'Sony - PlayStation',
  nds: 'Nintendo - Nintendo DS',
  n3ds: 'Nintendo - Nintendo 3DS',
  saturn: 'Sega - Saturn',
  dreamcast: 'Sega - Dreamcast',
  psp: 'Sony - PlayStation Portable',
  sega32x: 'Sega - 32X',
  segacd: 'Sega - Mega-CD',
};

const REGIONS = ['', ' (USA)', ' (USA, Europe)', ' (Europe)', ' (World)', ' (USA) (Rev 1)', ' (USA, Europe) (Rev 1)', ' (USA) (En,Ja)', ' (Europe) (En,Fr,De,Es,It)'];

function candidates(title) {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[:/\\|]\s*/g, ' - ')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\bspecial edition\b|\bdefinitive edition\b|\bgoty\b|\bgold edition\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const forms = new Set([base, base.replace(/\s*-\s*/g, ' '), base.replace(/[',.!]/g, '')]);
  const out = [];
  for (const form of forms) {
    for (const region of REGIONS) out.push(`${form}${region}`);
  }
  return [...new Set(out)].slice(0, 12);
}

const urlFor = (system, type, name) =>
  `https://thumbnails.libretro.com/${encodeURIComponent(system)}/${type}/${encodeURIComponent(`${name}.png`)}`;

async function exists(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000) });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return res.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return false;
}

const pending = catalog.games.filter((g) => {
  const system = SYSTEMS[g.platform];
  if (!system) return false;
  const entry = map[normTitle(g.title)];
  if (!entry) return true;
  if (FORCE) return true;
  return !entry.cover && !entry.shots?.length;
});

console.log(`artwork candidates: ${pending.length} console games (of ${catalog.games.length})`);
let done = 0;
let foundCover = 0;
let foundShots = 0;

async function enrich(game) {
  const system = SYSTEMS[game.platform];
  const names = candidates(game.title);
  const entry = { system, names: names.slice(0, 3), cover: map[game.id]?.cover || '', shots: map[game.id]?.shots || [] };
  if (!entry.cover || !entry.shots.length) {
    for (const name of names) {
      if (!entry.cover && (await exists(urlFor(system, 'Named_Boxarts', name)))) {
        entry.cover = urlFor(system, 'Named_Boxarts', name);
        foundCover++;
      }
      if (entry.shots.length < 2 && (await exists(urlFor(system, 'Named_Snaps', name)))) {
        const snap = urlFor(system, 'Named_Snaps', name);
        if (!entry.shots.includes(snap)) {
          entry.shots.push(snap);
          foundShots++;
        }
      }
      if (entry.cover && entry.shots.length >= 2) break;
    }
  }
  map[key] = entry;
}

const queue = pending.slice(0, MAX);
const workers = Array.from({ length: 18 }, async () => {
  while (queue.length) {
    const game = queue.shift();
    await enrich(game);
    if (++done % 25 === 0) {
      fs.writeFileSync(FILE, JSON.stringify(map));
      console.log(`${done}/${MAX} | cover ${foundCover} | snaps ${foundShots}`);
    }
    await new Promise((r) => setTimeout(r, 60));
  }
});
await Promise.all(workers);
fs.writeFileSync(FILE, JSON.stringify(map));

const withCover = Object.values(map).filter((e) => e.cover).length;
const withShots = Object.values(map).filter((e) => e.shots?.length).length;
console.log(`artwork map: ${Object.keys(map).length} games, ${withCover} box arts, ${withShots} with screenshots (run again to cover more)`);
