import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await page.locator('#file-input').setInputFiles('samples/starter-project.zip');
  await page.locator('#project-select').waitFor();
  await page.locator('.doc-row').first().waitFor();
  if (await page.locator('.doc-row').count() !== 4) throw new Error('Sample import lost documents');
  await page.locator('.doc-row').filter({ hasText: 'جریان سفارش' }).click();
  await page.locator('#diagram-preview svg text').first().waitFor({ timeout: 30000 });
  await page.locator('.doc-row').filter({ hasText: 'فرایند سفارش' }).click();
  await page.locator('#native-canvas .djs-container').waitFor({ timeout: 30000 });
  await page.locator('.doc-row').filter({ hasText: 'تصمیم ارسال' }).click();
  await page.locator('#native-canvas .dmn-js-parent').waitFor({ timeout: 30000 });
  await page.locator('.doc-row').filter({ hasText: 'ساختار سامانه' }).click();
  await page.locator('.graph-svg [data-node]').first().waitFor({ timeout: 30000 });
  if (await page.locator('.graph-svg [data-node]').count() !== 3) throw new Error('Sample graph lost nodes');
  if (errors.length) throw new Error(errors.join('; '));
  console.log('Sample smoke passed: project ZIP import and all four document families render');
} finally { await browser.close(); }
