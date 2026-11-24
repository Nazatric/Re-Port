// Measures browse scrolling in a phone-sized viewport: frames per second, worst frame and long tasks.
// Software rendering in CI and in the sandbox is slower than a phone, so the numbers are for comparing
// builds, not absolute targets. The script fails only on uncaught errors or if scrolling does not move.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 4283, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route('https://**/*', (route) => route.fulfill({ status: 404 }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4283/');
  await page.locator('nav').getByRole('button', { name: 'Browse' }).click();
  await page.locator('.masonry-item').first().waitFor();
  await page.evaluate(() => {
    window.__frames = []; window.__long = 0;
    new PerformanceObserver((list) => { window.__long += list.getEntries().length; }).observe({ type: 'longtask', buffered: false });
    const tick = (t) => { window.__frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const scroller = page.locator('[aria-hidden="false"] .v-scroll').first();
  const start = await scroller.evaluate((el) => el.scrollTop);
  // Scroll the list in 60 steps across about 4 seconds, as a fast swipe would.
  await scroller.evaluate(async (el) => {
    const step = Math.max(1, el.scrollHeight / 60);
    for (let i = 0; i < 60; i++) { el.scrollTop += step; await new Promise((r) => setTimeout(r, 66)); }
  });
  const result = await page.evaluate(() => {
    const f = window.__frames; const gaps = []; for (let i = 1; i < f.length; i++) gaps.push(f[i] - f[i - 1]);
    const span = (f[f.length - 1] - f[0]) / 1000;
    return { fps: +(f.length / span).toFixed(1), worstMs: +Math.max(...gaps).toFixed(0), longTasks: window.__long };
  });
  const end = await scroller.evaluate((el) => el.scrollTop);
  console.log(JSON.stringify({ ...result, scrolledPx: Math.round(end - start) }));
  assert.deepEqual(errors, [], 'No uncaught errors while scrolling browse');
  assert.ok(end > start, 'Browse scrolls');
  await context.close();
  console.log('Browse scroll measurement finished.');
} finally {
  await browser?.close();
  await server.httpServer.close();
}
