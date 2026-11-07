#!/usr/bin/env node
/**
 * Turns the cached machine-readable game lists into catalog entries.
 *
 * This is the part that makes the library grow: every entry in the lists becomes a port on one
 * game card. Games are grouped by a normalised title, so the same game listed in several places
 * becomes a single card with several ports instead of a duplicate, and the port with the strongest
 * real-world signal (downloads, stars) is what the app ranks first.
 *
 * Reads:  data/source/openports.json, data/source/decompgames.json, data/source/github-repos.json
 * Writes: data/source/extras.json (merged with curated data/source/manual-picks.json)
 *
 * Usage: node scripts/import-catalog-lists.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/source');
const read = (f, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  } catch {
    return fallback;
  }
};

const normTitle = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[™®©']/g, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '');

const GENRE = {
  'action-adventure': 'adventure',
  action: 'action',
  adventure: 'adventure',
  shooter: 'shooter',
  platformer: 'platformer',
  rpg: 'rpg',
  'role-playing': 'rpg',
  racing: 'racing',
  fighting: 'fighting',
  simulation: 'simulation',
  puzzle: 'puzzle',
  strategy: 'strategy',
  sports: 'sports',
  'open-world': 'sandbox',
  sandbox: 'sandbox',
  music: 'casual',
  casual: 'casual',
  horror: 'horror',
  indie: 'indie',
};
/** When a list publishes no genre, infer one from its own description text rather than guessing from the title. */
const TEXT_GENRE = [
  [/\b(racing|race|driving|rally|kart|karting)\b/i, 'racing'],
  [/\b(football|soccer|basketball|hockey|boxing|wrestling|golf|sport|tennis)\b/i, 'sports'],
  [/\b(shooter|first-person shooter|third-person shooter|fps|shoot \'em up|shmup)\b/i, 'shooter'],
  [/\b(platformer|platform game|jump and run)\b/i, 'platformer'],
  [/\b(role-playing|rpg|dungeon crawler|roguelike)\b/i, 'rpg'],
  [/\b(strategy|real-time strategy|turn-based|tower defense|city-building|management)\b/i, 'strategy'],
  [/\b(fighting game|fighting|beat \'em up|brawler)\b/i, 'fighting'],
  [/\b(horror|survival horror)\b/i, 'horror'],
  [/\b(simulator|simulation|flight sim|life sim|tycoon)\b/i, 'simulation'],
  [/\b(puzzle)\b/i, 'puzzle'],
  [/\b(sandbox|open world|open-world|crafting|survival)\b/i, 'sandbox'],
  [/\b(adventure|point-and-click|visual novel)\b/i, 'adventure'],
  [/\b(action)\b/i, 'action'],
  [/\b(indie|casual|party|music|rhythm)\b/i, 'casual'],
];
const genreFromText = (text) => {
  for (const [re, genre] of TEXT_GENRE) if (re.test(text || '')) return [genre];
  return [];
};

const mapGenres = (raw) =>
  String(raw || '')
    .split(/[,;/|]/)
    .map((s) => GENRE[s.trim().toLowerCase()])
    .filter((v, i, a) => v && a.indexOf(v) === i);

const PLATFORM = {
  PC: 'pc', Windows: 'pc', Linux: 'pc', DOS: 'pc', 'MS-DOS': 'pc', Mac: 'pc', Macintosh: 'pc',
  N64: 'n64', 'Nintendo 64': 'n64',
  'Xbox 360': 'xbox360', 'xbox 360': 'xbox360', 'OG Xbox': 'xbox', 'og xbox': 'xbox', Xbox: 'xbox',
  PS1: 'ps1', PSX: 'ps1', PlayStation: 'ps1', 'PlayStation': 'ps1',
  PS2: 'ps2', PS3: 'ps3', PS4: 'ps4', PSP: 'psp',
  GameCube: 'gamecube', GCN: 'gamecube', Wii: 'wii', 'Wii U': 'wiiu', Switch: 'switch',
  GBA: 'gba', 'Game Boy Advance': 'gba', GBC: 'gbc', 'Game Boy Color': 'gbc', 'Game Boy': 'gb', GB: 'gb',
  NES: 'nes', SNES: 'snes', 'Nintendo DS': 'nds', DS: 'nds', 'Nintendo 3DS': 'n3ds', '3DS': 'n3ds',
  'Nintendo Entertainment System': 'nes', 'Super Nintendo': 'snes',
  Arcade: 'pc', 'Mobile': 'pc', Amiga: 'pc', '': 'pc',
};
const mapPlatform = (raw) => PLATFORM[String(raw || '').trim()] || 'pc';

const repoEvidence = read('github-repos.json', { repos: {} }).repos || {};
const repoOf = (url) => {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    return p.length >= 2 ? `${p[0]}/${p[1]}`.toLowerCase() : '';
  } catch {
    return '';
  }
};
const evidence = (url) => repoEvidence[repoOf(url)] || {};

const openports = read('openports.json', { ports: [] }).ports || [];
const decomp = read('decompgames.json', { games: [] }).games || [];
const curated = read('extras.json', []).filter((e) => e.list === 'manual' || e.list === 'Community research (GitHub)');

/** Share one game card across every port that belongs to the same title. */
const cards = new Map();
function card(title, year) {
  const key = normTitle(title);
  if (!cards.has(key)) cards.set(key, { title: title.trim(), year: Number(year) || 0, genres: [], description: '', cover: '', shots: [], ports: [], seenPort: new Set() });
  return cards.get(key);
}

function addPort(game, port) {
  const id = port.url.replace(/\/+$/, '').toLowerCase();
  if (game.seenPort.has(id)) return;
  game.seenPort.add(id);
  game.ports.push(port);
}

/* ------------------------------------------------- OpenPortsGames entries */
const androidRepos = new Set(openports.filter((p) => p.platforms?.includes('android')).flatMap((p) => p.sources || []).map(repoOf).filter(Boolean));
for (const p of openports) {
  if (p.kind && p.kind !== 'game') continue;
  const source = (p.sources || []).find((s) => /^https?:\/\//.test(s));
  if (!source) continue;
  // OpenPortsGames catalogues every target platform. Re:Port is Android-only, so a variant must
  // explicitly target Android (or publish a verified APK) before it can enter this catalog.
  const ev0 = evidence(source);
  const androidTarget = p.platforms?.includes('android') || ev0.hasApk || /\bandroid\b|\bapk\b/i.test(`${p.title || ''} ${p.notes || ''}`);
  if (!androidTarget) continue;
  const title = p.game || p.title;
  if (!title) continue;
  const game = card(title, p.originalYear);
  if (!game.genres.length) game.genres = mapGenres(p.genre).length ? mapGenres(p.genre) : genreFromText(`${p.summary || ''} ${p.notes || ''} ${p.title || ''}`);
  if (!game.year && p.originalYear) game.year = Number(p.originalYear) || 0;
  if (!game.description && p.summary) game.description = String(p.summary).trim();
  const cover = p.cover?.src ? String(p.cover.src).split('?')[0] : '';
  if (!game.cover && cover) game.cover = cover;
  const ev = evidence(source);
  addPort(game, {
    title: p.title && normTitle(p.title) !== normTitle(title) ? p.title : '',
    developer: (p.developers || [])[0] || '',
    platform: mapPlatform((p.originalSystems || [])[0]),
    url: source,
    kind: /github\.com/.test(source) ? 'github' : 'web',
    download: /github\.com/.test(source) ? source.replace(/\/+$/, '') + '/releases/latest' : source,
    version: p.release?.version || ev.apkVersion || '',
    updated: (p.release?.date || ev.apkDate || '').slice(0, 10),
    stars: ev.stars || 0,
    downloads: ev.apkDownloads || 0,
    works: p.status === 'stable' ? 'yes' : '',
    files: /ships the game|distributes the game/i.test(p.warning || '') ? 'none' : 'files',
    notes: [p.notes, p.warning].filter(Boolean).join(' '),
    source: 'OpenPortsGames',
    android: true,
    apk: Boolean(ev.apkDownloads || ev.hasApk),
  });
}

/* -------------------------------------------- Awesome Decomp Games entries */
for (const g of decomp) {
  if (!g.url || g.inactive || !g.title) continue;
  const parenthetical = /\(([^)]+)\)\s*$/.exec(g.title);
  const projectName = parenthetical ? parenthetical[1] : '';
  const gameTitle = parenthetical ? g.title.slice(0, parenthetical.index).trim() : g.title.trim();
  if (!gameTitle) continue;
  const url = g.release_url || g.url;
  const game = card(gameTitle, 0);
  if (!game.description && g.note) game.description = String(g.note).trim();
  if (!game.genres.length) game.genres = genreFromText(`${g.note || ''} ${g.title || ''}`);
  if (!game.cover) {
    const og = g.og_image || (g.thumb_src ? `https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/${g.thumb_src}` : '');
    if (og && /^https?:\/\//.test(og)) game.cover = og;
  }
  if (g.screenshot && game.shots.length < 3) {
    const shot = `https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/${g.screenshot}`;
    if (!game.shots.includes(shot)) game.shots.push(shot);
  }
  const ev = evidence(url);
  if (ev.missing || ev.archived) continue;
  const haystack = `${g.title || ''} ${g.note || ''} ${g.description || ''} ${g.homepage || ''} ${g.play_url || ''}`;
  const reverseDirection = /port of the android (version|build)|android (armv7|version) of/i.test(haystack);
  const textualAndroid = /\bandroid\b|\bapk\b|arm64|aarch64/i.test(haystack);
  if (reverseDirection || !(ev.hasApk || textualAndroid || androidRepos.has(repoOf(url)))) continue;
  addPort(game, {
    title: projectName && normTitle(projectName) !== normTitle(gameTitle) ? projectName : '',
    developer: (g.repo || '').split('/')[0] || '',
    platform: mapPlatform(g.platform),
    url,
    kind: /github\.com/.test(url) ? 'github' : /gitlab\.com/.test(url) ? 'gitlab' : 'web',
    download: /github\.com/.test(url) ? `https://github.com/${g.repo}/releases/latest` : g.release_url || url,
    version: g.release || ev.apkVersion || '',
    updated: (g.release_date || ev.apkDate || '').slice(0, 10),
    stars: ev.stars || g.stars || 0,
    downloads: ev.apkDownloads || 0,
    lifecycle: g.inactive ? 'discontinued' : '',
    files: g.needs_assets ? 'files' : '',
    notes: g.note ? String(g.note).trim() : '',
    source: 'Awesome Decomp Games',
    android: true,
    apk: Boolean(ev.hasApk),
  });
}

/* ------------------------------------------ keep the strongest port first */
const rank = (p) => (p.apk ? 1_000_000_000 : 0) + (p.downloads || 0) * 100 + (p.stars || 0) + (p.source === 'OpenPortsGames' ? 3 : 0);
for (const game of cards.values()) game.ports.sort((a, b) => rank(b) - rank(a));

const extras = [
  ...curated,
  ...[...cards.values()]
    .filter((g) => g.ports.length)
    .map((g) => ({
      title: g.title,
      game: g.title,
      year: g.year || 0,
      genres: g.genres,
      description: g.description.slice(0, 1100),
      cover: g.cover,
      shots: g.shots.slice(0, 4),
      list: g.ports.some((p) => p.source === 'OpenPortsGames') ? 'OpenPortsGames' : 'Awesome Decomp Games',
      // one canonical entry per game; build-data turns these into ranked ports
      project: g.ports.slice().sort((a, b) => rank(b) - rank(a))[0].title,
      developer: g.ports[0].developer,
      platform: g.ports[0].platform,
      url: g.ports.slice().sort((a, b) => rank(b) - rank(a))[0].url,
      version: g.ports[0].version || '',
      updated: g.ports.map((p) => p.updated).filter(Boolean).sort().pop() || '',
      stars: Math.max(...g.ports.map((p) => p.stars || 0)),
      downloads: Math.max(...g.ports.map((p) => p.downloads || 0)),
      files: g.ports[0].files || '',
      works: g.ports[0].works || '',
      notes: g.ports[0].notes || '',
      // all sibling ports are attached by build-data through `siblingPorts`
      siblingPorts: g.ports.slice(1).map((p) => ({ ...p })),
    })),
];

fs.writeFileSync(path.join(SRC, 'extras.json'), JSON.stringify(extras, null, 1));
const withArt = extras.filter((e) => e.cover).length;
console.log(
  `catalog lists imported: ${cards.size} distinct games, ${extras.length} entries, ${withArt} with cover art, ` +
    `${extras.filter((e) => e.shots?.length).length} with screenshots, ${extras.reduce((s, e) => s + 1 + (e.siblingPorts?.length || 0), 0)} ports`,
);
