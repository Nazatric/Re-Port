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
  await phone.locator('nav').getByRole('button', { name: 'Browse' }).click();
  await phone.getByRole('button', { name: 'Open filters' }).click();
  await phone.getByLabel('Close filters').waitFor();
  await phone.evaluate(() => window.__back());
  await phone.getByLabel('Close filters').waitFor({ state: 'detached' });
  await phone.getByPlaceholder('Games, port projects, engines, repos…').fill('doom');
  await phone.getByLabel('Open Doom', { exact: true }).first().click();
  await phone.getByText('Project page', { exact: true }).click();
  await phone.waitForFunction(() => window.__opened.length > 0);
  assert.ok((await phone.evaluate(() => window.__opened[0])).startsWith('https://'));
  await phone.waitForFunction(() => window.__hasBack());
  await phone.evaluate(() => window.__back());
  await phone.getByPlaceholder('Games, port projects, engines, repos…').waitFor();
  assert.deepEqual(errors, [], 'No uncaught errors during native bridge smoke test');
  await native.close();
  console.log('Web onboarding, browse, detail, native external links and back button passed.');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
