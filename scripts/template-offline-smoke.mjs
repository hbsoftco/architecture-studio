import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const context = await browser.newContext({ serviceWorkers:'allow', acceptDownloads:true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:4173/');
  await page.locator('.welcome').waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
  });
  await context.setOffline(true);
  await page.reload();
  await page.locator('#new-document').click();
  await page.locator('#mode-templates').click();
  await page.locator('[data-template-id="mermaid-sequence"]').click();
  await page.locator('#template-full-preview svg').waitFor({timeout:30000});
  await page.locator('#template-diagram-name').fill('Offline template');
  await page.locator('.catalog-dialog .studio-dialog-submit').click();
  await page.locator('#source').waitFor();
  if (!(await page.locator('#source').inputValue()).startsWith('sequenceDiagram')) throw new Error('Offline template source failed');
  await page.locator('#save-template').click();
  const dialog = page.locator('dialog.studio-dialog[open]');
  await dialog.locator('[name="description"]').fill('Offline reusable sequence');
  await dialog.locator('.studio-dialog-submit').click();
  await dialog.waitFor({state:'detached'});
  await page.reload();
  await page.locator('#new-document').click();
  await page.locator('#mode-templates').click();
  await page.locator('#template-source').selectOption('custom');
  await page.locator('.template-card[data-template-id^="user-"]').waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#template-export').click();
  await downloadPromise;
  if (errors.length) throw new Error(errors.join('; '));
  console.log('Template offline smoke passed: cached gallery, Mermaid preview/create, custom save/reload/export');
} finally { await browser.close(); }
