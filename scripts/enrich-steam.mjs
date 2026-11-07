#!/usr/bin/env node
/**
 * Looks up real Steam artwork and screenshots for PC games in the catalog.
 * Matching is strict: a game is linked only when the normalized title is identical.
 * Results are cached in data/source/steam-map.json and the script is resumable.
 *
 * Usage: node scripts/enrich-steam.mjs   (then re-run scripts/build-data.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'src/data/catalog.json');
const MAP = path.join(ROOT, 'data/source/steam-map.json');
const MISS = path.join(ROOT, 'data/source/steam-miss.json');

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {};
const miss = fs.existsSync(MISS) ? JSON.parse(fs.readFileSync(MISS, 'utf8')) : {};

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/^the\s+/, '')
    // Edition and remake words are part of identity, not disposable noise.
    .replace(/[^a-z0-9]+/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PortDeckBuild' }, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        await sleep(30000);
        continue;
      }
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (e) {
      await sleep(2000 * (i + 1));
    }
  }
  return null;
}

// null is an explicit reviewed rejection, not a cache miss.
const targets = catalog.games.filter((g) => ['pc', 'android64', 'ios'].includes(g.platform) && !Object.prototype.hasOwnProperty.call(map, g.id) && !miss[g.id]);
console.log('to look up:', targets.length);
let n = 0;
for (const g of targets) {
  n++;
  let appId = g.steam?.id || null;
  if (!appId) {
    const q = encodeURIComponent(g.title.replace(/[™®]/g, ''));
    const res = await getJson(`https://store.steampowered.com/api/storesearch/?term=${q}&l=english&cc=US`);
    await sleep(1400);
    const hit = res?.items?.find((it) => it.type === 'app' && norm(it.name) === norm(g.title));
    if (!hit) {
      miss[g.id] = 1;
    } else appId = hit.id;
  }
  if (appId) {
    const det = await getJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`);
    await sleep(1500);
    const d = det?.[appId]?.data;
    // A matching name alone can identify an entirely different game (e.g. remakes).
    // Steam re-releases may be newer than the original; skip uncertain dates rather than
    // attaching incorrect cover art/screenshots. Reviewed exceptions can be added by hand.
    const year = Number(/\b(?:19|20)\d{2}\b/.exec(d?.release_date?.date || '')?.[0]) || 0;
    if (d && g.year && year && Math.abs(g.year - year) <= 2 && norm(d.name) === norm(g.title)) {
      map[g.id] = {
        id: appId,
        shots: (d.screenshots || []).slice(0, 5).map((s) => String(s.path_full).split('?')[0]),
        dev: (d.developers || []).slice(0, 2).join(', ') || undefined,
      };
    } else miss[g.id] = 1;
  }
  if (n % 20 === 0) {
    fs.writeFileSync(MAP, JSON.stringify(map));
    fs.writeFileSync(MISS, JSON.stringify(miss));
    console.log(`${n}/${targets.length} matched=${Object.keys(map).length}`);
  }
}
fs.writeFileSync(MAP, JSON.stringify(map));
fs.writeFileSync(MISS, JSON.stringify(miss));
console.log('done', Object.keys(map).length, 'matched');
