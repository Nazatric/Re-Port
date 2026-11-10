#!/usr/bin/env node
/**
 * Build-time artwork and details for the catalog, from keyed sources the developer controls.
 *   IGDB (Twitch client credentials): title, year, summary, developer, screenshots, cover.
 *   SteamGridDB (API key): portrait grids and heroes, the best image selection.
 *   Steam CDN (no key): used only where the catalog already has a Steam AppID.
 * Keys are read from CI secrets and never written to the output. Users add nothing.
 * Output: src/data/enrichment.json. Without keys the script exits cleanly and the app keeps its 1.1 behaviour.
 *
 * Method inspired by Nebula's metadata design (IGDB for metadata, SteamGridDB for images, match once on add).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTitle, scoreCandidate, confidentChoice, editionBase, yearOf } from "./artwork/title-match.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");
const OUT = resolve(ROOT, "src/data/enrichment.json");
const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, STEAMGRIDDB_KEY } = process.env;
const UA = "Re-Port/1.2 (https://github.com/Nazatric/Re-Port; build-time catalog artwork)";
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) log("IGDB secrets missing: IGDB lookups skipped");
if (!STEAMGRIDDB_KEY) log("SteamGridDB secret missing: SteamGridDB lookups skipped");

/** Fetch with retries; returns parsed JSON, or null for 404 or failure. */
async function call(url, { method = "GET", headers = {}, body, json = true } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { method, headers: { "User-Agent": UA, ...headers }, body, signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) return null;
      return json ? await res.json() : res;
    } catch { await sleep(1500 * (attempt + 1)); }
  }
  return null;
}
/** Parallel map with a fixed number of workers. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
const games = catalog.games;
log(`catalog: ${games.length} games`);

// ---------- IGDB ----------
let igdbToken = null;
async function igdb() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  const t = await call(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(TWITCH_CLIENT_ID)}&client_secret=${encodeURIComponent(TWITCH_CLIENT_SECRET)}&grant_type=client_credentials`, { method: "POST" });
  if (!t?.access_token) { log("IGDB: token request failed"); return null; }
  igdbToken = t.access_token;
  return async (query) => call("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${igdbToken}`, "Content-Type": "text/plain" },
    body: query,
  });
}
const clean = (s) => String(s).replace(/["\\]/g, " ").trim();

async function matchIGDB(game, query) {
  const term = clean(editionBase(game.title));
  const hits = await query(`search "${term}"; fields name,first_release_date,summary,cover.image_id,screenshots.image_id,involved_companies.company.name,involved_companies.developer; where version_parent = null; limit 8;`);
  if (!Array.isArray(hits) || !hits.length) return null;
  const scored = hits.map((h) => {
    const year = h.first_release_date ? new Date(h.first_release_date * 1000).getUTCFullYear() : null;
    return { h, ...scoreCandidate(game.title, h.name ?? "", { queryYear: game.year, candidateYear: year }) };
  });
  return confidentChoice(scored, { min: 0.95, gap: 0.1 })?.h ?? null;
}

// ---------- SteamGridDB ----------
const SGDB = "https://www.steamgriddb.com/api/v2";
const sgdbHeaders = { Authorization: `Bearer ${STEAMGRIDDB_KEY}` };
async function matchSGDB(game) {
  const term = encodeURIComponent(clean(editionBase(game.title)));
  const list = await call(`${SGDB}/search/autocomplete/${term}`, { headers: sgdbHeaders });
  const items = list?.data ?? [];
  const scored = items.map((g) => {
    const year = g.release_date ? new Date(g.release_date * 1000).getUTCFullYear() : null;
    return { g, ...scoreCandidate(game.title, g.name ?? "", { queryYear: game.year, candidateYear: year }) };
  });
  return confidentChoice(scored, { min: 0.95, gap: 0.1 })?.g ?? null;
}
async function sgdbImages(id) {
  const [grid, hero] = await Promise.all([
    call(`${SGDB}/grids/game/${id}?dimensions=600x900&types=static&nsfw=false&humor=false`, { headers: sgdbHeaders }),
    call(`${SGDB}/heroes/game/${id}?types=static&nsfw=false&humor=false`, { headers: sgdbHeaders }),
  ]);
  const top = (r) => (r?.data ?? []).filter((a) => a.url).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.url ?? null;
  return { cover: top(grid), hero: top(hero) };
}

// ---------- Steam CDN (keyless, only for catalog AppIDs) ----------
async function steamCdn(appId) {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/`;
  const ok = async (f) => { const r = await call(base + f, { method: "HEAD", json: false }); return r?.ok ? base + f : null; };
  return { cover: (await ok("library_600x900_2x.jpg")) ?? (await ok("library_600x900.jpg")), hero: await ok("library_hero.jpg") };
}

// ---------- Run ----------
const igdbQuery = await igdb();
const igdbOut = new Map();
const sgdbOut = new Map();
const igdbLane = igdbQuery
  ? pool(games, 1, async (g) => {
      await sleep(260); // IGDB allows 4 requests per second
      const hit = await matchIGDB(g, igdbQuery).catch(() => null);
      if (hit) igdbOut.set(g.id, hit);
    })
  : Promise.resolve();
const sgdbLane = STEAMGRIDDB_KEY
  ? pool(games, 4, async (g) => {
      const match = await matchSGDB(g).catch(() => null);
      if (!match) return;
      const images = await sgdbImages(match.id).catch(() => ({}));
      sgdbOut.set(g.id, { id: match.id, ...images });
    })
  : Promise.resolve();
await Promise.all([igdbLane, sgdbLane]);
log(`IGDB matched ${igdbOut.size}, SteamGridDB matched ${sgdbOut.size}`);

const steamIds = games.filter((g) => g.steamAppId).map((g) => g.steamAppId);
const steamArt = new Map();
await pool(steamIds, 8, async (id) => steamArt.set(id, await steamCdn(id)));

// Assemble. Only verified data goes in; the app falls back to the 1.1 lookup for anything missing.
const out = { version: 4, generatedAt: new Date().toISOString(), games: {} };
for (const g of games) {
  const e = { hit: false };
  const ig = igdbOut.get(g.id);
  const sg = sgdbOut.get(g.id);
  const st = g.steamAppId ? steamArt.get(g.steamAppId) : null;
  if (ig) {
    e.description = ig.summary?.trim() || undefined;
    e.developer = ig.involved_companies?.find((c) => c.developer)?.company?.name;
    const year = ig.first_release_date ? new Date(ig.first_release_date * 1000).getUTCFullYear() : null;
    if (year && !g.year) e.year = year;
    if (ig.cover?.image_id) { e.cover = `https://images.igdb.com/igdb/image/upload/t_cover_big/${ig.cover.image_id}.jpg`; e.coverSource = "igdb"; }
    if (ig.screenshots?.length) e.shots = ig.screenshots.slice(0, 6).map((s) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`);
  }
  // Image priority: Steam CDN (catalog AppID) > SteamGridDB portrait > IGDB cover.
  if (st?.cover) { e.cover = st.cover; e.coverSource = "steam"; }
  else if (sg?.cover) { e.cover = sg.cover; e.coverSource = "steamgriddb"; }
  if (st?.hero) e.hero = st.hero;
  else if (sg?.hero) e.hero = sg.hero;
  if (g.steamAppId) e.steamAppId = g.steamAppId;
  e.hit = !!(e.cover || e.description);
  if (e.hit) out.games[g.id] = e;
}
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
const count = (f) => Object.values(out.games).filter(f).length;
log(`bundle: ${Object.keys(out.games).length} games, ${count((x) => x.cover)} covers, ${count((x) => x.description)} descriptions, ${count((x) => x.hero)} heroes`);
