import { chromium } from 'playwright-core';
import { createDiagram } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  page.on('dialog', dialog => { throw new Error(`Native ${dialog.type()} dialog opened`); });
  await createDiagram(page, 'mermaid', 'نمودار آزمایشی');
  await page.locator('.doc-tab').waitFor();
  await page.locator('#source').fill('flowchart LR\n A[کاربر] --> B[سامانه]');
  await page.locator('#diagram-preview svg').waitFor({ timeout: 30000 });
  const beforeZoom = await page.locator('#diagram-preview svg').evaluate(svg => svg.getBoundingClientRect().width);
  await page.locator('#zoom-in').click();
  const afterZoom = await page.locator('#diagram-preview svg').evaluate(svg => svg.getBoundingClientRect().width);
  if (afterZoom <= beforeZoom) throw new Error('Mermaid zoom control failed');
  if (process.env.DIAG) console.log(await page.locator('#diagram-preview svg').evaluate(svg => ({ foreignObjects: svg.querySelectorAll('foreignObject').length, html: Array.from(svg.querySelectorAll('foreignObject')).map(item => item.innerHTML.slice(0, 300)), labels: svg.textContent.slice(-100) })));
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT, fullPage: true });
  await page.waitForTimeout(900);
  await page.reload();
  await page.locator('#source').waitFor();
  const restored = await page.locator('#source').inputValue();
  if (!restored.includes('سامانه')) throw new Error('Autosave did not restore Persian source');
  const waiting = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.locator('#export-project').click();
  await page.locator('#toast:not(:empty)').waitFor({ timeout: 2500 }).catch(() => {});
  const toast = await page.locator('#toast').innerText();
  const download = await waiting;
  if (!download) throw new Error(`Project ZIP export failed: ${toast}; ${errors.join('; ')}`);
  if (!download.suggestedFilename().endsWith('.zip')) throw new Error('Project ZIP export failed');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('Smoke passed: create, render Persian Mermaid, autosave, reload, export ZIP');
} finally { await browser.close(); }
