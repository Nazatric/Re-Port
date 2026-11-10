#!/usr/bin/env node
/**
 * Fast build-time artwork bundle. Runs inside the Android build (about 2-5 minutes); the APK then
 * opens with covers, hero images and descriptions for every game it can verify. Keyless sources only.
 *
 *   1. Wikidata SPARQL, one query: video games with a Steam AppID (P1733), release year, box-art image.
 *   2. Wikipedia MediaWiki API, 50 titles per request: lead image, text, and short description
 *      (only pages whose short description says "video game").
 *   3. Steam CDN art by AppID (HEAD checks, no API limit).
 *   4. libretro-thumbnails: one GitHub tree listing per console system, matched locally.
 *
 * Method adapted from Taiga Launcher for Steam (Apache-2.0). Writes src/data/enrichment.json.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTitle, scoreCandidate, confidentChoice, editionBase, yearOf } from "./artwork/title-match.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");
const OUT = resolve(ROOT, "src/data/enrichment.json");
const UA = "Re-Port/1.2 (https://github.com/Nazatric/Re-Port; build-time catalog artwork)";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

async function get(url, { json = true, method = "GET", timeout = 30000 } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = { "User-Agent": UA, Accept: json ? "application/json" : "*/*" };
      if (url.includes("api.github.com") && GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
      const res = await fetch(url, { method, headers, signal: AbortSignal.timeout(timeout) });
      if (res.status === 404) return null;
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 5000 * (attempt + 1))); continue; }
      if (!res.ok) return null;
      return method === "HEAD" ? true : json ? await res.json() : await res.text();
    } catch { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  return null;
}
/** Runs tasks with a fixed number of parallel workers. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
const games = catalog.games;
log(`catalog: ${games.length} games`);

// 1. Wikidata: every video game with a Steam AppID, in one query.
const sparql = `SELECT ?item ?itemLabel ?appid ?year ?image WHERE {
  ?item wdt:P31/wdt:P279* wd:Q7889 ; wdt:P1733 ?appid .
  OPTIONAL { ?item wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
  OPTIONAL { ?item wdt:P18 ?image }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const wdData = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`);
const wdRows = wdData?.results?.bindings ?? [];
const steamByLabel = new Map();
for (const r of wdRows) {
  const label = r.itemLabel?.value ?? "";
  const entry = { appId: Number(r.appid?.value), year: Number(r.year?.value) || null, image: r.image?.value ?? null, label };
  if (!entry.appId) continue;
  const key = normalizeTitle(label);
  if (!steamByLabel.has(key)) steamByLabel.set(key, []);
  steamByLabel.get(key).push(entry);
}
log(`wikidata: ${wdRows.length} video games with Steam IDs`);

// Match each catalog game to a Wikidata entry: exact title, year-compatible, unique best.
const wdMatch = new Map();
for (const g of games) {
  const pool1 = [...(steamByLabel.get(normalizeTitle(g.title)) ?? []), ...(steamByLabel.get(normalizeTitle(editionBase(g.title))) ?? [])];
  const scored = pool1.map((e) => ({ ...e, ...scoreCandidate(g.title, e.label, { queryYear: g.year, candidateYear: e.year }) }));
  const best = confidentChoice(scored.filter((s) => !s.year || !g.year || Math.abs(s.year - g.year) <= 1), { min: 0.95, gap: 0.05 });
  if (best) wdMatch.set(g.id, best);
}
// Catalog AppIDs are trusted as given.
for (const g of games) if (g.steamAppId && !wdMatch.has(g.id)) wdMatch.set(g.id, { appId: g.steamAppId, image: null });
log(`matched Steam IDs: ${wdMatch.size}`);

// 2. Wikipedia: summary, lead image and short description, 50 titles per request.
const wiki = new Map();
const titleSets = games.map((g) => {
  const base = editionBase(g.title);
  return [g.id, [...new Set([g.title, g.year ? `${base} (${g.year} video game)` : null, `${base} (video game)`].filter(Boolean))]];
});
const batches = [];
const flat = titleSets.flatMap(([id, ts]) => ts.map((t) => ({ id, t })));
for (let i = 0; i < flat.length; i += 50) batches.push(flat.slice(i, i + 50));
await pool(batches, 4, async (batch) => {
  const q = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "extracts|pageimages|pageprops", exintro: "1", explaintext: "1", exsentences: "2", piprop: "thumbnail", pithumbsize: "600", ppprop: "wikibase-shortdesc", titles: batch.map((b) => b.t).join("|") });
  const data = await get(`https://en.wikipedia.org/w/api.php?${q}`);
  const pages = Object.values(data?.query?.pages ?? {});
  const norm = new Map(); for (const p of pages) norm.set(p.title, p);
  for (const { id, t } of batch) {
    const p = pages.find((x) => x.title === t) ?? norm.get(t);
    if (!p || p.missing !== undefined) continue;
    const short = p.pageprops?.["wikibase-shortdesc"] ?? "";
    if (!/video game/i.test(short)) continue;
    const game = games.find((g) => g.id === id);
    if (scoreCandidate(editionBase(game.title), p.title.replace(/\s*\(.*\)$/, "")).score < 0.95) continue;
    if (!wiki.has(id)) wiki.set(id, { description: p.extract?.trim() || null, image: p.thumbnail?.source ?? null, year: yearOf(short), title: p.title });
  }
});
log(`wikipedia: ${wiki.size} games with a video-game article`);

// 3. Steam CDN art, checked in parallel (no per-game API calls).
const steamIds = [...new Set([...wdMatch.values()].map((m) => m.appId))];
const steamArt = new Map();
await pool(steamIds, 16, async (id) => {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/`;
  const [p2, p1, hero, logo, wide] = await Promise.all(["library_600x900_2x.jpg", "library_600x900.jpg", "library_hero.jpg", "logo.png", "header.jpg"].map((f) => get(base + f, { json: false, method: "HEAD", timeout: 15000 })));
  steamArt.set(id, {
    cover: p2 ? base + "library_600x900_2x.jpg" : p1 ? base + "library_600x900.jpg" : wide ? base + "header.jpg" : null,
    hero: hero ? base + "library_hero.jpg" : null,
    logo: logo ? base + "logo.png" : null,
  });
});
log(`steam art checked for ${steamIds.length} AppIDs`);

// 4. libretro: one tree listing per system, matched locally.
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
const systems = [...new Set(Object.values(LIBRETRO))];
const listing = new Map();
await pool(systems, 6, async (system) => {
  const tree = await get(`https://api.github.com/repos/libretro-thumbnails/${system}/git/trees/master?recursive=1`);
  listing.set(system, (tree?.tree ?? []).filter((f) => f.path.startsWith("Named_Boxarts/") || f.path.startsWith("Named_Titles/") || f.path.startsWith("Named_Snaps/")).map((f) => f.path));
});
const REGIONS = ["(USA)", "(World)", "(Europe)", "(Japan)"];
const libretro = new Map();
for (const g of games) {
  const system = LIBRETRO[g.platform];
  if (!system) continue;
  const paths = (listing.get(system) ?? []).filter((p) => p.startsWith("Named_Boxarts/") && p.endsWith(".png"));
  const groups = new Map();
  for (const p of paths) {
    const name = p.slice("Named_Boxarts/".length);
    const base = name.replace(/\.png$/, "").replace(/\s*\([^)]*\)/g, "").trim();
    groups.set(base, [...(groups.get(base) ?? []), name]);
  }
  const pick = confidentChoice([...groups.keys()].map((base) => ({ base, ...scoreCandidate(g.title, base, { queryYear: g.year }) })), { min: 0.95, gap: 0.1 });
  if (!pick) continue;
  const files = groups.get(pick.base);
  const name = REGIONS.map((r) => files.find((f) => f.includes(r))).find(Boolean) ?? files[0];
  const has = (folder) => (listing.get(system) ?? []).includes(`${folder}/${name}`);
  const u = (folder) => `https://thumbnails.libretro.com/${system}/${folder}/${encodeURIComponent(name)}`;
  libretro.set(g.id, { cover: u("Named_Boxarts"), hero: has("Named_Titles") ? u("Named_Titles") : has("Named_Snaps") ? u("Named_Snaps") : null, shots: has("Named_Snaps") ? [u("Named_Snaps")] : [] });
}
log(`libretro: ${libretro.size} console games matched`);

// Assemble the bundle. Each entry only holds verified data; nothing is guessed.
const out = { version: 4, generatedAt: new Date().toISOString(), games: {} };
for (const g of games) {
  const entry = { hit: false };
  const w = wdMatch.get(g.id);
  const sa = w ? steamArt.get(w.appId) : null;
  if (w) { entry.steamAppId = w.appId; }
  if (sa?.cover) { entry.cover = sa.cover; entry.coverSource = "steam"; }
  if (sa?.hero) entry.hero = sa.hero;
  if (sa?.logo) entry.logo = sa.logo;
  const lr = libretro.get(g.id);
  if (!entry.cover && lr?.cover) { entry.cover = lr.cover; entry.coverSource = "libretro"; }
  if (!entry.hero && lr?.hero) entry.hero = lr.hero;
  if (lr?.shots?.length) entry.shots = lr.shots;
  const wk = wiki.get(g.id);
  if (!entry.cover && wk?.image) { entry.cover = wk.image; entry.coverSource = "wikipedia"; }
  if (wk?.description) entry.description = wk.description;
  if (w?.year || wk?.year) entry.year = w?.year ?? wk.year;
  entry.hit = !!(entry.cover || entry.description);
  if (entry.hit) out.games[g.id] = entry;
}
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
const withCover = Object.values(out.games).filter((x) => x.cover).length;
const withDesc = Object.values(out.games).filter((x) => x.description).length;
log(`bundle: ${Object.keys(out.games).length} games, ${withCover} with cover, ${withDesc} with description`);
