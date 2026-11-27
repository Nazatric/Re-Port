#!/usr/bin/env node
/**
 * Builds hand-drawn SVG cover art for catalog games that have no cover in `src/data/catalog.json`
 * (an empty `cover`), then points each of them at the new file in the catalog.
 *
 * The art is generated from scratch — no AI. Each cover is a retro game-cover plate: a gradient
 * field with a translucent emblem, a few accent marks and the game's title. Colors and shapes are
 * derived deterministically from the game id, so the same catalog always yields the same files.
 *
 * Usage: node scripts/artwork/build-missing-covers.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CATALOG = resolve(ROOT, "src/data/catalog.json");
const OUT_DIR = resolve(ROOT, "public/assets/covers");
const COVER_RATIO = 0.75;

/** FNV-1a string hash: small, fast, good enough for deriving per-cover variation. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h;
}
/** Deterministic 0..1 in [0, 1) from a string, e.g. derived variation per cover. */
function rnd(seed, salt = "") {
  let h = hash(`${seed}${salt}`);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; };
}
function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length] ?? arr[0]; }
function xml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/** Shortest string still readable on a cover: 28 characters plus an ellipsis. */
function short(s, max = 28) {
  const t = String(s).trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Hand-drawn cover palettes: deep gradients, an emblem color and the ink used for titles. */
const PALETTES = [
  { start: "#1a2b0f", mid: "#0d2212", end: "#050c04", accent: "#3aff78", ink: "#f2f6d4", ground: "#14220a" },
  { start: "#1f1430", mid: "#180c26", end: "#0a0612", accent: "#b39dff", ink: "#f2f0ff", ground: "#1a1028" },
  { start: "#3b1710", mid: "#24100a", end: "#110702", accent: "#ff5b3a", ink: "#fff2e3", ground: "#28120a" },
  { start: "#0d2f38", mid: "#0c2933", end: "#021218", accent: "#7fd8ff", ink: "#eef8ff", ground: "#0a2530" },
  { start: "#2b2210", mid: "#221908", end: "#081007", accent: "#ffd100", ink: "#fffaf0", ground: "#1c1705" },
  { start: "#30132b", mid: "#230b1f", end: "#0c0710", accent: "#ff8fc4", ink: "#ffeef7", ground: "#23102d" },
  { start: "#1f2d13", mid: "#172410", end: "#0a1208", accent: "#a8e30d", ink: "#f8f9e8", ground: "#152009" },
  { start: "#161a22", mid: "#12151d", end: "#06080d", accent: "#d8d9e0", ink: "#fafbfd", ground: "#0e1117" },
];
const GLYPHS = {
  star: `<path d="M8 0 L10 5 L14 6 L11 9 L12 13 L8 11 L4 13 L5 9 L2 6 L6 5 Z" fill="{acc}" fill-opacity="{op}"/>`,
  bolt: `<path d="M20 0 L3 9 L14 9 L1 17 L16 17 L6 26 L22 10 Z" fill="{acc}" fill-opacity="{op}"/>`,
  cube: `<path d="M1 8 L15 0 L29 8 L15 16 Z" fill="{acc}" fill-opacity="{op}" stroke="{acc}" stroke-width="0.8"/>`,
  disk: `<circle r="8" fill="{acc}" fill-opacity="{op}"/>`,
};

/** A couple of translucent accent marks across the lower field, each unique per cover. */
function accents(r, accent, startX = 0, startY = 340) {
  const count = 3 + Math.floor(r() * 3);
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = 8 + r() * 284;
    const y = startY + i * 22 + r() * 30;
    const w = 6 + r() * 26;
    if (y > 398) break;
    out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(w * 0.5).toFixed(1)}" fill="${accent}" fill-opacity="${(0.05 + r() * 0.08).toFixed(2)}" rx="1"/>`);
  }
  return out.join("");
}

/** The central emblem, unique per cover. */
function emblem(r, accent) {
  const shapes = [
    `<circle r="70" fill="none" stroke="${accent}" stroke-width="7" stroke-opacity="${(0.2 + r() * 0.3).toFixed(2)}"/>`,
    `<circle r="42" fill="none" stroke="${accent}" stroke-width="7"/>`,
    `<circle r="10" fill="${accent}"/>`,
  ];
  const glyph = pick(r, Object.values(GLYPHS)).replaceAll("{acc}", accent).replaceAll("{op}", (0.6 + r() * 0.4).toFixed(2));
  return `<g transform="translate(150,170)">${shapes.join("")}${glyph}</g>`;
}

/** Cover plate for one catalog game: deterministic from the game id. */
export function svgCover(game) {
  const r = rnd(game.id, "cover");
  const p = pick(r, PALETTES);
  const accent = p.accent;
  const t = game.title;
  const line2 = [game.platform, game.year ? String(game.year) : ""].filter(Boolean).join(" · ");
  const title = short(t, 26);
  const subtitle = short(line2 || t, 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" role="img" aria-label="${xml(t)} cover art">
  <title>${xml(t)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.start}"/>
      <stop offset="0.5" stop-color="${p.mid}"/>
      <stop offset="1" stop-color="${p.end}"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.ground}" stop-opacity="0"/>
      <stop offset="1" stop-color="${p.ground}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#bg)"/>
  <g fill="none" stroke="#fff" stroke-opacity="0.06" stroke-width="0.7">
    <line x1="0" y1="390" x2="300" y2="390"/><line x1="30" y1="385" x2="270" y2="385"/>
  </g>
  <rect y="350" width="300" height="50" fill="url(#ground)"/>
  ${emblem(r, accent)}
  ${accents(r, accent, 0, 366).replaceAll("{acc}", accent)}
  <text x="150" y="312" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="28" font-weight="900" fill="${p.ink}" letter-spacing="0.5">${xml(title)}</text>
  <text x="150" y="340" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" font-weight="600" fill="${p.ink}" fill-opacity="0.85" letter-spacing="0.8">${xml(subtitle)}</text>
  <g fill="#fff" opacity="0.35"><circle cx="28" cy="58" r="1.2"/><circle cx="214" cy="92" r="1.4"/><circle cx="76" cy="160" r="0.9"/><circle cx="264" cy="196" r="1.3"/><circle cx="88" cy="282" r="1.1"/><circle cx="248" cy="314" r="0.8"/><circle cx="122" cy="386" r="1.0"/><circle cx="194" cy="40" r="0.7"/></g>
</svg>`;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const missing = catalog.games.filter((g) => !g.cover || !String(g.cover).trim());
  if (!missing.length) {
    console.log(`covers: ${catalog.games.length} games, none missing`);
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });
  let written = 0;
  for (const game of missing) {
    const name = `${game.id}.svg`;
    const file = resolve(OUT_DIR, name);
    await writeFile(file, svgCover(game));
    game.cover = `/assets/covers/${name}`;
    game.coverRatio = COVER_RATIO;
    written++;
  }
  await writeFile(CATALOG, `${JSON.stringify(catalog)}\n`);
  console.log(`covers: wrote ${written} SVG covers to ${OUT_DIR}; catalog updated (${catalog.games.length} games, ${catalog.games.filter((g) => g.cover).length} with covers)`);
  for (const game of missing) console.log(`  ${game.id} -> /assets/covers/${game.id}.svg`);
  // Sanity: every written file exists.
  for (const game of missing) if (!existsSync(resolve(OUT_DIR, `${game.id}.svg`))) throw new Error(`missing output for ${game.id}`);
}

await main();
