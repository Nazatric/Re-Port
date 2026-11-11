/**
 * Downloads the bundled artwork once, resizes it to WebP and writes it to .art-out/.
 * Images are NOT shipped inside the APK (that made the APK ~140 MB). They are published as
 * GitHub release assets by scripts/publish-art.mjs, and the bundle stores those URLs.
 * Files that already exist (restored from the CI cache) are reused, so repeat builds are fast.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { artUrl, artFileName } from "./art-hosting.mjs";

const UA = "Re-Port/1.2 (https://github.com/Nazatric/Re-Port; build-time catalog artwork)";
const isRemote = (u) => typeof u === "string" && /^https?:\/\//.test(u);

async function fetchBuffer(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404) return null;
      if (!res.ok) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      return Buffer.from(await res.arrayBuffer());
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

async function localize(outDir, url, name, width) {
  if (!isRemote(url)) return url;
  const abs = resolve(outDir, name);
  if (!existsSync(abs)) {
    const buf = await fetchBuffer(url);
    if (!buf) return url;
    try {
      await mkdir(outDir, { recursive: true });
      await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(abs);
    } catch {
      return url;
    }
  }
  return artUrl(name);
}

/** Runs over every catalog game. Mutates `out` so cover, hero and shots point at the hosted files. */
export async function localizeArt({ root, out, games, budgetMs = 12 * 60 * 1000, log = console.log }) {
  const outDir = resolve(root, ".art-out");
  const started = Date.now();
  let done = 0, skipped = 0;
  const jobs = games.map((g) => async () => {
    if (Date.now() - started > budgetMs) { skipped++; return; }
    const e = out.games[g.id] ?? { hit: false };
    const coverSrc = e.cover || g.cover;
    const cover = await localize(outDir, coverSrc, artFileName(g.id, "cover"), 420);
    const hero = e.hero ? await localize(outDir, e.hero, artFileName(g.id, "hero"), 800) : undefined;
    const shotsSrc = [...(e.shots ?? []), ...(e.readmeShots ?? [])].slice(0, 3);
    const shots = [];
    for (let i = 0; i < shotsSrc.length; i++) shots.push(await localize(outDir, shotsSrc[i], artFileName(g.id, `shot-${i}`), 640));
    if (cover !== coverSrc || hero !== e.hero || shots.length || e.hit) {
      out.games[g.id] = {
        ...e,
        hit: e.hit || !!cover,
        cover: cover || e.cover,
        hero: hero || e.hero,
        shots: shots.length ? shots : e.shots,
      };
    }
    done++;
  });
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < jobs.length) await jobs[i++](); }));
  log(`art: ${done} games processed, ${skipped} skipped for time budget`);
  return out;
}
