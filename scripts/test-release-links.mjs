import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { games, primaryPort, rankedPortIndices } = await server.ssrLoadModule('/src/data/ports.ts');
  const { downloadDestination } = await server.ssrLoadModule('/src/lib/download.ts');
  for (const game of games) {
    const indices = rankedPortIndices(game);
    assert.equal(indices.length, game.ports.length, `${game.title}: no ports lost`);
    assert.equal(new Set(indices).size, game.ports.length, `${game.title}: no duplicates`);
    for (let i = 1; i < indices.length; i++) {
      const prev = game.ports[indices[i - 1]];
      const cur = game.ports[indices[i]];
      assert.ok(!cur.pinned || prev.pinned, `${game.title}: pinned ports come first`);
      if (!!prev.pinned === !!cur.pinned) assert.ok((prev.downloads || 0) >= (cur.downloads || 0), `${game.title}: descending downloads`);
    }
    if (indices.length) assert.equal(primaryPort(game), game.ports[indices[0]]);
  }
  const prototype = games.find((g) => g.id === 'prototype');
  assert.equal(primaryPort(prototype).name, 'ProtoDroid', 'ProtoDroid is the main Prototype port');
  assert.equal(primaryPort(prototype).url, 'https://github.com/Nazatric/ProtoDroid');
  const morrowind = games.find((g) => g.id === 'the-elder-scrolls-iii-morrowind');
  assert.equal(primaryPort(morrowind).name, 'Morrowind (OpenMW)');
  assert.equal(downloadDestination(primaryPort(morrowind)), 'https://github.com/xyzz/openmw-android/releases');
  const port = { ...primaryPort(morrowind), version: '1.0', url: 'https://github.com/example/repo', download: 'https://github.com/example/repo/releases/tag/old' };
  assert.equal(downloadDestination(port), 'https://github.com/example/repo/releases/latest');
  assert.equal(downloadDestination({ ...port, version: 'v2-beta' }), 'https://github.com/example/repo/releases');
  assert.equal(downloadDestination({ ...port, version: 'v2', download: 'https://github.com/example/repo/releases/tag/v2-rc1' }), 'https://github.com/example/repo/releases');
  assert.equal(downloadDestination({ ...port, download: 'https://t.me/example' }), 'https://t.me/example');
  assert.equal(downloadDestination({ ...port, apk: false, download: 'https://github.com/example/repo' }), 'https://github.com/example/repo');
  assert.equal(downloadDestination({ ...port, download: 'https://github.com.attacker.example/owner/repo' }), 'https://github.com.attacker.example/owner/repo');
  console.log(`Release destinations and download rankings checked for ${games.length} games.`);
} finally {
  await server.close();
}
