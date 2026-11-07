#!/usr/bin/env node
/**
 * Fails a build that would ship a stale native app.
 *
 * This guards the exact regression users saw: an APK whose bundled library had fallen back to
 * the old sub-1,000 title catalog and whose home screen still used the old carousel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(ROOT, 'dist');
const catalogPath = path.join(dist, 'catalog.json');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(catalogPath) || !fs.existsSync(indexPath)) {
  throw new Error('dist/catalog.json and dist/index.html are required. Run npm run build first.');
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const games = catalog.stats?.games ?? catalog.games?.filter((g) => g.platform !== 'engine').length ?? 0;
const ports = catalog.stats?.ports ?? catalog.games?.reduce((sum, g) => sum + (g.ports?.length || 0), 0) ?? 0;

if (games < 200) throw new Error(`Catalog regression: only ${games} games.`);
if (ports < 200) throw new Error(`Catalog regression: only ${ports} ports.`);
if (catalog.androidPolicy !== 1) throw new Error('Missing Android-only policy marker');
const evidence = new Set(['napl-list', 'github-apk', 'github-readme', 'openports-android', 'source-android']);
for (const g of catalog.games) for (const p of g.ports) {
  if (!evidence.has(p.androidEvidence)) throw new Error(`Missing Android evidence: ${g.title} ${p.url}`);
}
if (!catalog.generated) throw new Error('Catalog regression: dist/catalog.json has no generated date.');
if (!catalog.revision) throw new Error('Catalog regression: dist/catalog.json has no revision.');

const html = fs.readFileSync(indexPath, 'utf8');
for (const needle of ['coverflow-viewport', 'coverflow-caption', 'coverflow-cover']) {
  if (!html.includes(needle)) throw new Error(`Build regression: dist/index.html does not contain ${needle}; the new cover flow is missing.`);
}
if (html.includes('swiper') || html.includes('Swiper')) {
  throw new Error('Build regression: dist/index.html still contains the old Swiper carousel.');
}

console.log(`Build verified: ${games} games, ${ports} ports, catalog ${catalog.generated} (${catalog.revision}), new cover flow present.`);
