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
  assert.equal(APP_VERSION, '1.0.0');
  assert.equal(RELEASES_URL, 'https://github.com/Nazatric/Re-Port/releases/latest');

  const respond = (body, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await checkForUpdate(respond({ tag_name: 'v1.1.0' })), { status: 'new', version: '1.1.0' });
  assert.deepEqual(await checkForUpdate(respond({ tag_name: 'v1.0.0' })), { status: 'current', version: '1.0.0' });
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
  console.log(`Update, catalog and metrics checks passed for ${games.length} games.`);
} finally {
  await server.close();
}
