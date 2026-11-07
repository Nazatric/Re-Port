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
    await page.waitForTimeout(320);
  }
  assert.deepEqual(errors, [], 'Navigation should not cause browser errors');
  await context.close();

  const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const fallbackPage = await fallback.newPage();
  await fallbackPage.goto(url);
  assert.ok(await fallbackPage.locator('.boot-screen').isVisible(), 'The initial HTML should show the branded launch screen');
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
  console.log('Launch screen, app icon, navigation animations and reduced motion verified.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
