#!/usr/bin/env node
/**
 * Build-time metadata and artwork enrichment using ONLY keyless public sources.
 * Users never add an API key: results are written to src/data/enrichment.json and bundled in the app.
 *
 * Sources (all free, no account or key):
 *   - Steam Store public API   PC/Android/other titles: cover (header), screenshots, description, developer, genres, year
 *   - Wikidata                 video-game identity check, release year, developer
 *   - Wikipedia REST summary   description and lead image, only for pages that are video games
 *   - Libretro thumbnails      console box art (Named_Boxarts), file must exist (HEAD 200)
 *
 * A candidate is only accepted when the title matches exactly (after normalising case, accents and
 * punctuation) and the release year agrees with the catalog year when both are known. Nothing is
 * guessed from fuzzy or free-text search.
 *
 * Usage: node scripts/enrich-artwork.mjs [--limit N] [--ids a,b] [--force]
 * Re-runs are incremental: hits are refreshed after 30 days, misses after 7 days.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");
const OUT = resolve(ROOT, "src/data/enrichment.json");
const UA = "Re-Port/1.2 (https://github.com/Nazatric/Re-Port; catalog metadata enrichment)";
const DAY = 24 * 3600 * 1000;
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const LIMIT = Number(arg("--limit") ?? Infinity);
const ONLY = arg("--ids")?.split(",").filter(Boolean);
const FORCE = args.includes("--force");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET JSON with polite throttling and backoff for 429/5xx. Returns null on 404 or failure. */
async function getJson(url, { delay = 400, retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await sleep(delay);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) { await sleep(20000 * (attempt + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(2000 * (attempt + 1)); }
  }
  return null;
}

async function urlOk(url) {
  await sleep(150);
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch { return false; }
}

export function normalizeTitle(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "and").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}
export const baseTitle = (s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();
const yearOf = (text) => { const m = String(text ?? "").match(/(19|20)\d{2}/); return m ? Number(m[0]) : 0; };
export const yearsCompatible = (catalogYear, sourceYear) =>
  !(catalogYear > 0 && sourceYear > 0 && Math.abs(catalogYear - sourceYear) > 1);
export const titleMatches = (game, name) => {
  const n = normalizeTitle(name);
  return n === normalizeTitle(game.title) || n === normalizeTitle(baseTitle(game.title));
};

/** Catalog platform → Libretro system folder. Console games only; PC titles use Steam. */
const LIBRETRO = {
  "PlayStation": "Sony_-_PlayStation", "PlayStation 2": "Sony_-_PlayStation_2", "PSP": "Sony_-_PlayStation_Portable",
  "Xbox": "Microsoft_-_Xbox", "Xbox 360": "Microsoft_-_Xbox_360", "Nintendo 64": "Nintendo_-_Nintendo_64",
  "GameCube": "Nintendo_-_GameCube", "Wii": "Nintendo_-_Wii", "Wii U": "Nintendo_-_Wii_U",
  "Nintendo DS": "Nintendo_-_Nintendo_DS", "Nintendo 3DS": "Nintendo_-_Nintendo_3DS", "Game Boy": "Nintendo_-_Game_Boy",
  "Game Boy Color": "Nintendo_-_Game_Boy_Color", "Game Boy Advance": "Nintendo_-_Game_Boy_Advance", "NES": "Nintendo_-_Nintendo_Entertainment_System",
  "SNES": "Nintendo_-_Super_Nintendo_Entertainment_System", "Super Nintendo": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "Sega Saturn": "Sega_-_Saturn", "Dreamcast": "Sega_-_Dreamcast", "Sega Genesis": "Sega_-_Mega_Drive",
};
const PC_LIKE = new Set(["PC", "Other", "Unknown", "Mobile", "Android", "iOS", "Engines & launchers", "Nvidia Shield", "Arcade", "Nintendo Switch", "Nintendo Switch 2", "Wii U"]);

async function fromSteam(game) {
  const ids = new Set();
  if (game.steamAppId) ids.add(game.steamAppId);
  if (!game.steamAppId) {
    const search = await getJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(baseTitle(game.title))}&l=english&cc=us`);
    for (const item of (search?.items ?? []).filter((i) => i.type === "app" && titleMatches(game, i.name)).slice(0, 3)) ids.add(item.id);
  }
  for (const id of ids) {
    const detail = await getJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`, { delay: 1500 });
    const data = detail?.[String(id)]?.success ? detail[String(id)].data : null;
    if (!data) continue;
    if (!titleMatches(game, data.name ?? "")) continue;
    const year = yearOf(data.release_date?.date);
    if (!yearsCompatible(game.year, year)) continue;
    // Portrait library art matches the catalog's covers; fall back to the landscape header when absent.
    const portrait = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;
    const cover = (await urlOk(portrait)) ? portrait : data.header_image ?? null;
    return {
      source: "steam",
      steamAppId: id,
      cover,
      shots: (data.screenshots ?? []).slice(0, 6).map((s) => s.path_thumbnail).filter(Boolean),
      description: data.short_description?.trim() || null,
      developer: data.developers?.[0] ?? null,
      genres: (data.genres ?? []).map((g) => g.description).filter(Boolean),
      year: year || null,
    };
  }
  return null;
}

async function fromWikidata(game) {
  const search = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=6&search=${encodeURIComponent(baseTitle(game.title))}`, { delay: 300 });
  const hits = (search?.search ?? []).filter((h) => titleMatches(game, h.label ?? "") || titleMatches(game, h.match?.text ?? ""));
  if (!hits.length) return null;
  const ids = hits.map((h) => h.id).join("|");
  const entities = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|sitelinks&sitefilter=enwiki&ids=${ids}`, { delay: 300 });
  for (const hit of hits) {
    const e = entities?.entities?.[hit.id];
    if (!e) continue;
    const isGame = (e.claims?.P31 ?? []).some((c) => ["Q7889", "Q1054081", "Q1980247"].includes(c.mainsnak?.datavalue?.value?.id));
    if (!isGame) continue;
    const year = yearOf(e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time);
    if (!yearsCompatible(game.year, year)) continue;
    return { wikiTitle: e.sitelinks?.enwiki?.title ?? null, year: year || null };
  }
  return null;
}

async function fromWikipedia(game, wikiTitle) {
  const base = baseTitle(game.title);
  const candidates = [wikiTitle, game.year ? `${base} (${game.year} video game)` : null, `${base} (video game)`].filter(Boolean);
  for (const t of candidates) {
    const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`, { delay: 300 });
    if (!s || s.type === "disambiguation") continue;
    if (!/video game/i.test(s.description ?? "")) continue;
    if (!titleMatches(game, (s.title ?? "").replace(/\s*\(.*\)$/, "")) && !titleMatches(game, s.title ?? "")) continue;
    return {
      source: "wikipedia",
      description: s.extract ? s.extract.split(/(?<=\.)\s/).slice(0, 2).join(" ") : null,
      cover: s.thumbnail?.source ?? null,
      year: yearOf(s.description) || null,
    };
  }
  return null;
}

async function fromLibretro(game) {
  const system = LIBRETRO[game.platform];
  if (!system) return null;
  const base = game.title.replace(/[&*/:`<>?\\|"]/g, "_");
  for (const region of ["(USA)", "(Europe)", "(World)", "(Japan)", ""]) {
    const name = region ? `${base} ${region}.png` : `${base}.png`;
    const url = `https://thumbnails.libretro.com/${system}/Named_Boxarts/${encodeURIComponent(name)}`;
    if (await urlOk(url)) return { source: "libretro", cover: url };
  }
  return null;
}

async function enrichOne(game) {
  const found = {};
  const merge = (r) => { if (!r) return; for (const [k, v] of Object.entries(r)) if (v != null && v !== "" && (found[k] == null || (Array.isArray(v) && !found[k].length))) found[k] = v; };
  const sources = [];
  if (PC_LIKE.has(game.platform) || !LIBRETRO[game.platform]) {
    const steam = await fromSteam(game); if (steam) { merge(steam); sources.push("steam"); }
  }
  const wd = await fromWikidata(game);
  const wiki = await fromWikipedia(game, wd?.wikiTitle ?? null);
  if (wiki) { merge(wiki); sources.push("wikipedia"); }
  if (wd?.year) merge({ year: wd.year });
  if (!found.cover) { const lr = await fromLibretro(game); if (lr) { merge(lr); sources.push("libretro"); } }
  if (!Object.keys(found).length) return null;
  return { ...found, sources: [...new Set(sources)] };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  let store = { version: 1, generatedAt: null, games: {} };
  try { store = JSON.parse(await readFile(OUT, "utf8")); } catch { /* first run */ }
  const now = Date.now();
  let done = 0;
  for (const game of catalog.games) {
    if (done >= LIMIT) break;
    if (ONLY && !ONLY.includes(game.id)) continue;
    const prev = store.games[game.id];
    const age = prev ? now - Date.parse(prev.checkedAt) : Infinity;
    const ttl = prev?.hit ? 30 * DAY : 7 * DAY;
    if (!FORCE && prev && age < ttl) continue;
    done++;
    let result = null;
    try { result = await enrichOne(game); } catch (err) { console.warn(`${game.id}: ${err.message}`); }
    store.games[game.id] = result
      ? { hit: true, checkedAt: new Date().toISOString(), ...result }
      : { hit: false, checkedAt: new Date().toISOString() };
    console.log(`${result ? "ok  " : "miss"} ${game.title} [${result?.sources?.join(",") ?? ""}]`);
    if (done % 25 === 0) await save(store);
  }
  await save(store);
  const hits = Object.values(store.games).filter((g) => g.hit).length;
  console.log(`enriched ${hits}/${catalog.games.length} games (checked this run: ${done})`);
}

async function save(store) {
  store.generatedAt = new Date().toISOString();
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(store, null, 1) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
