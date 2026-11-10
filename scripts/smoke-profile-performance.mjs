import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 4278, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route('https://**/*', (route) => route.fulfill({ status: 404 }));
  await context.addInitScript(() => localStorage.setItem('report:name', JSON.stringify('Player')));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4278/');
  await page.getByRole('button', { name: 'Select Ready to play' }).click();
  await page.getByRole('button', { name: 'Ready to play: See them' }).click();
  await page.getByPlaceholder('Games, port projects, engines, repos…').waitFor();
  await page.locator('nav').getByRole('button', { name: 'Settings' }).click();
  const gif = Buffer.from('R0lGODlhCAAIAPAAAP8AAAAAACH5BAA8AAAAIf8LTkVUU0NBUEUyLjADAQAAACwAAAAACAAIAAACB4SPqcvtXQAAIfkEADwAAAAsAAAAAAgACACAAAD/AAAAAgeEj6nL7V0AADs=', 'base64');
  await page.getByLabel('Upload profile picture').setInputFiles({ name: 'animated.gif', mimeType: 'image/gif', buffer: gif });
  const avatar = page.getByRole('button', { name: 'Change profile picture' }).locator('img');
  await avatar.waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('report:avatar') || '{}').imageUrl?.startsWith('avatar-blob:'));
  await page.waitForFunction(() => document.querySelector('[aria-label="Change profile picture"] img')?.src.startsWith('blob:'));
  const frames = new Set();
  for (let i = 0; i < 8; i++) {
    frames.add((await avatar.screenshot()).toString('base64'));
    await page.waitForTimeout(250);
  }
  assert.ok(frames.size >= 2, 'GIF animates instead of flattening');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('form img[src^="blob:"]'));
  const oldPreview = await page.locator('form img[src^="blob:"]').getAttribute('src');
  const oldId = await page.evaluate(() => JSON.parse(localStorage.getItem('report:avatar')).imageUrl);
  await page.getByLabel('Upload avatar file').setInputFiles({ name: 'animated.gif', mimeType: 'image/gif', buffer: gif });
  await page.waitForFunction((previous) => { const img = document.querySelector('form img'); return img?.src.startsWith('blob:') && img.src !== previous; }, oldPreview);
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForFunction((previous) => JSON.parse(localStorage.getItem('report:avatar')).imageUrl !== previous, oldId);
  await page.reload();
  await page.locator('nav').getByRole('button', { name: 'Settings' }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Change profile picture"] img')?.src.startsWith('blob:'));
  await page.getByRole('button', { name: 'Night · Aero' }).click();
  // Theme changes are a non-urgent React update, so wait for the new value instead of reading it at once.
  await page.waitForFunction(() => document.querySelector('.device')?.getAttribute('data-theme') === 'night');
  await page.locator('nav').getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Select Ready to play' }).click();
  await page.getByRole('button', { name: 'Ready to play: See them' }).click();
  assert.ok(await page.getByText('Has APK', { exact: false }).count() === 0);
  const scroll = page.locator('[aria-hidden="false"] .v-scroll').first();
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  assert.ok(await scroll.evaluate(el => el.scrollTop > 0), 'Browse scrolls in night mode');
  await page.getByRole('button', { name: /Load more/ }).click();
  assert.equal(await page.locator('[aria-hidden="false"] .masonry-item').count(), 48, 'All additional results remain available');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Animated GIF upload, persistence, blades, dark theme and browse pagination passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
