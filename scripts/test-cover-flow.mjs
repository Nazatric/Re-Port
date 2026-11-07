#!/usr/bin/env node
// Run against Vite: BASE=http://127.0.0.1:5173 node scripts/test-cover-flow.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:5173';
const isWebKit = process.env.BROWSER === 'webkit';
const browser = await (isWebKit ? webkit : chromium).launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let checks = 0;
const check = (label, condition, detail = '') => {
  assert.ok(condition, `${label}: ${detail}`);
  console.log(`PASS ${label}`);
  checks++;
};
const selected = () => page.locator('.coverflow').getAttribute('data-selected').then(Number);
const next = () => page.getByRole('button', { name: 'Next featured port' });
const previous = () => page.getByRole('button', { name: 'Previous featured port' });

async function settled(expected) {
  await page.waitForFunction((expectedIndex) => {
    const root = document.querySelector('.coverflow');
    const viewport = root?.querySelector('.coverflow-viewport');
    const active = root?.querySelector('.coverflow-cover[data-active="true"]');
    if (!root || !viewport || !active || viewport.dataset.scrolling === 'true') return false;
    const v = viewport.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    return root.dataset.selected === root.dataset.settled &&
      (expectedIndex === null || Number(root.dataset.selected) === expectedIndex) &&
      Math.abs(a.x + a.width / 2 - (v.x + v.width / 2)) < 1.5;
  }, expected ?? null, { timeout: 8000 });
}

async function layout(label) {
  const value = await page.evaluate(() => {
    const box = (s) => document.querySelector(s).getBoundingClientRect();
    const stage = box('.coverflow-viewport');
    const cover = box('.coverflow-cover[data-active="true"]');
    const caption = box('.coverflow-caption');
    const actions = box('.coverflow-actions');
    const activeTitle = document.querySelector('.coverflow-caption-item[data-active="true"] .coverflow-title');
    return {
      centered: Math.abs(cover.x + cover.width / 2 - (stage.x + stage.width / 2)) < 1.5,
      coverInside: cover.top >= stage.top && cover.bottom <= stage.bottom,
      separateCaption: caption.top >= stage.bottom - 1,
      separateButtons: actions.top >= caption.bottom + 6,
      noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      noClippedTitle: activeTitle.scrollHeight <= activeTitle.clientHeight + 1,
      oneTabStop: document.querySelectorAll('.coverflow-cover[tabindex="0"]').length === 1,
      oneCaption: document.querySelectorAll('.coverflow-caption-item[data-active="true"]').length === 1,
      buttonTargets: [...document.querySelectorAll('.coverflow-actions > *')].every((e) => e.getBoundingClientRect().width >= 44 && e.getBoundingClientRect().height >= 44),
      buttonTop: actions.top,
    };
  });
  check(`${label}: centered, readable and non-overlapping`, Object.entries(value).filter(([k]) => k !== 'buttonTop').every(([, v]) => v === true), JSON.stringify(value));
  return value;
}

async function key(keyName) {
  await page.locator('.coverflow-viewport').focus();
  await page.keyboard.press(keyName);
}

const session = isWebKit ? null : await context.newCDPSession(page);
async function swipe({ dx = 0, dy = 0, cancel = false, duration = 280 }) {
  assert.ok(session, 'Real touch injection requires Chromium');
  const r = await page.locator('.coverflow-viewport').boundingBox();
  const x = Math.max(40, Math.min(350, r.x + r.width / 2 + (dx < 0 ? 65 : dx > 0 ? -65 : 0)));
  const y = r.y + r.height / 2;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12, id: 1 }] });
    await page.waitForTimeout(duration / 12);
  }
  await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
}

try {
  await page.goto(`${BASE}/tests/cover-flow.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.coverFlowFixture));
  await settled(0);
  await layout('Initial mobile layout');
  await page.waitForFunction(() => {
    const img = document.querySelector('.coverflow-cover[data-active="true"] img');
    return img?.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === '1';
  });
  check('Cached artwork is visible rather than stuck transparent', true);
  check('No Swiper or duplicate slides', await page.locator('.swiper').count() === 0 && await page.locator('.coverflow-slide').count() === 12);
  check('Previous is truly disabled at the beginning', await previous().isDisabled());

  const firstLayout = await layout('Short title');
  await next().click();
  await settled(1);
  const secondLayout = await layout('Long title');
  check('Caption and controls never jump between titles', Math.abs(firstLayout.buttonTop - secondLayout.buttonTop) < 1);
  check('View details matches the selected artwork', await page.locator('.coverflow-details').getAttribute('href') === '#/game/test-1');
  await page.evaluate(() => window.coverFlowFixture.rerender());
  await settled(1);
  check('Same items in a new array preserve selection', await selected() === 1);
  await page.locator('.coverflow').evaluate((e) => { e.style.display = 'none'; });
  await page.waitForTimeout(100);
  await page.locator('.coverflow').evaluate((e) => { e.style.display = ''; });
  await settled(1);
  check('Hiding and restoring the carousel preserves selection', await selected() === 1);

  await page.evaluate(() => { const nextButton = document.querySelector('button[aria-label="Next featured port"]'); for (let i = 0; i < 5; i++) nextButton.click(); });
  await settled(6);
  await layout('Five rapid next taps');
  await page.evaluate(() => { const prev = document.querySelector('button[aria-label="Previous featured port"]'); for (let i = 0; i < 3; i++) prev.click(); });
  await settled(3);
  await layout('Three rapid previous taps');

  await key('End');
  await settled(11);
  check('Next is disabled at the last cover', await next().isDisabled());
  await key('ArrowRight');
  await settled(11);
  await key('Home');
  await settled(0);
  await key('ArrowLeft');
  await settled(0);
  check('End boundaries do not wrap, clone or leave empty space', true);

  if (session) {
    await page.evaluate(() => scrollTo(0, 0));
    await swipe({ dx: -180 });
    await settled();
    check('Real touch swipe advances and snaps', await selected() > 0);
    await layout('After left touch swipe');
    const beforeReverse = await selected();
    await swipe({ dx: 180 });
    await settled();
    check('Reverse swipe moves back without opening a game', await selected() < beforeReverse && !page.url().includes('#/game/'));

    await key('Home');
    await settled(0);
    await page.evaluate(() => scrollTo(0, 0));
    await swipe({ dy: -130 });
    check('Vertical swipes over artwork still scroll the page', await page.evaluate(() => scrollY) > 35);
    check('Vertical swipes do not change the selected cover', await selected() === 0);
    await page.evaluate(() => scrollTo(0, 0));
    await swipe({ dx: -110, cancel: true });
    await settled();
    await next().click();
    await settled();
    check('Cancelled gestures leave controls usable', await selected() > 0);
  } else {
    console.log('SKIP native touch injection in WebKit; exercised in the Chromium run.');
  }

  await page.evaluate(() => window.coverFlowFixture.motion('reduce'));
  await key('Home');
  await settled(0);
  check('Reduced motion removes 3D transforms', await page.locator('.coverflow-cover').evaluateAll((els) => els.every((e) => getComputedStyle(e).transform === 'none')));
  await next().click();
  await settled(1);
  check('Reduced motion still permits navigation', await selected() === 1);
  await page.evaluate(() => window.coverFlowFixture.motion('full'));

  for (const [w, h] of [[280, 640], [320, 640], [360, 780], [412, 915], [844, 390], [768, 1024], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await settled(1);
    await layout(`Resize ${w}x${h}`);
  }

  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '125%'; window.coverFlowFixture.longTitle(); });
  await settled(1);
  await layout('Large text and an unusually long title');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

  await page.setViewportSize({ width: 1024, height: 800 });
  await key('Home');
  await settled(0);
  await page.evaluate(() => scrollTo(0, 0));
  let box = await page.locator('.coverflow-cover[data-active="true"]').boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8 - 225, box.y + box.height / 2, { steps: 16 });
  await page.mouse.up();
  await settled(1);
  check('Mouse drag advances without activating its link', !page.url().includes('#/game/'));
  await layout('After mouse drag');

  if (!isWebKit) {
    const beforeWheel = await selected();
    await page.mouse.move(512, box.y + box.height / 2);
    await page.mouse.wheel(300, 0);
    await page.waitForTimeout(700);
    await settled();
    check('Horizontal trackpad scrolling snaps to a cover', await selected() > beforeWheel);
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(300);
    check('Vertical wheel is not hijacked by the carousel', await page.evaluate(() => scrollY) > 60);
    await page.evaluate(() => scrollTo(0, 0));
  } else {
    console.log('SKIP wheel injection in mobile WebKit; exercised in the Chromium run.');
  }

  const activeBeforeClick = await selected();
  box = await page.locator('.coverflow-cover').nth(activeBeforeClick + 1).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settled(activeBeforeClick + 1);
  check('Tapping a neighboring cover selects it first', !page.url().includes('#/game/'));
  await page.waitForTimeout(450);
  await page.locator('.coverflow-cover[data-active="true"]').click();
  check('A separate tap opens the centered game', page.url().endsWith(`#/game/test-${activeBeforeClick + 1}`));

  await page.evaluate(() => window.coverFlowFixture.duplicates());
  await page.waitForFunction(() => document.querySelectorAll('.coverflow-slide').length === 12);
  check('Repeated game IDs do not create duplicate covers', await page.locator('.coverflow-slide').count() === 12);
  await page.evaluate(() => window.coverFlowFixture.count(1));
  await page.waitForFunction(() => document.querySelectorAll('.coverflow-slide').length === 1);
  await settled(0);
  check('One game: both arrows disabled', await previous().isDisabled() && await next().isDisabled());
  await layout('Single cover');
  await page.evaluate(() => window.coverFlowFixture.count(0));
  await page.waitForSelector('.coverflow', { state: 'detached' });
  check('Zero games render no broken carousel', await page.locator('.coverflow').count() === 0);
  await page.evaluate(() => window.coverFlowFixture.count(12));
  await page.waitForFunction(() => document.querySelectorAll('.coverflow-slide').length === 12);
  await settled(0);
  await page.locator('#other-input').focus();
  await page.keyboard.press('ArrowRight');
  check('Keyboard shortcuts are scoped to the carousel', await selected() === 0);

  // Check the actual app, including the fixed navigation and header, not only an isolated fixture.
  fs.mkdirSync('.shots', { recursive: true });
  for (const theme of ['azure', 'graphite', 'lime']) {
    await page.evaluate((theme) => localStorage.setItem('portdeck.settings.v1', JSON.stringify({ theme })), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/#/`, { waitUntil: 'load' });
    await settled(0);
    await page.waitForTimeout(450);
    await layout(`App ${theme} theme`);
    await page.locator('.coverflow-footer').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(200);
    const reachable = await page.locator('.coverflow-actions > *').evaluateAll((els) => els.filter((e) => !e.disabled).every((e) => {
      const r = e.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit && e.contains(hit);
    }));
    check(`${theme}: navigation does not block the scrolled-to controls`, reachable);
    await page.screenshot({ path: `.shots/coverflow-${theme}.png` });
  }

  check('No uncaught browser errors', errors.length === 0, errors.join('\n'));
  console.log(`\n${checks} cover-flow checks passed.`);
} catch (error) {
  fs.mkdirSync('.shots', { recursive: true });
  await page.screenshot({ path: '.shots/coverflow-failure.png' });
  console.error(await page.evaluate(() => ({
    selected: document.querySelector('.coverflow')?.getAttribute('data-selected'),
    settled: document.querySelector('.coverflow')?.getAttribute('data-settled'),
    scrollLeft: document.querySelector('.coverflow-viewport')?.scrollLeft,
    scrolling: document.querySelector('.coverflow-viewport')?.getAttribute('data-scrolling'),
  })));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}