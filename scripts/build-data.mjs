#!/usr/bin/env node
/**
 * Builds src/data/catalog.json from the community port sheet (data/source/napl-sheet.csv),
 * the optional Steam artwork map (data/source/steam-map.json) and curated extras
 * (data/source/extras.json).
 *
 * Usage: node scripts/build-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const OUT = path.join(ROOT, 'src/data/catalog.json');

/* ------------------------------------------------------------------ CSV */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
      continue;
    }
    if (c === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }
    if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((v) => v.trim())) rows.push(row);
  }
  const headers = rows.shift().map((h) => h.replace(/^\uFEFF/, '').trim().toUpperCase());
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

/* ------------------------------------------------------------ helpers */
const slugify = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normTitle = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[™®©⁠]/g, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '');

const clean = (v) => {
  const s = String(v ?? '').replace(/[⁠​]/g, '').trim();
  return s === '-' || s === '--' || /^no information available$/i.test(s) ? '' : s;
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})[,\s]+([A-Za-z]+)(?:[,\s]+(\d{1,2}))?/);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase().slice(0, 3)));
    if (mi >= 0) return `${m[1]}-${String(mi + 1).padStart(2, '0')}-${String(m[3] || 1).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01-01`;
  return '';
}

/* ------------------------------------------------------ platform table */
const PLATFORMS = {
  Others: { id: 'pc', name: 'PC and more', short: 'PC' },
  'XBOX 360': { id: 'xbox360', name: 'Xbox 360', short: '360' },
  'Nintendo 64': { id: 'n64', name: 'Nintendo 64', short: 'N64' },
  XBOX: { id: 'xbox', name: 'Xbox', short: 'Xbox' },
  'Android (32 to 64bits)': { id: 'android64', name: 'Android 64-bit rebuilds', short: 'A64' },
  GameCube: { id: 'gamecube', name: 'GameCube', short: 'GCN' },
  'Nintendo Switch': { id: 'switch', name: 'Nintendo Switch', short: 'NSW' },
  'Nintendo Switch  2': { id: 'switch2', name: 'Nintendo Switch 2', short: 'NS2' },
  Playstation: { id: 'ps1', name: 'PlayStation', short: 'PS1' },
  IOS: { id: 'ios', name: 'iOS', short: 'iOS' },
  'Game Boy Color': { id: 'gbc', name: 'Game Boy Color', short: 'GBC' },
  'Gameboy Advance': { id: 'gba', name: 'Game Boy Advance', short: 'GBA' },
  'Multi-Game Apps': { id: 'engine', name: 'Engines and launchers', short: 'ENG' },
  'Super Nintendo': { id: 'snes', name: 'Super Nintendo', short: 'SNES' },
  'Nintendo Wii': { id: 'wii', name: 'Wii', short: 'Wii' },
  'Playstation 2': { id: 'ps2', name: 'PlayStation 2', short: 'PS2' },
  'Playstation Portable': { id: 'psp', name: 'PlayStation Portable', short: 'PSP' },
  'Game Boy': { id: 'gb', name: 'Game Boy', short: 'GB' },
  'Playstation 4': { id: 'ps4', name: 'PlayStation 4', short: 'PS4' },
  'Nintendo Entertainment System': { id: 'nes', name: 'NES', short: 'NES' },
  'Nintendo Wii U': { id: 'wiiu', name: 'Wii U', short: 'WiiU' },
  'Nvidia Shield': { id: 'shield', name: 'Nvidia Shield', short: 'SHD' },
  'Nintendo DS': { id: 'nds', name: 'Nintendo DS', short: 'NDS' },
  'Nintendo 3DS': { id: 'n3ds', name: 'Nintendo 3DS', short: '3DS' },
  'Playstation 3': { id: 'ps3', name: 'PlayStation 3', short: 'PS3' },
  'Sega Genesis': { id: 'genesis', name: 'Sega Genesis', short: 'MD' },
  'Sega Dreamcast': { id: 'dreamcast', name: 'Sega Dreamcast', short: 'DC' },
  'Sega Saturn': { id: 'saturn', name: 'Sega Saturn', short: 'SAT' },
};

/* ------------------------------------------------------------- genres */
const COLLECTIONS = [
  { id: 'action', name: 'Action', blurb: 'Fast reflexes, big moments and heavy hitters.' },
  { id: 'shooter', name: 'Shooters', blurb: 'First and third person firefights, classic and modern.' },
  { id: 'adventure', name: 'Adventure', blurb: 'Exploration, story and discovery.' },
  { id: 'rpg', name: 'Role-playing', blurb: 'Deep worlds, builds and long campaigns.' },
  { id: 'platformer', name: 'Platformers', blurb: 'Run, jump and collect across handcrafted levels.' },
  { id: 'racing', name: 'Racing', blurb: 'Circuits, rallies, kart tracks and street racers.' },
  { id: 'strategy', name: 'Strategy', blurb: 'Plan, build and outsmart the opposition.' },
  { id: 'horror', name: 'Horror', blurb: 'Survival, dread and things in the dark.' },
  { id: 'fighting', name: 'Fighting and brawlers', blurb: 'Versus fighters and side-scrolling beat em ups.' },
  { id: 'simulation', name: 'Simulation', blurb: 'Management, flight, life and construction sims.' },
  { id: 'puzzle', name: 'Puzzle', blurb: 'Logic, physics and clever mechanics.' },
  { id: 'sports', name: 'Sports', blurb: 'Pitch, court, track and ring.' },
  { id: 'sandbox', name: 'Sandbox', blurb: 'Open-ended creativity and survival.' },
  { id: 'casual', name: 'Casual and party', blurb: 'Pick up and play, pinball, party and music games.' },
  { id: 'indie', name: 'Indie', blurb: 'Independent releases and community favourites.' },
];
const GENRE_MAP = {
  action: 'action',
  shooter: 'shooter',
  adventure: 'adventure',
  'role-playing': 'rpg',
  rpg: 'rpg',
  platform: 'platformer',
  platformer: 'platformer',
  racing: 'racing',
  strategy: 'strategy',
  horror: 'horror',
  fighting: 'fighting',
  "beat 'em up": 'fighting',
  'construction and management simulation': 'simulation',
  'life simulation': 'simulation',
  'flight simulator': 'simulation',
  simulation: 'simulation',
  puzzle: 'puzzle',
  sports: 'sports',
  sandbox: 'sandbox',
  casual: 'casual',
  pinball: 'casual',
  party: 'casual',
  music: 'casual',
  education: 'casual',
  stealth: 'action',
  'visual novel': 'adventure',
  indie: 'indie',
};

/* ------------------------------------------------------------ engines */
const ENGINE_INFO = {
  'delta touch': {
    summary: 'Touch-first runtime for the Doom family: Doom, Doom II, Final Doom, Heretic, Hexen, Strife, Chex Quest, HacX and the Doom 3 games.',
    genres: ['shooter'],
    year: 2012,
  },
  'alpha touch': {
    summary: 'Runtime for Wolfenstein 3D, Spear of Destiny, Blake Stone, Return to Castle Wolfenstein, Medal of Honor: Allied Assault, Rise of the Triad, GoldenEye 007 and Perfect Dark.',
    genres: ['shooter'],
    year: 2020,
  },
  'quad touch': {
    summary: 'Runtime for the Quake family: Quake, Quake II, Quake III Arena, Hexen II, OpenArena and WRATH: Aeon of Ruin, including mission packs.',
    genres: ['shooter'],
    year: 2014,
  },
  'psi touch': {
    summary: 'Runtime for Star Wars Dark Forces, Jedi Knight: Jedi Outcast and Jedi Knight: Jedi Academy.',
    genres: ['shooter'],
    year: 2021,
  },
  'sigma touch': {
    summary: 'Runtime for Unreal, Unreal Tournament 99, Quake 4, Far Cry and Aliens versus Predator 2000.',
    genres: ['shooter'],
    year: 2022,
  },
  'zeta touch': {
    summary: 'Build engine runtime for Duke Nukem 3D, Blood, Shadow Warrior, Redneck Rampage, PowerSlave, NAM, Ion Fury and their expansions.',
    genres: ['shooter'],
    year: 2018,
  },
  'source engine port': {
    summary: 'Source engine for Android covering Half-Life 2 and its episodes, Portal, Counter-Strike: Source, Day of Defeat: Source and Postal III. Supported through the developer Discord.',
    genres: ['shooter'],
    year: 2020,
  },
  'classic core engines': {
    summary: 'One app that bundles classic engines for Doom, Quake, Hexen II, Command & Conquer, Arx Fatalis, Doom RPG and more, with touch and controller layouts.',
    genres: ['shooter', 'strategy'],
    year: 2023,
  },
  'idtech4a++': {
    summary: 'The Harmattan id Tech suite for Android. Runs Doom 3, Quake 4, Prey, Enemy Territory: Quake Wars, Return to Castle Wolfenstein and the Quake and Doom lineages.',
    genres: ['shooter'],
    year: 2012,
  },
  openbor: {
    summary: 'Open-source engine for 2D side-scrolling brawlers in the Beats of Rage tradition. Load community modules and full games from storage.',
    genres: ['fighting'],
    year: 2004,
  },
  'rotating art launcher': {
    summary: 'Launcher for .NET and XNA/FNA titles such as Celeste, Stardew Valley and Terraria, with on-screen controls and controller mapping.',
    genres: ['platformer', 'indie'],
    year: 2025,
  },
  'xash3d fwgs': {
    summary: 'Open-source GoldSrc engine rewrite. Runs Half-Life, Opposing Force, Blue Shift, Day of Defeat and community mods on Android.',
    genres: ['shooter'],
    year: 2018,
  },
};

/* ------------------------------------------------------------- links */
function classifyLink(url, linkLabel) {
  let host = '';
  try {
    host = new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'web';
  }
  const label = (linkLabel || '').toLowerCase();
  if (host === 'github.com') return 'github';
  if (host === 't.me' || host === 'telegram.me') return 'telegram';
  if (host.includes('discord')) return 'discord';
  if (host === 'play.google.com') return 'playstore';
  if (host.endsWith('itch.io')) return 'itch';
  if (host === '4pda.to') return '4pda';
  if (host.endsWith('reddit.com') || host === 'redd.it') return 'reddit';
  if (host === 'gitlab.com') return 'gitlab';
  if (host === 'f-droid.org') return 'fdroid';
  if (host === 'gamejolt.com') return 'gamejolt';
  if (host === 'archive.org' || host === 'dos.zone') return 'archive';
  if (host === 'gamebanana.com') return 'gamebanana';
  if (host.endsWith('github.io') || host.includes('opentouchgaming')) return 'site';
  if (label.includes('mirror') || /apkvision|apkaward|mediafire|gofile|pixeldrain|drive\.google|mega\.nz/.test(host)) return 'mirror';
  return 'web';
}

function githubLatest(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname
      .split('/')
      .filter(Boolean)
      .map((x) => x.replace(/(%20|\s)+$/g, ''));
    if (parts.length < 2) return url;
    return `https://github.com/${parts[0]}/${parts[1]}/releases/latest`;
  } catch {
    return url;
  }
}

function cleanUrl(url) {
  try {
    const u = new URL(url.trim());
    if (u.host === 'github.com') {
      // Normalise every GitHub link to its project root, so the same repo never appears twice.
      const parts = u.pathname.split('/').filter(Boolean).map((x) => decodeURIComponent(x).replace(/\s+$/g, '').replace(/\.git$/, ''));
      if (parts.length >= 2) return `https://github.com/${parts[0]}/${parts[1]}`;
    }
    u.pathname = u.pathname.replace(/(%20|\s)+(?=\/|$)/g, '');
    ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'si'].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return '';
  }
}

const FILE_GENERIC = /^(yes|no|need rom|need game files|game files|\?|\?\?|need usa rom|need jp rom|need wii u rom|need rom\.?)$/i;
function parseFiles(v) {
  const s = clean(v);
  if (!s) return { code: '', note: '' };
  if (/^https?:\/\//i.test(s)) return { code: 'files', note: '' };
  if (/^no$/i.test(s)) return { code: 'none', note: '' };
  if (/download in app/i.test(s)) return { code: 'app', note: '' };
  if (/rom|\.z64|\.sfc|\.nes|\.gba|\.gbc?|\.iso|\.nds|\.cue|wbfs/i.test(s) && !/folder/i.test(s)) {
    return { code: 'rom', note: FILE_GENERIC.test(s) ? '' : s };
  }
  if (/^\?+$/.test(s)) return { code: '', note: '' };
  return { code: 'files', note: FILE_GENERIC.test(s) ? '' : s };
}

function parseWorks(v) {
  const s = clean(v).toLowerCase().replace(/[.\s]+$/g, '');
  if (s === 'yes') return 'yes';
  if (s === 'no') return 'no';
  if (s === 'bug' || s === 'kinda') return 'bug';
  return '';
}

function parseController(v) {
  const s = clean(v).toLowerCase();
  if (!s) return '';
  if (s.includes('only') && s.includes('controller')) return 'controller';
  if (s.includes('only') && s.includes('touch')) return 'touch';
  if (s.includes('controller') && s.includes('touch')) return 'both';
  if (s.includes('controller')) return 'controller';
  if (s.includes('touch')) return 'touch';
  return '';
}

function truncateAtSentence(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const idx = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (idx > max * 0.45) return cut.slice(0, idx + 1);
  return cut.replace(/\s+\S*$/, '') + '...';
}

function mapGenres(raw) {
  const out = [];
  String(raw || '')
    .split(/[,;/]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .forEach((t) => {
      const id = GENRE_MAP[t];
      if (id && !out.includes(id)) out.push(id);
    });
  // Keep Indie as a tag, never as the primary genre
  const idx = out.indexOf('indie');
  if (idx === 0 && out.length > 1) {
    out.splice(0, 1);
    out.push('indie');
  }
  return out;
}

/* -------------------------------------------------------------- main */
const csv = fs.readFileSync(path.join(SRC, 'napl-sheet.csv'), 'utf8');
const rows = parseCSV(csv).filter((r) => r.GAME && r.URL);
const steamMap = fs.existsSync(path.join(SRC, 'steam-map.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'steam-map.json'), 'utf8')) : {};
const artMap = fs.existsSync(path.join(SRC, 'art-map.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'art-map.json'), 'utf8')) : {};
const verifiedShots = fs.existsSync(path.join(SRC, 'verified-screenshots.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'verified-screenshots.json'), 'utf8')) : {};
const audit = fs.existsSync(path.join(SRC, 'link-audit.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'link-audit.json'), 'utf8')) : {};
const isDead = (port) => audit[port.download] === 404 || audit[port.download] === 410;
const extras = fs.existsSync(path.join(SRC, 'extras.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'extras.json'), 'utf8')) : [];
const previousCatalog = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const repoEvidence = fs.existsSync(path.join(SRC, 'github-repos.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'github-repos.json'), 'utf8')).repos || {} : {};

/* Port ranking. Keep identical to comparePorts() in src/lib/catalog.ts (checked by the test suite). */
const KIND_TIER = { github: 0, playstore: 1, fdroid: 1, itch: 1, gitlab: 1, site: 1, gamejolt: 1, gamebanana: 1, archive: 1, web: 1, discord: 2, '4pda': 3, telegram: 4, reddit: 4, mirror: 5 };
const portTier = (p) => {
  let t = KIND_TIER[p.kind] ?? 2;
  if (p.lifecycle === 'paused' || p.lifecycle === 'discontinued') t += 1;
  if (p.works === 'no') t += 1;
  return Math.min(t, 6);
};
const comparePorts = (a, b) =>
  portTier(a) - portTier(b) ||
  (b.stars || 0) - (a.stars || 0) ||
  (b.downloads || 0) - (a.downloads || 0) ||
  (b.views || 0) - (a.views || 0) ||
  (b.updated || '').localeCompare(a.updated || '');

/** Attach real GitHub facts (stars, APK downloads, archived state) to every GitHub port. */
function enrichPort(p) {
  if (p.kind !== 'github') return p;
  const m = /github\.com\/([^/]+)\/([^/?#]+)/i.exec(p.url || '');
  const ev = m ? repoEvidence[`${m[1]}/${m[2].replace(/\.git$/, '')}`.toLowerCase()] : null;
  if (!ev) return p;
  p.stars = Math.max(p.stars || 0, ev.stars || 0);
  p.downloads = Math.max(p.downloads || 0, ev.apkDownloads || 0);
  if (ev.hasApk) p.apk = true;
  if (ev.archived && !p.lifecycle) p.lifecycle = 'discontinued';
  return p;
}

const dropped = [];
const games = new Map();
const titleIndex = new Map();
const engineRows = [];

/**
 * One card per game. Entries that describe the same title are merged even when a list recorded a
 * different release year (a 2015 PC release of a 2013 game is still the same game). Genuinely
 * different games that happen to share a name are kept apart when their years are far enough.
 */
function gameKey(title, year, platform) {
  const titleKey = normTitle(title);
  const candidates = titleIndex.get(titleKey) || [];
  const fit = (key) => {
    const existing = games.get(key);
    if (!existing) return false;
    if (!year || !existing.year) return true;
    return Math.abs(Number(year) - Number(existing.year)) <= 5;
  };
  for (const key of candidates) if (fit(key)) return key;
  const key = `${titleKey}|${year || 'unknown'}${candidates.length ? `|${platform}` : ''}`;
  if (!candidates.includes(key)) titleIndex.set(titleKey, [...candidates, key]);
  return key;
}

function ensureGame(title, year, platform, base) {
  const key = gameKey(title, year, platform);
  if (!games.has(key)) games.set(key, { ...base, ports: [], sourceKey: key });
  const game = games.get(key);
  if (!game.year && year) game.year = year;
  if (!game.genres.length) game.genres = base.genres;
  if (!game.paragraphs.length && base.paragraphs.length) game.paragraphs = base.paragraphs;
  if (!game.cover && base.cover) game.cover = base.cover;
  if (!game.launchbox && base.launchbox) game.launchbox = base.launchbox;
  if (!game.descSource && base.descSource) game.descSource = base.descSource;
  return game;
}

function popularity(port) {
  // Keep measured release downloads dominant; GitHub stars and list views are fallback signals.
  return (Number(port.downloads) || 0) * 10000 + (Number(port.stars) || 0) * 60 + (Number(port.views) || 0);
}

function addPort(game, port) {
  const key = (port.download || port.url).replace(/\/+$/, '').toLowerCase();
  const existing = game.ports.find((p) => (p.download || p.url).replace(/\/+$/, '').toLowerCase() === key);
  if (!existing) {
    game.ports.push(port);
    return;
  }
  const platforms = new Set([...(existing.platforms || [existing.platform]), ...(port.platforms || [port.platform])].filter(Boolean));
  const keep = popularity(port) > popularity(existing) ? port : existing;
  Object.assign(existing, keep);
  existing.platforms = [...platforms];
  existing.views = Math.max(existing.views || 0, port.views || 0);
  existing.downloads = Math.max(existing.downloads || 0, port.downloads || 0);
  if (port.notes && port.notes !== existing.notes) existing.notes = [existing.notes, port.notes].filter(Boolean).join(' · ');
}

function rowToPort(r, platform) {
  const url = cleanUrl(r.URL);
  if (!url) return null;
  const kind = classifyLink(url, r.LINK);
  const files = parseFiles(r['NEEDS GAME FILES?']);
  const generic = /^(unofficial port|android port|port)$/i.test(clean(r.PROJECT));
  return {
    name: generic ? '' : clean(r.PROJECT),
    developer: clean(r.DEVELOPER),
    platform,
    kind,
    url,
    download: kind === 'github' ? githubLatest(url) : url,
    version: clean(r.VERSION),
    updated: parseDate(r['LAST UPDATE']),
    added: parseDate(r['DATE ADDED']),
    files: files.code,
    filesNote: files.note,
    works: parseWorks(r['WORKS?']),
    controller: parseController(r['CONTROLLER SUPPORT']),
    notes: clean(r.NOTES),
    instructions: clean(r.INSTRUCTIONS),
    paid: /paid/i.test(r.LINK),
    mirror: /mirror/i.test(r.LINK) || kind === 'mirror',
    views: Number(r.VISITAS) || 0,
    downloads: Number(r['DOWNLOADS'] || r['DOWNLOAD COUNT']) || 0,
  };
}

for (const r of rows) {
  if (/^github repo down$/i.test(r.LINK.trim())) {
    dropped.push({ game: r.GAME, reason: 'repository removed' });
    continue;
  }
  const plat = PLATFORMS[r.PLATFORM] || PLATFORMS[Object.keys(PLATFORMS).find((k) => k.toLowerCase() === r.PLATFORM.toLowerCase())];
  if (!plat) {
    dropped.push({ game: r.GAME, reason: `unknown platform ${r.PLATFORM}` });
    continue;
  }
  const port = rowToPort(r, plat.id);
  if (!port) {
    dropped.push({ game: r.GAME, reason: 'bad url' });
    continue;
  }
  if (plat.id === 'engine') {
    engineRows.push({ r, port });
    continue;
  }

  const title = clean(r.GAME).replace(/\s+/g, ' ');
  const paragraphs = clean(r.DESCRIPTION).split('|||').map((p) => p.trim()).filter(Boolean);
  const year = /^\d{4}$/.test(clean(r.YEAR)) ? Number(r.YEAR) : 0;
  if (/(?:VinTeRuS\/proto-re)/i.test(port.url)) {
    dropped.push({ game: title, reason: 'superseded by Nazatric/ProtoDroid' });
    continue;
  }
  const art = artMap[normTitle(title)] || null;
  const g = ensureGame(title, year, plat.id, {
    title,
    year,
    platform: plat.id,
    genres: mapGenres(r.GENRE),
    paragraphs,
    cover: clean(r.COVER_URL) || (art && art.cover) || '',
    launchbox: clean(r.LAUNCHBOX_URL),
    descSource: '',
  });
  if (art && art.shots && art.shots.length && !g.shots) g.shots = art.shots;
  addPort(g, port);
}

/* extras: curated entries researched outside the sheet */
const sameUrl = (a, b) => a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase();
const extraEngines = [];
const catalogSources = [];
for (const e of extras) {
  const wanted = [e.platform, ...(e.originalPlatforms || [])].filter(Boolean);
  const plat = wanted.map((id) => Object.values(PLATFORMS).find((p) => p.id === id)).find(Boolean);
  if (!plat) continue;
  const url = cleanUrl(e.url);
  if (!url) continue;
  if (e.list && e.list !== 'manual' && !catalogSources.includes(e.list)) catalogSources.push(e.list);
  const kind = classifyLink(url, '');
  const dl = kind === 'github' ? githubLatest(url) : url;
  if (plat.id === 'engine') {
    if (extraEngines.some((x) => x.title.toLowerCase() === e.title.toLowerCase())) continue;
    extraEngines.push({ ...e, url, kind });
    continue;
  }
  const title = clean(e.game || e.title);
  const year = Number(e.year) || 0;
  const art = artMap[normTitle(title)] || null;
  const g = ensureGame(title, year, plat.id, {
    title,
    year,
    platform: plat.id,
    genres: mapGenres((e.genres || []).join(',')),
    paragraphs: e.description ? [e.description] : [],
    cover: e.cover || '',
    launchbox: '',
    descSource: e.descSource || '',
  });
  const duplicate = g.ports.some((p) => sameUrl(p.url, url) || sameUrl(p.download, dl));
  if (duplicate) {
    const existing = g.ports.find((p) => sameUrl(p.url, url) || sameUrl(p.download, dl));
    if (existing) {
      existing.name = e.project || existing.name;
      existing.developer = e.developer || existing.developer;
      existing.version = e.version || existing.version;
      existing.updated = [existing.updated, parseDate(e.updated || '')].filter(Boolean).sort().pop() || '';
      existing.downloads = Math.max(existing.downloads || 0, Number(e.downloads) || 0);
      existing.stars = Math.max(existing.stars || 0, Number(e.stars) || 0);
      existing.files = e.files || existing.files;
      existing.controller = e.controller || existing.controller;
      existing.works = e.works || existing.works;
      existing.lifecycle = e.lifecycle || existing.lifecycle || (/^(alpha|beta)$/i.test(e.status || '') ? 'experimental' : '');
      existing.notes = [existing.notes, e.notes, e.warning].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
      existing.platforms = [...new Set([...(existing.platforms || [existing.platform]), plat.id].filter(Boolean))];
      existing.source = 'NAPL + research';
    }
    continue;
  }
  if (!e.sharedProject && [...games.values()].some((other) => other !== g && other.ports.some((p) => sameUrl(p.url, url)))) continue;
  if (!g.paragraphs.length && e.description) {
    g.paragraphs = [e.description];
    g.descSource = e.descSource || '';
  }
  if (!g.cover && e.cover) g.cover = e.cover;
  const gArt = artMap[normTitle(g.title)];
  if (!g.cover && gArt?.cover) g.cover = gArt.cover;
  if (!g.genres.length && e.genres?.length) g.genres = mapGenres(e.genres.join(','));
  if (!g.year && e.year) g.year = e.year;
  const systems = [...new Set([...(e.originalPlatforms || []), plat.id])].filter((id) => Object.values(PLATFORMS).some((p) => p.id === id));
  const eArt = artMap[normTitle(title)];
  const shots = [...new Set([...(e.shots || []), ...(eArt?.shots || [])])].slice(0, 6);
  if (shots.length) g.shots = shots;
  addPort(g, {
    name: e.project || '',
    developer: e.developer || '',
    platform: plat.id,
    platforms: systems.length > 1 || e.sharedProject ? systems : undefined,
    kind,
    url,
    download: kind === 'github' ? githubLatest(url) : url,
    version: e.version || '',
    updated: parseDate(e.updated || ''),
    added: parseDate(e.added || ''),
    files: e.files || '',
    filesNote: e.filesNote || '',
    works: e.works || '',
    controller: e.controller || '',
    notes: [e.notes, e.warning].filter(Boolean).join(' '),
    instructions: '',
    paid: false,
    mirror: kind === 'mirror',
    views: 0,
    downloads: Number(e.downloads) || 0,
    stars: Number(e.stars) || 0,
    lifecycle: e.lifecycle || (/^(alpha|beta)$/i.test(e.status || '') ? 'experimental' : ''),
    source: e.list || 'research',
  });
  for (const sibling of e.siblingPorts || []) {
    if (!sibling.url) continue;
    addPort(g, {
      name: sibling.title || '',
      developer: sibling.developer || '',
      platform: Object.values(PLATFORMS).some((p) => p.id === sibling.platform) ? sibling.platform : plat.id,
      kind: sibling.kind || classifyLink(sibling.url, ''),
      url: cleanUrl(sibling.url) || sibling.url,
      download: sibling.download || sibling.url,
      version: sibling.version || '',
      updated: parseDate(sibling.updated || ''),
      added: parseDate(e.added || ''),
      files: sibling.files || 'files',
      works: sibling.works || '',
      notes: sibling.notes || '',
      stars: Number(sibling.stars) || 0,
      downloads: Number(sibling.downloads) || 0,
      views: 0,
      source: sibling.source || 'research',
    });
  }
}

/* engines */
const engines = new Map();
for (const { r, port } of engineRows) {
  const nameKey = r.GAME.trim().toLowerCase();
  const info = ENGINE_INFO[nameKey] || {};
  engines.set(nameKey, {
    id: slugify(r.GAME),
    title: clean(r.GAME),
    year: info.year || 0,
    platform: 'engine',
    platforms: ['engine'],
    genres: info.genres || [],
    paragraphs: info.summary ? [info.summary] : [],
    cover: '',
    launchbox: '',
    ports: [port],
    supports: [],
  });
}

for (const e of extraEngines) {
  const key = e.title.trim().toLowerCase();
  if (engines.has(key)) continue;
  engines.set(key, {
    id: slugify(e.title),
    title: e.title.trim(),
    year: 0,
    platform: 'engine',
    genres: [],
    paragraphs: e.description ? [e.description] : [],
    cover: '',
    launchbox: '',
    ports: [
      {
        name: '',
        developer: e.developer || '',
        platform: 'engine',
        kind: e.kind,
        url: e.url,
        download: e.kind === 'github' ? githubLatest(e.url) : e.url,
        version: '',
        updated: '',
        added: parseDate(e.added || ''),
        files: 'files',
        filesNote: '',
        works: '',
        controller: '',
        notes: '',
        instructions: '',
        paid: false,
        mirror: false,
        views: 0,
        downloads: Number(e.downloads) || 0,
        lifecycle: e.lifecycle,
        source: 'research',
      },
    ],
    supports: [],
  });
}

/* drop ports whose release link was confirmed dead by scripts/audit-links.mjs */
for (const [key, g] of [...games]) {
  const before = g.ports.length;
  g.ports = g.ports.filter((p) => !isDead(p));
  if (before !== g.ports.length) dropped.push({ game: g.title, reason: `${before - g.ports.length} dead link(s)` });
  if (!g.ports.length) games.delete(key);
}

// A shared title belongs on one shelf card; alternate consoles remain available as port filters.
for (const g of games.values()) {
  const weights = new Map();
  for (const p of g.ports) {
    const ids = p.platforms?.length ? p.platforms : [p.platform || g.platform];
    for (const id of ids) weights.set(id, (weights.get(id) || 0) + popularity(p));
  }
  const order = [...weights.keys()].sort((a, b) => (weights.get(b) || 0) - (weights.get(a) || 0) || a.localeCompare(b));
  if (order.length) g.platform = order[0];
  if (order.length > 1) g.platforms = order;
  else delete g.platforms;
}

/* assign ids, engine links */
const used = new Set();
const out = [];
const sorted = [...games.values()].sort((a, b) => a.title.localeCompare(b.title));
for (const g of sorted) {
  let id = slugify(g.title) || 'game';
  if (used.has(id)) id = `${id}-${g.platform}`;
  let n = 2;
  while (used.has(id)) id = `${slugify(g.title)}-${g.platform}-${n++}`;
  used.add(id);
  g.id = id;
}
for (const e of engines.values()) {
  let id = e.id;
  while (used.has(id)) id += '-app';
  e.id = id;
  used.add(id);
}

// engine linking: port project name == engine title
for (const g of sorted) {
  for (const p of g.ports) {
    const eng = engines.get((p.name || '').toLowerCase());
    if (eng) {
      p.engine = eng.id;
      if (!eng.supports.includes(g.id)) eng.supports.push(g.id);
    }
  }
}

/* finalise records */
function finalize(g) {
  const paragraphs = g.paragraphs.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const first = paragraphs[0] || '';
  const description = truncateAtSentence(paragraphs.slice(0, 2).join('\n\n'), 620);
  const summary = truncateAtSentence(first, 170);
  const dates = (k) => g.ports.map((p) => p[k]).filter(Boolean).sort();
  const updated = dates('updated').pop() || '';
  const added = dates('added').pop() || updated;
  const collections = g.genres.length ? g.genres : [];
  const previous = previousCatalog?.games?.find((old) => old.platform !== 'engine' && normTitle(old.title) === normTitle(g.title) && Number(old.year || 0) === Number(g.year || 0));
  const steam = steamMap[g.id] || previous?.steam || null;
  const verified = verifiedShots[g.id];
  const shots = [...new Set([...(verified?.shots || []), ...(g.shots || [])])];
  const m = /\/apps\/(\d+)\//.exec(g.cover || '');
  const rec = {
    id: g.id,
    title: g.title,
    year: g.year || undefined,
    platform: g.platform,
    platforms: g.platforms || undefined,
    genres: collections,
    summary,
    description,
    cover: g.cover || undefined,
    launchbox: g.launchbox || undefined,
    descSource: g.descSource || undefined,
    steam: steam || (m ? { id: Number(m[1]), shots: [] } : undefined),
    shots: shots.length ? shots : undefined,
    shotNote: verified?.note || undefined,
    updated: updated || undefined,
    added: added || undefined,
    views: g.ports.reduce((s, p) => s + (p.views || 0), 0),
    ports: g.ports
      .map((p) => {
        const o = enrichPort({ ...p });
        // A port note is usually a repeat of the card description; keep it only when it adds detail.
        if (o.notes && (description.includes(o.notes) || summary.includes(o.notes))) delete o.notes;
        Object.keys(o).forEach((k) => (o[k] === '' || o[k] === false || o[k] === undefined) && delete o[k]);
        return o;
      })
      .sort(comparePorts),
  };
  if (g.supports) rec.supports = g.supports;
  return rec;
}

const finalGames = [...sorted.map(finalize), ...[...engines.values()].map(finalize)];

const stats = {
  games: finalGames.filter((g) => g.platform !== 'engine').length,
  engines: finalGames.filter((g) => g.platform === 'engine').length,
  ports: finalGames.reduce((s, g) => s + g.ports.length, 0),
  withCover: finalGames.filter((g) => g.cover).length,
  withSteam: finalGames.filter((g) => g.steam).length,
  withShots: finalGames.filter((g) => g.shots?.length || g.steam?.shots?.length).length,
  dropped: dropped.length,
};

const platformsOut = Object.values(PLATFORMS)
  .map((p) => ({ ...p, count: finalGames.filter((g) => g.platform === p.id || g.platforms?.includes(p.id)).length }))
  .filter((p) => p.count > 0);

// The shipped copy lives in src/data (bundled, offline baseline). public/catalog.json is the
// refreshable copy that the app and the update workflow publish, so new games reach installed
// clients without a new app release.
const manifest = fs.existsSync(path.join(SRC, 'sync-manifest.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'sync-manifest.json'), 'utf8')) : {};
const payload = {
  generated: new Date().toISOString().slice(0, 10),
  revision: new Date().toISOString(),
  sources: catalogSources,
  upstreamSyncedAt: manifest.lastRun || '',
  stats,
  platforms: platformsOut,
  collections: COLLECTIONS,
  games: finalGames,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify(payload);
fs.writeFileSync(OUT, json);
const publicDir = path.join(ROOT, 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'catalog.json'), json);
fs.writeFileSync(path.join(ROOT, 'data/source/dropped.json'), JSON.stringify(dropped, null, 1));
console.log('catalog written', stats, `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`, `sources: ${catalogSources.join(', ') || 'NAPL only'}`);
