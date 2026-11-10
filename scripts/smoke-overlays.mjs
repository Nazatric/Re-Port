import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { host: '127.0.0.1', port: 4279, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
    for (const theme of ['nxe', 'night']) {
      const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
      await context.route('https://**/*', route => route.fulfill({ status: 404 }));
      await context.addInitScript(theme => {
        localStorage.setItem('report:settings', JSON.stringify({ theme }));
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.goto('http://127.0.0.1:4279/');
      // No name is required: the app opens straight to Home.
      await page.locator('nav').getByRole('button', { name: 'Browse' }).click();
      await page.getByRole('button', { name: 'Open filters' }).click();
      const dialog = page.getByRole('dialog', { name: 'Filters' });
      await dialog.waitFor();
      await dialog.locator('.v-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await dialog.getByRole('button', { name: '1980s' }).click();
      const show = dialog.getByRole('button', { name: /^Show \d+ ports$/ });
      await show.click(); // Playwright checks hit testing: navigation must not cover this button.
      assert.equal(await dialog.count(), 0, 'Show closes the sheet');
      await page.getByRole('button', { name: 'Open filters' }).click();
      await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
      await dialog.getByRole('button', { name: /^Show \d+ ports$/ }).click();
      await page.getByRole('button', { name: 'Open filters' }).click();
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0, 'Escape closes filters');
      await page.getByRole('button', { name: 'Open filters' }).click();
      await page.getByRole('button', { name: 'Close filters' }).click();
      await page.locator('nav').getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('button', { name: 'Customize', exact: true }).click();
      await page.getByRole('button', { name: 'Save profile' }).click();
      await page.getByRole('button', { name: 'Customize', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.deepEqual(errors, [], `No errors at ${viewport.width}x${viewport.height} in ${theme}`);
      await context.close();
    }
  }
  console.log('Filter sheet and profile actions are clickable across phone sizes and both themes.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
