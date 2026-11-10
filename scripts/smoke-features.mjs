import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { compareVersions, checkForUpdate, APP_VERSION, RELEASES_URL } = await server.ssrLoadModule('/src/lib/update.ts');
  const { games, applyFilters, activeFilterCount, emptyFilters } = await server.ssrLoadModule('/src/data/ports.ts');

  // Semver handling: v-prefix accepted; prereleases and malformed tags are not treated as stable updates.
  assert.equal(compareVersions('v1.0.1', '1.0.0'), 1);
  assert.equal(compareVersions('1.0.0', 'v1.0.0'), 0);
  assert.equal(compareVersions('0.9.9', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), null);
  assert.equal(compareVersions('latest', '1.0.0'), null);
  assert.equal(compareVersions('1.10.0', '1.9.0'), 1);
  assert.equal(APP_VERSION, '1.1.0');
  assert.equal(RELEASES_URL, 'https://github.com/Nazatric/Re-Port/releases/latest');

  const respond = (body, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await checkForUpdate(respond({ tag_name: 'v1.2.0' })), { status: 'new', version: '1.2.0' });
  assert.deepEqual(await checkForUpdate(respond({ tag_name: 'v1.1.0' })), { status: 'current', version: '1.1.0' });
  assert.deepEqual(await checkForUpdate(respond({ tag_name: 'v1.0.0-rc1' })), { status: 'error' });
  assert.deepEqual(await checkForUpdate(respond({ message: 'rate limited' }, 403)), { status: 'error' });
  assert.deepEqual(await checkForUpdate(respond(null)), { status: 'error' });
  assert.deepEqual(await checkForUpdate(async () => { throw new TypeError('offline'); }), { status: 'error' });

  // Catalog data: no store prices and no unverifiable bundled views remain.
  for (const game of games) {
    assert.equal('price' in game, false, `${game.id} has no price`);
    assert.equal('views' in game, false, `${game.id} has no bundled views`);
  }

  // Local-view sorting and filter counting.
  const saved = new Set();
  const localViews = { 'pokewilds': 5, 'bounce-classic': 9 };
  const byViews = applyFilters({ ...emptyFilters, sort: 'popular' }, saved, localViews);
  assert.equal(byViews[0].id, 'bounce-classic');
  assert.equal(byViews[1].id, 'pokewilds');
  assert.equal(activeFilterCount({ ...emptyFilters, onlyRated: true }), 1);
  assert.deepEqual(applyFilters({ ...emptyFilters, onlyViewed: true }, saved, localViews).map((g) => g.id).sort(), ['bounce-classic', 'pokewilds']);
  assert.ok(applyFilters({ ...emptyFilters, onlyRated: true }, saved).every((g) => g.metacritic != null));
  const tm = await import('./artwork/title-match.mjs');
  assert.equal(tm.normalizeTitle('Pokémon Shield!'), 'pokemon shield');
  assert.ok(tm.scoreCandidate('Doom', 'DOOM', { queryYear: 1993, candidateYear: 2016 }).score < 0.95, 'Steam DOOM (2016) must not match the 1993 game');
  assert.ok(tm.scoreCandidate('Doom', 'DOOM', { queryYear: 2016, candidateYear: 2016 }).score >= 0.95);
  assert.ok(tm.scoreCandidate('Doom II', 'Doom', {}).score < 0.95, 'sequels never match the original');
  assert.ok(tm.scoreCandidate('God of War II', 'God of War', {}).score < 0.95);
  assert.equal(tm.editionBase('Doom: Definitive Edition'), 'Doom');
  assert.equal(tm.confidentChoice([{ score: 0.97, n: 'a' }, { score: 0.96, n: 'b' }], { min: 0.95, gap: 0.1 }), null, 'ambiguous matches are refused');
  const { featuredForHour } = await server.ssrLoadModule('/src/data/ports.ts');
  const hourA = featuredForHour(480000);
  assert.equal(hourA.length, 8, 'cover flow shows 8 games');
  assert.deepEqual(featuredForHour(480000).map((g) => g.id), hourA.map((g) => g.id), 'stable within one hour');
  assert.notDeepEqual(featuredForHour(480001).map((g) => g.id), hourA.map((g) => g.id), 'changes at the next hour');
  assert.ok(hourA.every((g) => g.cover && g.ports.some((p) => p.apk)), 'every featured game has cover art and an APK port');
  const { makeT, languages } = await server.ssrLoadModule('/src/lib/i18n.ts');
  assert.equal(makeT('en')('Home'), 'Home');
  assert.equal(makeT('es')('Home'), 'Inicio');
  assert.equal(makeT('pt')('Recently added ports'), 'Ports adicionados recentemente');
  assert.equal(makeT('zh')('Settings'), '设置');
  assert.equal(makeT('hi')('Library'), 'लाइब्रेरी');
  for (const { id } of languages) assert.ok(makeT(id)('About'), `${id} has a fallback`);
  assert.equal(makeT('es')('Settings'), 'Ajustes');
  assert.equal(makeT('pt')('Browse'), 'Explorar');
  assert.equal(makeT('zh')('Filters'), '筛选');
  assert.equal(makeT('hi')('Recently viewed'), 'हाल में देखे गए');
  assert.equal(makeT('es')('{n} ports · no files needed', { n: 3 }), '3 ports · sin archivos necesarios');
  // Every key must have a real translation in each language, not just the English fallback.
  for (const id of ['beats-of-rage', 'doom', 'cannone']) {
    const game = games.find((g) => g.id === id);
    assert.equal(game.cover, '', `${id}: wrong cover removed`);
  }
  assert.equal(games.filter((g) => g.cover && /wikimedia/.test(g.cover) && /Comic_Con|galley/.test(g.cover)).length, 0, 'no unrelated photos in covers');
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
  const entries = [...src.matchAll(/^  ("(?:[^"\\]|\\.)*"): (\[.*\]),$/gm)].map((m) => [JSON.parse(m[1]), JSON.parse(m[2])]);
  assert.ok(entries.length > 150, 'translation table is populated');
  for (const [key, translations] of entries) {
    assert.equal(translations.length, 4, `"${key}" has es, pt, hi and zh`);
    for (const value of translations) assert.ok(value.trim().length > 0, `empty translation for "${key}"`);
  }
  console.log(`Update, catalog and metrics checks passed for ${games.length} games.`);
} finally {
  await server.close();
}
