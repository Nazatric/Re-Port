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
import { githubRepo, openPortsEvidence, documentedEvidence, rankPorts } from './android-policy.mjs';
import { androidListRows } from './android-list.mjs';
import { DISCOVERY_SOURCES } from './discovery-lists.mjs';

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
const evidence = (url) => repoEvidence[githubRepo(url)] || {};

const openports = read('openports.json', { ports: [] }).ports || [];
const decomp = read('decompgames.json', { games: [] }).games || [];
// Preserve hand-curated and other-list entries. Only the entries generated from the two
// machine-readable catalogs below are regenerated, so adding a list never deletes another one.
const generatedLists = ['OpenPortsGames', 'Awesome Decomp Games', 'Awesome Android Native Ports', 'Reddit research', 'Project research', ...DISCOVERY_SOURCES.map((s) => s.name)];
const curated = read('extras.json', []).filter((e) => !generatedLists.includes(e.list));

/** Share one game card across every port that belongs to the same title. */
const cards = new Map();
function card(title, year) {
  const base = normTitle(title);
  const y = Number(year) || 0;
  const matching = [...cards.entries()].filter(([key]) => key === base || key.startsWith(`${base}|`));
  const existing = matching.find(([, game]) => !y || !game.year || Math.abs(game.year - y) <= 5);
  if (existing) return existing[1];
  const key = matching.length ? `${base}|${y}` : base;
  cards.set(key, { title: title.trim(), year: y, genres: [], description: '', cover: '', shots: [], ports: [], seenPort: new Set() });
  return cards.get(key);
}

function addPort(game, port) {
  const id = port.url.replace(/\/+$/, '').toLowerCase();
  if (game.seenPort.has(id)) return;
  game.seenPort.add(id);
  game.ports.push(port);
}

/* ------------------------------------------------- OpenPortsGames entries */
for (const p of openports) {
  if (p.kind && p.kind !== 'game') continue;
  const androidEvidence = openPortsEvidence(p, repoEvidence);
  if (!androidEvidence) continue;
  const source = (p.sources || []).find((s) => /^https?:\/\//.test(s));
  if (!source) continue;
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
    download: ev.apkRelease || (/github\.com/.test(source) ? source.replace(/\/+$/, '') + '/releases/latest' : source),
    version: p.release?.version || ev.apkVersion || '',
    updated: (p.release?.date || ev.apkDate || '').slice(0, 10),
    stars: ev.stars || 0,
    downloads: ev.apkDownloads || 0,
    works: p.status === 'stable' ? 'yes' : '',
    files: /ships the game|distributes the game/i.test(p.warning || '') ? 'none' : 'files',
    notes: [p.notes, p.warning].filter(Boolean).join(' '),
    source: 'OpenPortsGames',
    androidEvidence,
  });
}

/* --------------------- Independently check the Android-focused game list */
for (const row of androidListRows(path.join(SRC, 'awesome-android-native-ports.md'))) {
  const ev = evidence(row.url);
  // The list is useful for discovery, but its descriptions can be stale. Require direct
  // project evidence for GitHub links instead of treating a list's assertion as proof.
  const androidEvidence = documentedEvidence({ url: row.url, repoEvidence });
  if (!androidEvidence) continue;
  const game = card(row.title, 0);
  addPort(game, {
    title: row.project, developer: githubRepo(row.url).split('/')[0] || '', platform: '',
    url: row.url, kind: 'github', download: ev.apkRelease || row.url,
    version: ev.apkVersion || '', updated: ev.apkDate || '', stars: ev.stars || 0,
    downloads: ev.apkDownloads || 0, files: '', works: '', notes: row.description,
    source: row.list, androidEvidence,
  });
}

/* -------------------------------------------- Awesome Decomp Games entries */
for (const g of decomp) {
  if (!g.url || g.inactive || !g.title) continue;
  // This repo's README says only Mini Golf, not its other games, supports Android.
  if (githubRepo(g.url) === 'dogparty/ipodclickwheelrecomps') continue;
  const parenthetical = /\(([^)]+)\)\s*$/.exec(g.title);
  const projectName = parenthetical ? parenthetical[1] : '';
  const gameTitle = parenthetical ? g.title.slice(0, parenthetical.index).trim() : g.title.trim();
  if (!gameTitle) continue;
  const url = g.url;
  const ev = evidence(url);
  const androidEvidence = ev.apkEvidenceVersion === 1 && ev.hasApk && ev.apkAssets > 0 ? 'github-apk' : ev.androidReadme ? 'github-readme' : '';
  if (ev.missing || !androidEvidence) continue;
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
  addPort(game, {
    title: projectName && normTitle(projectName) !== normTitle(gameTitle) ? projectName : '',
    developer: (g.repo || '').split('/')[0] || '',
    platform: mapPlatform(g.platform),
    url,
    kind: /github\.com/.test(url) ? 'github' : /gitlab\.com/.test(url) ? 'gitlab' : 'web',
    download: ev.apkRelease || (/github\.com/.test(url) ? `https://github.com/${g.repo}/releases/latest` : g.release_url || url),
    version: g.release || ev.apkVersion || '',
    updated: (g.release_date || ev.apkDate || '').slice(0, 10),
    stars: ev.stars || g.stars || 0,
    downloads: ev.apkDownloads || 0,
    lifecycle: g.inactive ? 'discontinued' : '',
    files: g.needs_assets ? 'files' : '',
    notes: g.note ? String(g.note).trim() : '',
    source: 'Awesome Decomp Games',
    androidEvidence,
  });
}

/* ---------------------- New lists and Reddit: leads, not Android proof */
// Re-use established identities when a source calls the same game/project something else.
// Never attach a shared framework to a new game merely because the project has an APK.
const previous = read('../../src/data/catalog.json', { games: [] }).games || [];
const byTitle = new Map(previous.map((g) => [normTitle(g.title), g]));
const byRepo = new Map();
for (const g of previous) for (const p of g.ports || []) {
  const repo = githubRepo(p.url);
  if (!repo) continue;
  const matches = byRepo.get(repo) || new Map();
  matches.set(normTitle(g.title), g);
  byRepo.set(repo, matches);
}
// Projects whose own README says there is no playable/public build, or where the repo
// is only a README, a generic framework/launcher, or a mod of a different game.
const excludedLeads = new Set([
  'katotekiru/bfme1-mobile', 'danielbuva/ror2-android-port',
  'ln782586-lab/the-evil-recomp-within-', 'codepdbh/re3-gta-advance-port',
  'mstan/gbarecomp', 'pelya/commandergenius', 'ikemen-engine/ikemen-go',
  'luanti-org/luanti', 'nyaldee/ports-launcher', 'ashjamb/earthworm-jim-collection',
  'darhkfox/mickeyanddonaldcollection',
]);
const leadTitle = {
  'jackgllghr/bigmission-recomp': 'Saru Get You: Saru Saru Daisakusen',
  'x-th-x/aitdroid': 'Alone in the Dark',
  'joseph1010805/heavenclient-android': 'MapleStory',
};
const originalPlatforms = {
  'firetoad72/blinx-android': 'xbox', 'lunasvalle02-design/castlevaniacircleofthemoonrecomp_android': 'gba',
  'deivid22srk/hells-gate-recomp-android': 'xbox360', 'wannamingo/doa3': 'xbox',
  'de8msh/drmario64-recomp-plus-android': 'n64', 'sherkovpt/ptgdroid': 'unknown',
  'dguillot-gh/racinglagoon-android': 'ps1', 'kardeiro/snowboardkids2-recomp-android': 'n64',
  'deivid22srk/twistedmetal4recomp-android': 'ps1', 'jackgllghr/bigmission-recomp': 'psp',
  'project-holon/eidos': 'nds',
};
const sources = read('discovery-lists.json', {});
const discoveryRows = [
  ...DISCOVERY_SOURCES.flatMap((source) => (sources[source.id] || []).map((row) => ({ ...row, list: source.name }))),
  ...read('reddit-candidates.json', []).map((row) => ({ ...row, list: 'Reddit research' })),
  ...read('manual-discovery.json', []).map((row) => ({ ...row, list: 'Project research' })),
];
for (const row of discoveryRows) {
  const repo = githubRepo(row.url);
  if (!repo || excludedLeads.has(repo) || (repo === 'dogparty/ipodclickwheelrecomps' && normTitle(row.title) !== 'minigolf')) continue;
  const ev = evidence(row.url);
  const androidEvidence = documentedEvidence({ url: row.url, repoEvidence });
  if (!androidEvidence) continue;
  let title = leadTitle[repo] || row.title;
  const matchingGames = repo === 'dogparty/ipodclickwheelrecomps' ? null : byRepo.get(repo);
  const matchingTitle = byTitle.get(normTitle(title));
  // If a repo already belongs to an existing title, that identity is more reliable
  // than another list's project name. Ambiguous shared repos require a title match.
  const existing = matchingTitle || (matchingGames?.size === 1 ? [...matchingGames.values()][0] : null);
  if (matchingGames?.size && !existing) continue;
  if (matchingGames?.size && existing && !matchingGames.has(normTitle(existing.title))) continue;
  if (existing) title = existing.title;
  const year = existing?.year || 0; // discovery feeds often give project/release years
  const game = card(title, year);
  addPort(game, {
    title: row.project && normTitle(row.project) !== normTitle(title) ? row.project : '',
    developer: repo.split('/')[0], platform: originalPlatforms[repo] || existing?.platform || PLATFORM[row.platform] || '',
    url: row.url, kind: 'github', download: ev.apkRelease || row.url,
    version: ev.apkVersion || '', updated: ev.apkDate || '', stars: ev.stars || 0,
    downloads: ev.apkDownloads || 0, files: '', works: '',
    notes: repo === 'alex-letux/perfect_dark_vr' ? 'Requires a Meta Quest VR headset.' : androidEvidence === 'github-readme' ? 'Source-only Android project; see its repository for build and device requirements.' : '',
    source: row.list, androidEvidence,
  });
  // Subsequent leads for the same project must reuse this title, not create aliases.
  if (!matchingGames?.size) byRepo.set(repo, new Map([[normTitle(title), { title, year, platform: existing?.platform || '' }]]));
}

/* ------------------------------------------ keep the strongest port first */

const extras = [
  ...curated,
  ...[...cards.values()]
    .filter((g) => g.ports.length)
    .map((g) => {
      const ordered = rankPorts(g.ports);
      const primary = ordered[0];
      return {
      title: g.title,
      game: g.title,
      year: g.year || 0,
      genres: g.genres,
      description: g.description.slice(0, 1100),
      cover: g.cover,
      shots: g.shots.slice(0, 4),
      list: primary.source,
      project: primary.title,
      developer: primary.developer,
      platform: primary.platform,
      url: primary.url,
      download: primary.download,
      androidEvidence: primary.androidEvidence,
      version: primary.version || '',
      updated: primary.updated || '',
      stars: primary.stars || 0,
      downloads: primary.downloads || 0,
      files: primary.files || '',
      works: primary.works || '',
      notes: primary.notes || '',
      siblingPorts: ordered.slice(1),
      };
    }),
];

fs.writeFileSync(path.join(SRC, 'extras.json'), JSON.stringify(extras, null, 1));
const withArt = extras.filter((e) => e.cover).length;
console.log(
  `catalog lists imported: ${cards.size} distinct games, ${extras.length} entries, ${withArt} with cover art, ` +
    `${extras.filter((e) => e.shots?.length).length} with screenshots, ${extras.reduce((s, e) => s + 1 + (e.siblingPorts?.length || 0), 0)} ports`,
);
