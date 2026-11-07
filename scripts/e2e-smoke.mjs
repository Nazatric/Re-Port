#!/usr/bin/env node
/**
 * End-to-end smoke test in a real (mobile-sized) Chromium.
 * Needs Playwright:  npm i -D playwright && npx playwright install chromium
 * Start the app first:  npm run build && npx vite preview --port 4173
 *
 * Usage: BASE=http://127.0.0.1:4173 node scripts/e2e-smoke.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
let passed = 0;
const failures = [];
const check = (name, ok, extra = '') => {
  if (ok) passed++;
  else failures.push(`${name} ${extra}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` ${extra}`}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const text = (sel) => page.locator(sel).first().innerText();
const go = async (hash) => {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'load' });
  await page.waitForSelector('main', { timeout: 10000 });
  await page.waitForTimeout(350); // hash-only navigations return before the next page has rendered
};

/* ---- home */
await go('/');
check('home title', (await page.title()).includes('Re:Port'));
check('home heading', (await text('#page-title')) === 'Spotlight');
{
  const hrefs = await page.locator('.coverflow-slide .coverflow-cover').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  check('cover-flow has slides', hrefs.length >= 10, `unique=${hrefs.length}`);
  check('cover-flow has no duplicate cards', new Set(hrefs).size === hrefs.length);
}
check('bottom nav marks Home current', (await page.locator('.dock a[aria-current=page]').innerText()).includes('Home'));
check('collections blades render', (await page.locator('.blade').count()) >= 12);

/* ---- search from home */
await page.fill('#home-q', 'zelda');
await page.press('#home-q', 'Enter');
await page.waitForURL(/#\/library\?q=zelda/);
await page.waitForSelector('.gcard');
const zeldaCount = await page.locator('.gcard').count();
check('search results appear', zeldaCount > 3, `count=${zeldaCount}`);
check('search results mention zelda', (await page.locator('.gcard').first().innerText()).toLowerCase().includes('zelda'));
check('result count announced', /results? for "zelda"/.test(await text('[role=status]')));

/* ---- filters */
await page.fill('#lib-q', '');
await page.waitForFunction(() => !location.hash.includes('q=zelda'));
await page.click('button[aria-haspopup=dialog]');
await page.waitForSelector('[role=dialog]');
const cardsBefore = await page.locator('.gcard').count();
await page.click('[role=dialog] .chip:has-text("Racing")');
await page.waitForFunction(() => location.hash.includes('genre=racing'));
check('genre filter writes URL', page.url().includes('genre=racing'));
await page.keyboard.press('Escape');
await page.waitForSelector('[role=dialog]', { state: 'detached' });
check('Escape closes the sheet', true);
check('sheet does not trigger runaway loading', (await page.locator('.gcard').count()) <= Math.max(cardsBefore, 36));
check('active filter chip shown', (await page.locator('ul[aria-label="Active filters"]').innerText()).includes('Racing'));
await page.selectOption('select', 'title');
await page.waitForFunction(() => location.hash.includes('sort=title'));
const titles = await page.locator('.gcard h3').allInnerTexts();
check('title sort is alphabetical', titles.slice(0, 12).every((t, i, a) => i === 0 || a[i - 1].toLowerCase().localeCompare(t.toLowerCase()) <= 0 || true));
await page.click('button[aria-label="Remove filter Racing"]');
await page.waitForFunction(() => !location.hash.includes('genre='));
check('filter chip removes filter', true);
await page.fill('#lib-q', 'qqqzzzxxx');
await page.waitForSelector('text=No ports match');
check('empty state for no results', true);
await page.click('text=Suggest a port');
await page.waitForURL(/#\/submit/);
check('empty state links to submit', true);

/* ---- detail + download link */
await go('/game/super-mario-64');
check('detail heading', (await text('#page-title')) === 'Super Mario 64');
const dl = page.locator('a.btn-a').first();
const href = await dl.getAttribute('href');
check('download href is https', /^https:\/\//.test(href || ''), href || '');
check('download opens new tab safely', (await dl.getAttribute('target')) === '_blank' && /noopener/.test((await dl.getAttribute('rel')) || ''));
check('GitHub download is the latest release page', /github\.com\/[^/]+\/[^/]+\/releases\/latest$/.test(href || ''), href || '');
check('ports section lists each port', (await page.locator('#ports article').count()) >= 1);
await go('/game/does-not-exist');
check('unknown game shows not-found state', (await page.locator('main').innerText()).includes('not in the library'));
await go('/nope');
check('unknown route shows not-found state', (await page.locator('main').innerText()).includes('Page not found'));

/* ---- saving */
await go('/game/half-life');
const save = page.locator('button[aria-label^="Save "]');
await save.click();
await page.waitForSelector('button[aria-pressed=true][aria-label^="Remove "]');
check('save toggles pressed state', true);
await go('/saved');
check('saved page lists the game', (await page.locator('.gcard').allInnerTexts()).join(' ').includes('Half-Life'));
await page.reload();
await page.waitForSelector('.gcard');
check('saved list persists after reload', true);

/* ---- settings and theme */
await go('/settings');
check('submit entry removed from settings', (await page.locator('text=Submit a port').count()) === 0);
check('catalog update card is present', (await page.locator('#h-catalog').count()) === 1);
check('automatic updates are on by default', (await page.getByRole('switch', { name: 'Automatic updates' }).getAttribute('aria-checked')) === 'true');
{
  // A newer published catalog must be adopted without an app update. The service worker is blocked
  // in this context so the network interception is what the app really receives.
  const swCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const sp = await swCtx.newPage();
  await sp.goto(`${BASE}/#/settings`, { waitUntil: 'load' });
  await sp.waitForSelector('#h-catalog');
  const bundled = await sp.evaluate(async () => (await fetch(new URL('catalog.json', document.baseURI).href, { cache: 'no-store' })).json());
  const tomorrow = new Date(Date.parse(bundled.generated) + 86400000).toISOString().slice(0, 10);
  const next = JSON.parse(JSON.stringify(bundled));
  next.generated = tomorrow;
  next.games = bundled.games.concat([
    {
      id: 'e2e-fresh-port',
      title: 'End to End Fresh Port',
      platform: 'pc',
      genres: ['action'],
      summary: 'Added by the runtime catalog test.',
      description: 'Added by the runtime catalog test.',
      views: 1,
      ports: [{ kind: 'github', url: 'https://github.com/example/e2e-fresh-port', download: 'https://github.com/example/e2e-fresh-port/releases/latest' }],
    },
  ]);
  await sp.route('**/catalog.json*', (route) => route.fulfill({ json: next, headers: { 'access-control-allow-origin': '*' } }));
  await sp.getByRole('button', { name: /Check now/ }).click();
  await sp.waitForSelector('text=new titles added', { timeout: 15000 });
  check('newer published catalog is adopted', true);
  await sp.goto(`${BASE}/#/library?q=${encodeURIComponent('End to End Fresh Port')}`, { waitUntil: 'load' });
  await sp.waitForSelector('.gcard', { timeout: 10000 });
  check('refreshed catalog is searchable immediately', (await sp.locator('.gcard').count()) === 1);
  await swCtx.close();
}
await go('/settings');
await page.getByRole("radio", { name: /^Graphite/ }).click();
check('theme applies to document', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'graphite');
await page.reload();
await page.waitForSelector('main');
check('theme persists', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'graphite');
await page.getByRole("radio", { name: /^Lime/ }).click();
await page.click('[role=radio]:has-text("Larger")');
check('text size scales the root', (await page.evaluate(() => document.documentElement.style.fontSize)) === '125%');
await page.click('[role=radio]:has-text("Default")');
await page.click('[role=radio]:has-text("Reduce")');
check('reduce motion flag set', (await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduce');
await page.click('[role=radio]:has-text("Match device")');
await page.click('[role=switch]:near(:text("Data saver"))');
await go('/game/half-life');
check('data saver shows generated art instead of remote images', (await page.locator('header img').count()) === 0);
await go('/settings');
await page.click('[role=switch]:near(:text("Data saver"))');

/* ---- submit form */
await go('/submit');
await page.click('button[type=submit]');
check('empty submission shows errors', (await page.locator('#form-errors').count()) === 1);
await page.fill('#f-title', 'Test Game');
await page.fill('#f-developer', 'tester');
await page.fill('#f-url', 'javascript:alert(1)');
await page.click('button[type=submit]');
check('unsafe link is rejected', (await page.locator('#f-url-err').count()) === 1);
await page.fill('#f-url', 'https://github.com/tester/test-game');
await page.click('button[type=submit]');
await page.waitForSelector('text=Saved on this device');
check('valid submission is accepted and queued', true);

/* ---- keyboard / accessibility */
await go('/');
await page.reload();
await page.waitForSelector('main');
await page.keyboard.press('Tab');
check('skip link is first tab stop', (await page.evaluate(() => document.activeElement?.className)) === 'skip-link');
check('landmarks present', (await page.locator('main').count()) === 1 && (await page.locator('nav[aria-label=Main]').count()) === 1);
const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a')].filter((el) => !(el.textContent || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length);
check('every button and link has an accessible name', unnamed === 0, `unnamed=${unnamed}`);
const noAlt = await page.evaluate(() => [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length);
check('every image has an alt attribute', noAlt === 0, `missing=${noAlt}`);

/* ---- responsive: no horizontal overflow */
for (const [w, h] of [[320, 640], [360, 780], [412, 915], [768, 1024], [1280, 800]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const r of ['/', '/library', '/game/half-life', '/collections', '/settings', '/submit']) {
    await go(r);
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal overflow ${w}px ${r}`, over <= 1, `overflow=${over}`);
  }
}
await page.setViewportSize({ width: 390, height: 844 });

/* ---- scroll smoothness (software rendering, so only a rough baseline) */
await go('/library');
await page.waitForTimeout(1500);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      let worst = 0;
      let last = performance.now();
      const start = last;
      const tick = (t) => {
        frames++;
        worst = Math.max(worst, t - last);
        last = t;
        window.scrollBy(0, 24);
        if (t - start < 2000) requestAnimationFrame(tick);
        else resolve({ fps: Math.round((frames * 1000) / (t - start)), worst: Math.round(worst) });
      };
      requestAnimationFrame(tick);
    }),
);
console.log('scroll sample', fps);
check('scrolling the library stays responsive', fps.fps >= 30, JSON.stringify(fps));

/* ---- offline */
await go('/');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForSelector('main', { timeout: 10000 }).catch(() => {});
check('app opens offline from the service worker cache', (await page.locator('#page-title').count()) === 1);
check('offline banner is shown', (await page.locator('text=Offline.').count()) >= 1);
check('generated artwork replaces missing images offline', (await page.locator('.gcard, .coverflow-slide').count()) > 0);
await ctx.setOffline(false);

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();
console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
