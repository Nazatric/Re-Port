/**
 * Downloads the bundled artwork once, resizes it to WebP and stores it under public/art/,
 * so the app shows covers, heroes and screenshots from the APK itself (no waiting on remote hosts).
 * Files that already exist (restored from the CI cache) are reused, so repeat builds are fast.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

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

async function localize(root, url, file, width) {
  if (!isRemote(url)) return url;
  const abs = resolve(root, "public/art", file);
  const local = `/art/${file}`;
  if (existsSync(abs)) return local;
  const buf = await fetchBuffer(url);
  if (!buf) return url;
  try {
    await mkdir(dirname(abs), { recursive: true });
    await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(abs);
    return local;
  } catch {
    return url;
  }
}

/** Runs over every game in `out.games` (and catalog games with no bundle entry, for their cover).
 *  Mutates `out` so cover, hero and shots point at local files when they were downloaded. */
export async function localizeArt({ root, out, games, budgetMs = 12 * 60 * 1000, log = console.log }) {
  const started = Date.now();
  let done = 0, skipped = 0;
  const jobs = games.map((g) => async () => {
    if (Date.now() - started > budgetMs) { skipped++; return; }
    const e = out.games[g.id] ?? { hit: false };
    const coverSrc = e.cover || g.cover;
    const cover = await localize(root, coverSrc, `${g.id}/cover.webp`, 420);
    const hero = e.hero ? await localize(root, e.hero, `${g.id}/hero.webp`, 900) : undefined;
    const shotsSrc = [...(e.shots ?? []), ...(e.readmeShots ?? [])].slice(0, 4);
    const shots = [];
    for (let i = 0; i < shotsSrc.length; i++) shots.push(await localize(root, shotsSrc[i], `${g.id}/shot-${i}.webp`, 720));
    if (cover && cover !== coverSrc || hero || shots.length || e.hit) {
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
  // Eight parallel downloads keeps the step short without hammering the hosts.
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < jobs.length) await jobs[i++](); }));
  log(`local art: ${done} games processed, ${skipped} skipped for time budget`);
  return out;
}
