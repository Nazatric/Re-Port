#!/usr/bin/env node
// Smoke-test the built app using a system Chromium/Chrome. Set CHROMIUM_PATH if needed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 4274, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const url = 'http://127.0.0.1:4274/';
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page-title');
  assert.equal(await page.locator('#page-title').innerText(), 'Spotlight');
  assert.equal(await page.locator('.page-enter, .page-turn').count(), 0, 'The initial page must not fade in from blank');
  assert.equal(await page.locator('.dock a[aria-current="page"]').innerText(), 'Home');
  await page.waitForFunction(() => {
    const img = document.querySelector('.hero img[src*="header-logo"]');
    return img?.complete && img.naturalWidth > 0;
  });
  const logo = await page.locator('.hero img[src*="header-logo"]').evaluate((img) => ({ loaded: img.complete, width: img.naturalWidth }));
  assert.ok(logo.loaded && logo.width > 0, 'The in-app logo should load');

  for (const [tab, heading] of [['Library', 'Library'], ['Saved', 'Saved'], ['Home', 'Spotlight']]) {
    await page.locator('.dock a').filter({ hasText: tab }).click();
    await page.waitForSelector('.page-enter #page-title');
    assert.equal(await page.locator('#page-title').innerText(), heading);
    assert.equal(await page.locator('.page').evaluate((el) => getComputedStyle(el).animationName), 'page-arrive');
    assert.ok(parseFloat(await page.locator('.page').evaluate((el) => getComputedStyle(el).animationDuration)) >= 0.45, 'Page transitions should be unhurried');
    await page.waitForTimeout(520);
  }
  assert.deepEqual(errors, [], 'Navigation should not cause browser errors');
  await context.close();

  const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallbackPage = await fallback.newPage();
  await fallbackPage.goto(url);
  assert.ok(await fallbackPage.locator('.boot-shell').isVisible(), 'The initial HTML should show the app-shaped loading shell');
  assert.equal(await fallbackPage.locator('.boot-title').innerText(), 'Spotlight');
  assert.equal(await fallbackPage.locator('.boot-screen').count(), 0, 'There should be no full-screen logo splash');
  await fallback.close();

  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(url);
  await reducedPage.waitForSelector('#page-title');
  await reducedPage.locator('.dock a').filter({ hasText: 'Library' }).click();
  await reducedPage.waitForSelector('.page-enter #page-title');
  const duration = await reducedPage.locator('.page').evaluate((el) => getComputedStyle(el).animationDuration);
  assert.ok(parseFloat(duration) < 0.01, `Reduced motion should disable page animation, got ${duration}`);
  await reduced.close();

  // Exercise the Android bridge callback: modal dismissal, in-app history, then app exit.
  // This mocks the bridge; real edge-swipe recognition still needs an Android device.
  const native = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await native.addInitScript(() => {
    const callbacks = new Map();
    let nextId = 0;
    window.androidBridge = {};
    window.__nativeExits = 0;
    window.__fireBack = () => {
      for (const item of callbacks.values()) if (item.event === 'backButton') item.callback({ canGoBack: true });
    };
    window.__hasBackListener = () => [...callbacks.values()].some((item) => item.event === 'backButton');
    window.Capacitor = {
      PluginHeaders: [{ name: 'App', methods: [
        { name: 'addListener', rtype: 'callback' },
        { name: 'removeListener', rtype: 'promise' },
        { name: 'exitApp', rtype: 'promise' },
      ] }],
      nativeCallback: (_plugin, _method, options, callback) => {
        const id = String(++nextId);
        callbacks.set(id, { event: options.eventName, callback });
        return Promise.resolve(id);
      },
      nativePromise: (_plugin, method, options) => {
        if (method === 'removeListener') callbacks.delete(options.callbackId);
        if (method === 'exitApp') window.__nativeExits++;
        return Promise.resolve();
      },
    };
  });
  const nativePage = await native.newPage();
  await nativePage.goto(url);
  await nativePage.waitForSelector('#page-title');
  await nativePage.waitForFunction(() => window.__hasBackListener());
  await nativePage.locator('.dock a').filter({ hasText: 'Library' }).click();
  await nativePage.waitForSelector('.page-enter #page-title');
  await nativePage.locator('button[aria-haspopup="dialog"]').click();
  await nativePage.waitForSelector('[aria-modal="true"]');
  await nativePage.evaluate(() => window.__fireBack());
  await nativePage.waitForSelector('[aria-modal="true"]', { state: 'detached' });
  assert.equal(await nativePage.locator('#page-title').innerText(), 'Library', 'Back closes the dialog first');
  await nativePage.evaluate(() => window.__fireBack());
  await nativePage.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Spotlight');
  await nativePage.evaluate(() => window.__fireBack());
  await nativePage.waitForFunction(() => window.__nativeExits === 1);
  await native.close();
  console.log('App loading shell, icon, transitions, reduced motion and native back callback verified.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
