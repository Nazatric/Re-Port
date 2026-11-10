#!/usr/bin/env node
/**
 * Build-time artwork and metadata for every catalog game, using only keyless public sources.
 * Users add no keys. Output: src/data/enrichment.json, bundled into the app.
 *
 * Method adapted from Taiga Launcher for Steam (Apache-2.0):
 *   1. Identify the Steam AppID with evidence, strongest first:
 *      catalog ID → Wikidata video-game entity (P1733 "Steam application ID") → Steam store search
 *      (only when exactly one title is a confident match).
 *   2. Steam's public CDN art by AppID (portrait cover, hero, logo, wide header), checked with HEAD.
 *      Steam appdetails for description, developer, genres, release year and screenshots.
 *   3. Console games: libretro-thumbnails box art, title and snapshots, chosen by title scoring
 *      against each platform's real file list (no guessed file names).
 *   4. Wikipedia lead text for games that still have no description (video-game articles only).
 *
 * Usage: node scripts/build-artwork.mjs [--workers 8] [--limit N] [--ids a,b] [--force]
 * Re-runs are incremental: hits refresh after 30 days, misses after 7 days.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTitle, scoreCandidate, confidentChoice, editionBase, yearOf } from "./artwork/title-match.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");
const OUT = resolve(ROOT, "src/data/enrichment.json");
const UA = "Re-Port/1.2 (https://github.com/Nazatric/Re-Port; catalog artwork build)";
const DAY = 24 * 3600 * 1000;
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const LIMIT = Number(arg("--limit") ?? Infinity);
const WORKERS = Number(arg("--workers") ?? 8);
const ONLY = arg("--ids")?.split(",").filter(Boolean);
const FORCE = args.includes("--force");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One pacing queue per host, shared by all workers, so the total rate stays under each site's limit. */
const nextSlot = new Map();
async function pace(host, gapMs) {
  const at = Math.max(Date.now(), (nextSlot.get(host) ?? 0) + gapMs);
  nextSlot.set(host, at);
  const wait = at - Date.now();
  if (wait > 0) await sleep(wait);
}
const GAP = { "store.steampowered.com": 1500, "shared.akamai.steamstatic.com": 60, "www.wikidata.org": 100, "en.wikipedia.org": 100, "api.github.com": 100 };

async function request(url, { method = "GET", retries = 3, json = true } = {}) {
  const host = new URL(url).host;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await pace(host, GAP[host] ?? 100);
    try {
      const headers = { "User-Agent": UA, Accept: json ? "application/json" : "*/*" };
      if (host === "api.github.com" && GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
      const res = await fetch(url, { method, headers, redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) { await sleep(30000 * (attempt + 1)); continue; }
      if (!res.ok) return null;
      return method === "HEAD" ? true : json ? await res.json() : await res.text();
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}
const getJson = (url) => request(url);
const exists = async (url) => (await request(url, { method: "HEAD", json: false })) === true;

const LIBRETRO = {
  "PlayStation": "Sony_-_PlayStation", "PlayStation 2": "Sony_-_PlayStation_2", "PSP": "Sony_-_PlayStation_Portable",
  "Xbox": "Microsoft_-_Xbox", "Xbox 360": "Microsoft_-_Xbox_360", "Nintendo 64": "Nintendo_-_Nintendo_64",
  "GameCube": "Nintendo_-_GameCube", "Wii": "Nintendo_-_Wii", "Wii U": "Nintendo_-_Wii_U",
  "Nintendo DS": "Nintendo_-_Nintendo_DS", "Nintendo 3DS": "Nintendo_-_Nintendo_3DS", "Game Boy": "Nintendo_-_Game_Boy",
  "Game Boy Color": "Nintendo_-_Game_Boy_Color", "Game Boy Advance": "Nintendo_-_Game_Boy_Advance",
  "NES": "Nintendo_-_Nintendo_Entertainment_System", "SNES": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "Super Nintendo": "Nintendo_-_Super_Nintendo_Entertainment_System", "Sega Saturn": "Sega_-_Saturn",
  "Dreamcast": "Sega_-_Dreamcast", "Sega Genesis": "Sega_-_Mega_Drive",
};
const REGIONS = ["(USA)", "(World)", "(Europe)", "(Japan)"];

/** Each libretro system's file lists, fetched once per run (one API call per system and folder). */
const listings = new Map();
function libretroFiles(system) {
  if (!listings.has(system)) {
    listings.set(system, (async () => {
      const tree = await getJson(`https://api.github.com/repos/libretro-thumbnails/${system}/git/trees/master?recursive=1`);
      const byFolder = { Named_Boxarts: new Set(), Named_Titles: new Set(), Named_Snaps: new Set() };
      for (const f of tree?.tree ?? []) {
        const [folder, ...rest] = f.path.split("/");
        if (byFolder[folder]) byFolder[folder].add(rest.join("/"));
      }
      return byFolder;
    })());
  }
  return listings.get(system);
}

/** Matches a game to a libretro file by title score. Regions are grouped so one game is one candidate. */
async function libretroArt(game) {
  const system = LIBRETRO[game.platform];
  if (!system) return null;
  const files = await libretroFiles(system);
  const boxes = [...files.Named_Boxarts].filter((n) => n.endsWith(".png"));
  const groups = new Map();
  for (const name of boxes) {
    const base = name.replace(/\.png$/, "").replace(/\s*\([^)]*\)/g, "").trim();
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(name);
  }
  const scored = [...groups.keys()].map((base) => ({ base, ...scoreCandidate(game.title, base, { queryYear: game.year }) }));
  const pick = confidentChoice(scored, { min: 0.95, gap: 0.1 });
  if (!pick) return null;
  const names = groups.get(pick.base);
  const name = REGIONS.map((r) => names.find((n) => n.includes(r))).find(Boolean) ?? names[0];
  const url = (folder) => `https://thumbnails.libretro.com/${system}/${folder}/${encodeURIComponent(name)}`;
  const withFolder = (folder) => (files[folder].has(name) ? url(folder) : null);
  return {
    cover: withFolder("Named_Boxarts"),
    hero: withFolder("Named_Titles") ?? withFolder("Named_Snaps"),
    shots: [withFolder("Named_Snaps")].filter(Boolean),
    libretroName: name,
  };
}

/** Wikidata: video-game entities that match the title, with their year and Steam AppIDs (P1733). */
async function wikidataGame(game) {
  const search = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=8&search=${encodeURIComponent(editionBase(game.title))}`);
  const hits = search?.search ?? [];
  if (!hits.length) return null;
  const data = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|sitelinks&sitefilter=enwiki&ids=${hits.map((h) => h.id).join("|")}`);
  const candidates = [];
  for (const hit of hits) {
    const e = data?.entities?.[hit.id];
    if (!e) continue;
    const isGame = (e.claims?.P31 ?? []).some((c) => ["Q7889", "Q1054081", "Q1980247"].includes(c.mainsnak?.datavalue?.value?.id));
    if (!isGame) continue;
    const year = yearOf(e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time) ?? null;
    const steamIds = (e.claims?.P1733 ?? []).map((c) => Number(c.mainsnak?.datavalue?.value)).filter(Boolean);
    const label = e.labels?.en?.value ?? hit.label ?? "";
    candidates.push({ id: hit.id, year, steamIds, wikiTitle: e.sitelinks?.enwiki?.title ?? null, ...scoreCandidate(game.title, label, { queryYear: game.year, candidateYear: year }) });
  }
  return confidentChoice(candidates, { min: 0.95, gap: 0.1 });
}

/** Steam store search: only a single confident title match is accepted. */
async function steamSearch(game) {
  const data = await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(editionBase(game.title))}&l=english&cc=us`);
  const items = (data?.items ?? []).filter((i) => i.type === "app");
  const scored = items.map((i) => ({ id: i.id, ...scoreCandidate(game.title, i.name, { queryYear: game.year }) }));
  return confidentChoice(scored, { min: 0.95, gap: 0.1 })?.id ?? null;
}

async function steamDetails(id, game) {
  const detail = await getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`);
  const data = detail?.[String(id)]?.success ? detail[String(id)].data : null;
  if (!data) return null;
  const year = yearOf(data.release_date?.date);
  // The name must still match the catalog title, so a reused AppID never gives the wrong art.
  const check = scoreCandidate(game.title, data.name ?? "", { queryYear: game.year, candidateYear: year });
  if (check.score < 0.95) return null;
  return {
    name: data.name,
    year,
    description: data.short_description?.trim() || null,
    developer: data.developers?.[0] ?? null,
    genres: (data.genres ?? []).map((g) => g.description).filter(Boolean),
    shots: (data.screenshots ?? []).slice(0, 6).map((s) => s.path_thumbnail).filter(Boolean),
  };
}

/** Steam's public CDN art for an AppID (no key). Each asset is checked, not assumed. */
async function steamArt(id) {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/`;
  const [portrait2x, portrait, hero, logo, wide] = await Promise.all([
    exists(base + "library_600x900_2x.jpg"), exists(base + "library_600x900.jpg"),
    exists(base + "library_hero.jpg"), exists(base + "logo.png"), exists(base + "header.jpg"),
  ]);
  return {
    cover: portrait2x ? base + "library_600x900_2x.jpg" : portrait ? base + "library_600x900.jpg" : null,
    hero: hero ? base + "library_hero.jpg" : null,
    logo: logo ? base + "logo.png" : null,
    wide: wide ? base + "header.jpg" : null,
  };
}

/** Wikipedia lead text, used only for games with no other description. */
async function wikipediaText(title, year) {
  const base = editionBase(title);
  for (const t of [title, year ? `${base} (${year} video game)` : null, `${base} (video game)`].filter(Boolean)) {
    const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`);
    if (!s || s.type === "disambiguation" || !/video game/i.test(s.description ?? "")) continue;
    if (normalizeTitle(s.title ?? "").replace(/ video game$/, "") !== normalizeTitle(base)) continue;
    return s.extract ? s.extract.split(/(?<=\.)\s/).slice(0, 2).join(" ") : null;
  }
  return null;
}

async function enrichOne(game) {
  const out = { sources: [] };
  const wd = await wikidataGame(game).catch(() => null);
  if (wd?.year) out.year = wd.year;

  // 1. AppID with evidence: catalog → Wikidata P1733 → Steam search.
  let appId = game.steamAppId || wd?.steamIds?.[0] || null;
  if (appId) out.sources.push(game.steamAppId ? "catalog-appid" : "wikidata-appid");
  if (!appId && !LIBRETRO[game.platform]) {
    appId = await steamSearch(game);
    if (appId) out.sources.push("steam-search");
  }

  // 2. Steam details and CDN art.
  if (appId) {
    const details = await steamDetails(appId, game);
    if (details) {
      out.steamAppId = Number(appId);
      out.sources.push("steam");
      Object.assign(out, { description: details.description, developer: details.developer, genres: details.genres, shots: details.shots });
      if (details.year) out.year ??= details.year;
      Object.assign(out, await steamArt(appId));
      out.coverSource = out.cover ? "steam" : null;
    }
  }

  // 3. Console box art and snapshots from libretro-thumbnails, only where Steam gave no cover.
  if (!out.cover) {
    const lr = await libretroArt(game).catch(() => null);
    if (lr?.cover) {
      out.cover = lr.cover; out.coverSource = "libretro"; out.sources.push("libretro");
      out.hero ??= lr.hero; if (!out.shots?.length && lr.shots?.length) out.shots = lr.shots;
    }
  }

  // 4. Text: Wikipedia only when nothing else described the game.
  if (!out.description) {
    const text = await wikipediaText(game.title, out.year ?? game.year);
    if (text) { out.description = text; out.sources.push("wikipedia"); }
  }

  const useful = out.cover || out.description || out.shots?.length;
  if (!useful) return null;
  for (const k of Object.keys(out)) if (out[k] == null || (Array.isArray(out[k]) && !out[k].length)) delete out[k];
  return out;
}

async function save(store) {
  store.generatedAt = new Date().toISOString();
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(store, null, 1) + "\n");
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  let store = { version: 2, generatedAt: null, games: {} };
  try { store = JSON.parse(await readFile(OUT, "utf8")); store.version = 2; } catch { /* first run */ }
  const now = Date.now();
  const todo = catalog.games.filter((game) => {
    if (ONLY && !ONLY.includes(game.id)) return false;
    const prev = store.games[game.id];
    if (FORCE || !prev) return true;
    return now - Date.parse(prev.checkedAt) >= (prev.hit ? 30 * DAY : 7 * DAY);
  }).slice(0, LIMIT);
  console.log(`building artwork for ${todo.length} games with ${WORKERS} workers`);

  let next = 0, done = 0, hits = 0;
  const worker = async () => {
    while (next < todo.length) {
      const game = todo[next++];
      let result = null;
      try { result = await enrichOne(game); } catch (err) { console.warn(`${game.id}: ${err.message}`); }
      store.games[game.id] = result ? { hit: true, checkedAt: new Date().toISOString(), ...result } : { hit: false, checkedAt: new Date().toISOString() };
      if (result) hits++;
      done++;
      if (done % 50 === 0) { await save(store); console.log(`${done}/${todo.length} done, ${hits} with artwork or details`); }
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  await save(store);
  const total = Object.values(store.games).filter((g) => g.hit).length;
  console.log(`bundled artwork or details for ${total}/${catalog.games.length} games (checked this run: ${done})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
