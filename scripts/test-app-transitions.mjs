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

  // Narrow phones and enlarged text must not let long port/release content widen the page.
  for (const width of [320, 360, 390]) {
    for (const text of [0, 2]) {
      const mobile = await browser.newContext({ viewport: { width, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      await mobile.addInitScript((text) => localStorage.setItem('portdeck.settings.v1', JSON.stringify({ text, theme: 'azure' })), text);
      await mobile.route('https://api.github.com/repos/**', (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({
          tag_name: 'v1', name: 'An exceptionally long release name that must fit within the screen',
          assets: [{ name: 'VeryLongAndroidPackageNameThatMustBeTruncatedWithoutWideningThePage'.repeat(3) + '.apk', size: 123456, browser_download_url: 'https://github.com/test/release' }],
        }),
      }));
      const phone = await mobile.newPage();
      for (const game of ['the-legend-of-zelda-link-s-awakening', 'the-legend-of-zelda-tears-of-the-kingdom']) {
        await phone.goto(`${url}#/game/${game}`);
        await phone.waitForSelector('#ports article');
        await phone.waitForSelector('[aria-label="Android packages in this release"]');
        await phone.evaluate(() => window.scrollTo(1000, 0));
        assert.equal(await phone.evaluate(() => window.scrollX), 0, `The document must not scroll sideways at ${width}px, text ${text}`);
        for (const selector of ['#ports article', '#ports article .btn-a', '[aria-label="Latest release on GitHub"]', '.dock-inner']) {
          const nodes = phone.locator(selector);
          for (let i = 0; i < await nodes.count(); i++) {
            const el = nodes.nth(i);
            const rect = await el.evaluate((node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right }; });
            assert.ok(rect.left >= -0.5 && rect.right <= width + 0.5, `${selector} must fit within ${width}px at text ${text}: ${JSON.stringify(rect)}`);
          }
        }
        const download = phone.locator('#ports article .btn-a').first();
        await download.scrollIntoViewIfNeeded();
        assert.ok(await download.evaluate((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === el || el.contains(hit); }), 'Port download should not be obstructed');
      }
      await mobile.close();
    }
  }

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
