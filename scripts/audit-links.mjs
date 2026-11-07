#!/usr/bin/env node
/**
 * Checks that release links in the catalog still exist.
 *   - GitHub: HEAD <repo>/releases/latest. A redirect means the repo exists, 404 means it is gone.
 *   - Google Play, itch.io, GitLab, F-Droid: HEAD request, 404/410 means removed.
 * Results go to data/source/link-audit.json. build-data.mjs drops ports whose link is confirmed dead.
 *
 * Usage: node scripts/audit-links.mjs [--all]   (default: only URLs not audited before)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog.json'), 'utf8'));
const OUT = path.join(ROOT, 'data/source/link-audit.json');
const audit = fs.existsSync(OUT) && !process.argv.includes('--all') ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const CHECKED = new Set(['github', 'playstore', 'itch', 'gitlab', 'fdroid']);
const urls = [...new Set(catalog.games.flatMap((g) => g.ports.filter((p) => CHECKED.has(p.kind)).map((p) => p.download)))].filter((u) => !(u in audit));
console.log('urls to check:', urls.length);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function check(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 PortDeckLinkAudit' }, signal: AbortSignal.timeout(20000) });
      if (res.status === 429) {
        await sleep(8000 * (attempt + 1));
        continue;
      }
      return res.status;
    } catch {
      await sleep(1000);
    }
  }
  return 0;
}

let i = 0;
let done = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    audit[u] = await check(u);
    if (++done % 50 === 0) {
      fs.writeFileSync(OUT, JSON.stringify(audit));
      console.log(`${done}/${urls.length}`);
    }
    await sleep(120);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(OUT, JSON.stringify(audit));
const bad = Object.entries(audit).filter(([, s]) => s === 404 || s === 410);
console.log(`audited ${Object.keys(audit).length}, dead ${bad.length}`);
bad.slice(0, 60).forEach(([u, s]) => console.log(s, u));
