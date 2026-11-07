import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { githubRepo, isAndroidPackage, nonAndroidLink, explicitAndroidTarget, documentedEvidence, openPortsEvidence, rankPorts, readmeAndroidLine } from './android-policy.mjs';
import { androidListRows } from './android-list.mjs';
import { normalizeDiscovery } from './discovery-lists.mjs';

test('CPU architecture, iOS and OBB alone are not Android port evidence', () => {
  assert.equal(isAndroidPackage('game.obb'), false);
  assert.equal(isAndroidPackage('game.arm64.zip'), false);
  assert.equal(isAndroidPackage('Game.APK'), true);
  assert.equal(isAndroidPackage('game.apks'), true);
  assert.equal(explicitAndroidTarget('Native ARM64 build for Windows'), false);
  assert.equal(explicitAndroidTarget('PC port of the Android version'), false);
  assert.equal(nonAndroidLink('https://apps.apple.com/app/id123'), true);
  assert.equal(nonAndroidLink('https://github.com/example/foo/releases/download/v1/game.ipa'), true);
  assert.equal(nonAndroidLink('https://github.com/example/foo-ios'), true);
  assert.equal(nonAndroidLink('https://dos.zone/game'), true);
});

test('mixed platform projects need the Android target and independent evidence', () => {
  const url = 'https://github.com/owner/project';
  const evidence = { 'owner/project': { apkEvidenceVersion: 1, hasApk: true, apkAssets: 1 } };
  assert.equal(githubRepo(`${url}/releases/tag/v1`), 'owner/project');
  assert.equal(openPortsEvidence({ sources: [url], platforms: ['windows', 'ios'] }, evidence), '');
  assert.equal(openPortsEvidence({ sources: [url], platforms: ['windows', 'android'] }, {}), '');
  assert.equal(openPortsEvidence({ sources: [url], platforms: ['windows', 'android'] }, evidence), 'github-apk');
  assert.equal(openPortsEvidence({ sources: [url], platforms: ['windows', 'android'], notes: 'Android port is planned' }, evidence), '');
  assert.equal(documentedEvidence({ url, text: 'Android port', repoEvidence: {} }), '');
  assert.equal(documentedEvidence({ url, repoEvidence: { 'owner/project': { hasApk: true, apkAssets: 1 } } }), ''); // old OBB-inclusive cache
  assert.equal(documentedEvidence({ url, repoEvidence: { 'owner/project': { androidReadme: true } } }), 'github-readme');
});

test('README evidence excludes desktop ports, emulation, external forks and unavailable builds', () => {
  const check = (text) => readmeAndroidLine(Buffer.from(text).toString('base64'), 'owner/project');
  assert.ok(check('# Game port for Android\nInstall the Android APK.'));
  assert.equal(check('To play on Android you will need the 1oom executable for MSDOS,\nDOSBox application for Android'), '');
  assert.equal(check('Optional: place your own Android version data file (.obb) here'), '');
  assert.equal(check('For optional assets place your own LCS Android 2.4.379 APK at the input directory'), '');
  assert.equal(check('There is an Android port\nAnother fork has it https://github.com/other/android'), '');
  assert.equal(check('The Android target is ARM64. Android and Linux builds not yet public'), '');
  assert.equal(check('Ports for Android, PS5 and Linux are in development.\nThese developments are not included in the current public version.'), '');
  assert.equal(check('- [ ] Port the runtime to Android'), '');
  assert.equal(check('# Android port\nThis project is not playable yet.'), '');
  assert.equal(check('# Android research\nSuccessful code generation and execution on Android have not yet been demonstrated.'), '');
  assert.equal(check('<a href="https://github.com/other/port"><img alt="Also on Android: Build the APK from source."></a>'), '');
  assert.equal(check('[other/port](https://github.com/other/port): Android version'), '');
});

test('ranked primary and sibling metadata refer to the same ports', () => {
  const original = [{ url: 'https://github.com/a/low', title: 'Low', downloads: 1 }, { url: 'https://github.com/a/high', title: 'High', downloads: 100 }];
  const ordered = rankPorts(original);
  assert.equal(ordered[0].url, 'https://github.com/a/high');
  assert.equal(ordered[0].title, 'High');
  assert.equal(ordered[1].url, 'https://github.com/a/low');
  assert.equal(original[0].title, 'Low');
});

test('Android list parser ignores tools, headings and generic multi-game engines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'android-list-'));
  try {
    const file = path.join(dir, 'list.md');
    fs.writeFileSync(file, '## Games\n| [Game (Project)](https://github.com/a/b) | Android build | Author |\n| [Classic adventure games](https://github.com/a/engine) | Android engine | Author |\n## Tools & Frameworks\n| [Tool](https://github.com/a/tool) | Android tool | Author |\n');
    assert.deepEqual(androidListRows(file).map(({ title, project }) => [title, project]), [['Game', 'Project']]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('additional lists are discovery only, normalize factual URLs and filter desktop targets', () => {
  const rows = normalizeDiscovery('porting-room', { games: [{ name: 'A game', ports: [
    { name: 'PC', platform: 'Windows / Linux', url: 'https://github.com/test/desktop' },
    { name: 'Mobile', platform: 'Windows / Android', url: 'https://github.com/test/mobile/releases' },
  ] }] });
  assert.deepEqual(rows.map((r) => r.url), ['https://github.com/test/mobile']);
  assert.equal(documentedEvidence({ url: rows[0].url, repoEvidence: {} }), '');
  const flagged = normalizeDiscovery('porthub', { games: [{ title: 'False Android flag', android: { supported: true }, links: { repo: 'https://github.com/test/desktop' } }] });
  assert.equal(flagged.length, 1);
  assert.equal(documentedEvidence({ url: flagged[0].url, repoEvidence: {} }), '');
  assert.equal(nonAndroidLink('https://github.com/Nyaldee/Ports-Launcher'), true);
  assert.equal(nonAndroidLink('https://github.com/katotekiru/bfme1-mobile'), true);
});

test('shipped catalog records evidence per port and rejects known desktop/iOS regressions', () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
  assert.equal(catalog.androidPolicy, 1);
  const blocked = ['koreanseats1/theft4', 'chrissotraidis/ottsel', 'chrissotraidis/projectreach', 'koreanseats1/mcla-4ios', 'bep1s69/nfsmw-ios', 'official-kryo-to/ctw-native', '1oom-fork/1oom'];
  const valid = new Set(['napl-list', 'github-apk', 'github-readme', 'openports-android', 'source-android']);
  for (const game of catalog.games) for (const p of game.ports) {
    assert.ok(valid.has(p.androidEvidence), `${game.title}: ${p.url}`);
    assert.ok(!nonAndroidLink(p.url), `${game.title}: ${p.url}`);
    assert.ok(!blocked.includes(githubRepo(p.url)), `${game.title}: ${p.url}`);
  }
  assert.ok(!catalog.games.some(g => g.title === 'Lost' && g.ports.some(p => githubRepo(p.url) === 'dogparty/ipodclickwheelrecomps')));
  assert.ok(catalog.games.some(g => g.title === 'Mini Golf' && g.ports.some(p => githubRepo(p.url) === 'dogparty/ipodclickwheelrecomps')));
  assert.equal(catalog.games.filter(g => g.title === 'God of War II').length, 1);
  assert.equal(catalog.games.filter(g => g.title === 'Carmageddon').length, 1);
  assert.equal(catalog.games.filter(g => g.title === 'Castlevania: Symphony of the Night').length, 1);
  const wanted = catalog.games.filter(g => /need for speed.*most wanted/i.test(g.title));
  assert.ok(wanted.filter(g => g.year === 2005).length <= 1); // variants of the 2005 game are one card
  assert.ok(wanted.filter(g => /2012\)$/.test(g.title)).every(g => g.year === 2012));
});
