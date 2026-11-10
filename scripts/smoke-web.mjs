import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 4277, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route('https://**/*', (route) => route.fulfill({ status: 404 }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4277/');
  await page.getByPlaceholder('Your name').fill('Player');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await page.locator('nav').getByRole('button', { name: 'Browse' }).click();
  await page.getByPlaceholder('Games, port projects, engines, repos…').fill('doom');
  await page.getByLabel('Open Doom', { exact: true }).first().click();
  await page.getByText('Port requirements', { exact: false }).first().waitFor();
  assert.deepEqual(errors, [], 'No uncaught errors during browsing');
  await context.close();

  const native = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await native.route('https://**/*', (route) => route.fulfill({ status: 404 }));
  await native.addInitScript(() => {
    localStorage.setItem('report:name', JSON.stringify('Player'));
    const callbacks = new Map(); let id = 0;
    window.androidBridge = {};
    window.__back = () => { for (const item of callbacks.values()) if (item.event === 'backButton') item.callback({ canGoBack: true }); };
    window.__hasBack = () => [...callbacks.values()].some((item) => item.event === 'backButton');
    window.__opened = [];
    window.Capacitor = {
      PluginHeaders: [
        { name: 'App', methods: [{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'exitApp', rtype: 'promise' }] },
        { name: 'Browser', methods: [{ name: 'open', rtype: 'promise' }] },
      ],
      nativeCallback: (_plugin, _method, options, callback) => {
        const key = String(++id); callbacks.set(key, { event: options.eventName, callback }); return Promise.resolve(key);
      },
      nativePromise: (plugin, method, options) => {
        if (method === 'removeListener') callbacks.delete(options.callbackId);
        if (plugin === 'Browser' && method === 'open') window.__opened.push(options.url);
        return Promise.resolve();
      },
    };
  });
  const phone = await native.newPage();
  phone.on('pageerror', (error) => errors.push(error.message));
  await phone.goto('http://127.0.0.1:4277/');
  await phone.waitForFunction(() => window.__hasBack());
  const homeScroll = phone.locator('.v-scroll').first();
  const homeBounds = await homeScroll.boundingBox();
  assert.ok(homeBounds);
  // A swipe on empty space must not drag the entire screen sideways.
  await phone.mouse.move(homeBounds.x + 40, homeBounds.y + 125);
  await phone.mouse.down();
  await phone.mouse.move(homeBounds.x + 300, homeBounds.y + 125, { steps: 10 });
  await phone.mouse.up();
  const homeGeometry = await homeScroll.evaluate((el) => {
    el.scrollLeft = 150;
    return { width: el.clientWidth, scrollWidth: el.scrollWidth, left: el.scrollLeft };
  });
  assert.deepEqual(homeGeometry, { width: 390, scrollWidth: 390, left: 0 }, 'Home does not overflow horizontally');
  const stage = phone.locator('[data-idx]').first().locator('..');
  const selected = () => phone.locator('button[aria-label^="Go to "]').evaluateAll((buttons) => buttons.findIndex((button) => button.style.width === '18px'));
  const beforeDrag = await selected();
  const bounds = await stage.boundingBox();
  assert.ok(bounds);
  await phone.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + 60);
  await phone.mouse.down();
  await phone.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + 60, { steps: 10 });
  await phone.mouse.up();
  assert.notEqual(await selected(), beforeDrag, 'Cover flow can still be swiped');
  await homeScroll.evaluate((el) => { el.scrollTop = 500; });
  assert.ok(await homeScroll.evaluate((el) => el.scrollTop > 0), 'Home still scrolls vertically');
  await phone.locator('nav').getByRole('button', { name: 'Browse' }).click();
  await phone.getByRole('button', { name: 'Open filters' }).click();
  await phone.getByLabel('Close filters').waitFor();
  await phone.evaluate(() => window.__back());
  await phone.getByLabel('Close filters').waitFor({ state: 'detached' });
  await phone.getByPlaceholder('Games, port projects, engines, repos…').fill('doom');
  await phone.locator('nav').getByRole('button', { name: 'Home' }).click();
  await phone.locator('nav').getByRole('button', { name: 'Browse' }).click();
  assert.equal(await phone.getByPlaceholder('Games, port projects, engines, repos…').inputValue(), 'doom', 'Visited tabs retain their state');
  await phone.getByLabel('Open Doom', { exact: true }).first().click();
  const related = phone.getByText('More from the catalog').locator('xpath=ancestor::section[1]').locator('.h-scroll');
  assert.ok(await related.evaluate((el) => { el.scrollLeft = 100; return el.scrollLeft > 0; }), 'Nested horizontal lists remain scrollable');
  await phone.getByText('Project page', { exact: true }).click();
  await phone.waitForFunction(() => window.__opened.length > 0);
  assert.ok((await phone.evaluate(() => window.__opened[0])).startsWith('https://'));
  await phone.waitForFunction(() => window.__hasBack());
  await phone.evaluate(() => window.__back());
  await phone.getByPlaceholder('Games, port projects, engines, repos…').waitFor();
  await phone.getByPlaceholder('Games, port projects, engines, repos…').fill('morrowind');
  await phone.getByLabel('Open The Elder Scrolls III: Morrowind', { exact: true }).first().click();
  const portSelector = phone.locator('select').filter({ hasText: 'Morrowind (OpenMW)' });
  assert.equal(await portSelector.locator('option:checked').textContent(), 'Morrowind (OpenMW)', 'Most downloaded port is selected');
  assert.deepEqual(await portSelector.locator('option').allTextContents(), [
    'Morrowind (OpenMW)', 'Morrowind DS (OpenMW-DS)', 'OpenMW Android (Andiweli)', 'OpenMW Android',
  ], 'Port selector is sorted by downloads');
  await phone.getByRole('button', { name: 'Get latest APK' }).click();
  await phone.waitForFunction(() => window.__opened.length === 2);
  assert.equal(await phone.evaluate(() => window.__opened[1]), 'https://github.com/xyzz/openmw-android/releases', 'Nightly opens release list directly');
  await portSelector.selectOption({ label: 'Morrowind DS (OpenMW-DS)' });
  await phone.getByRole('button', { name: 'Get latest APK' }).click();
  await phone.waitForFunction(() => window.__opened.length === 3);
  assert.equal(await phone.evaluate(() => window.__opened[2]), 'https://github.com/Josh-Daniels/OpenMW-DS/releases/latest', 'Stable opens latest release directly');
  await phone.getByRole('button', { name: 'Ports 4' }).click();
  const cards = phone.getByText('4 community ports').locator('..').locator('..');
  assert.ok((await cards.textContent()).indexOf('Morrowind (OpenMW)') < (await cards.textContent()).indexOf('Morrowind DS'), 'Port cards show most downloaded first');
  assert.deepEqual(errors, [], 'No uncaught errors during native bridge smoke test');
  await native.close();
  console.log('Web onboarding, browse, detail, native external links and back button passed.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
