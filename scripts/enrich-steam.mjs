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
    .replace(/\b(game of the year|goty|definitive|enhanced|remastered|edition|hd)\b/g, '')
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

const targets = catalog.games.filter((g) => ['pc', 'android64', 'ios'].includes(g.platform) && !map[g.id] && !miss[g.id]);
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
    if (d) {
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
