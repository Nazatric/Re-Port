#!/usr/bin/env node
/**
 * Build a conservative, reproducible Libretro console artwork index from GitHub's file trees.
 * A match requires the same platform and complete normalized title; ambiguous catalog titles are
 * skipped. The index contains URLs and attribution only, not copyrighted image files.
 * Requires the GitHub CLI (gh) with read access. Run after rebuilding the catalog:
 *   node scripts/enrich-console-art.mjs
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const systems = {
  ps1: ['Sony - PlayStation', 'Sony_-_PlayStation'],
  ps2: ['Sony - PlayStation 2', 'Sony_-_PlayStation_2'],
  ps3: ['Sony - PlayStation 3', 'Sony_-_PlayStation_3'],
  ps4: ['Sony - PlayStation 4', 'Sony_-_PlayStation_4'],
  psp: ['Sony - PlayStation Portable', 'Sony_-_PlayStation_Portable'],
  xbox: ['Microsoft - Xbox', 'Microsoft_-_Xbox'],
  xbox360: ['Microsoft - Xbox 360', 'Microsoft_-_Xbox_360'],
  n64: ['Nintendo - Nintendo 64', 'Nintendo_-_Nintendo_64'],
  gamecube: ['Nintendo - GameCube', 'Nintendo_-_GameCube'],
  wii: ['Nintendo - Wii', 'Nintendo_-_Wii'],
  wiiu: ['Nintendo - Wii U', 'Nintendo_-_Wii_U'],
  n3ds: ['Nintendo - Nintendo 3DS', 'Nintendo_-_Nintendo_3DS'],
  nds: ['Nintendo - Nintendo DS', 'Nintendo_-_Nintendo_DS'],
  gba: ['Nintendo - Game Boy Advance', 'Nintendo_-_Game_Boy_Advance'],
  gbc: ['Nintendo - Game Boy Color', 'Nintendo_-_Game_Boy_Color'],
  gb: ['Nintendo - Game Boy', 'Nintendo_-_Game_Boy'],
  snes: ['Nintendo - Super Nintendo Entertainment System', 'Nintendo_-_Super_Nintendo_Entertainment_System'],
  nes: ['Nintendo - Nintendo Entertainment System', 'Nintendo_-_Nintendo_Entertainment_System'],
};
const catalog = JSON.parse(fs.readFileSync('src/data/catalog.json', 'utf8'));
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/,\s*The$/i, '').replace(/^The\s+/i, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
// Strip only distribution metadata, never edition/remaster subtitles or gameplay words.
const metadata = /\s+\((?:USA|Europe|World|Japan|Asia|Australia|Korea|Canada|Brazil|France|Germany|Spain|Italy|Netherlands|Sweden|UK|US|En(?:,[A-Za-z]{2})*|Rev [A-Za-z0-9.]+|Disc 1|v[0-9.]+)(?:,\s*(?:USA|Europe|World|Japan|Asia|Australia|Korea|Canada|Brazil|France|Germany|Spain|Italy|Netherlands|Sweden|UK|US))*\)$/i;
function titleOf(filename) {
  let name = filename.replace(/\.png$/i, '');
  while (metadata.test(name)) name = name.replace(metadata, '');
  return name;
}
function score(filename) {
  return (/\(USA/.test(filename) ? 100 : 0) + (/\(World/.test(filename) ? 80 : 0) + (/\(Europe/.test(filename) ? 60 : 0) + (/\(En[,)]/.test(filename) ? 10 : 0) - (/\(Japan/.test(filename) ? 10 : 0) - (/\(Rev /.test(filename) ? 2 : 0);
}
const result = {};
for (const [platform, [system, repo]] of Object.entries(systems)) {
  const games = catalog.games.filter((g) => g.platform === platform);
  if (!games.length) continue;
  let tree;
  let lastError;
  for (let attempt = 0; attempt < 3 && !tree; attempt++) {
    try {
      tree = JSON.parse(execFileSync('gh', ['api', `repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`], { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    } catch (err) { lastError = err; }
  }
  if (!tree) throw new Error(`Could not fetch ${repo}; no index has been written`, { cause: lastError });
  if (tree.truncated) throw new Error(`GitHub returned a truncated tree for ${repo}; no index has been written`);
  const index = { Named_Snaps: new Map(), Named_Boxarts: new Map() };
  for (const { path, type } of tree.tree) {
    if (type !== 'blob') continue;
    const m = /^(Named_Snaps|Named_Boxarts)\/([^/]+\.png)$/i.exec(path);
    if (!m) continue;
    const key = norm(titleOf(m[2]));
    if (key.length < 4) continue;
    const old = index[m[1]].get(key);
    if (!old || score(m[2]) > score(old)) index[m[1]].set(key, m[2]);
  }
  const counts = new Map();
  for (const game of games) counts.set(norm(game.title), (counts.get(norm(game.title)) || 0) + 1);
  let found = 0;
  for (const game of games) {
    const key = norm(game.title);
    if (key.length < 4 || counts.get(key) !== 1) continue;
    const url = (type) => {
      const filename = index[type].get(key);
      return filename ? `https://thumbnails.libretro.com/${encodeURIComponent(system)}/${type}/${encodeURIComponent(filename)}` : undefined;
    };
    const cover = url('Named_Boxarts');
    const screenshot = url('Named_Snaps');
    if (!cover && !screenshot) continue;
    result[game.id] = { title: game.title, platform, ...(cover ? { cover } : {}), ...(screenshot ? { shots: [screenshot] } : {}) };
    found++;
  }
  console.log(`${platform}: ${found}/${games.length} exact title matches`);
}
fs.writeFileSync('data/source/console-art.json', JSON.stringify(result, null, 2) + '\n');
console.log(`Saved ${Object.keys(result).length} title-and-platform matches to data/source/console-art.json.`);
