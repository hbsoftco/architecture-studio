import { chromium } from 'playwright-core';
import { createDiagram, chooseDialogOption } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ serviceWorkers: 'allow', acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:4173/');
  await page.locator('.welcome').waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; await new Promise(resolve => { if (navigator.serviceWorker.controller) resolve(); else navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }); }); });
  await context.setOffline(true);
  await page.reload();
  await page.locator('.welcome').waitFor();
  await createDiagram(page, 'mermaid', 'آفلاین');
  await page.locator('#source').fill('flowchart LR\n A[آفلاین] --> B[ذخیره]');
  await page.locator('#diagram-preview svg').waitFor({ timeout: 30000 });
  await page.waitForTimeout(850);
  await page.reload();
  await page.locator('#source').waitFor();
  if (!(await page.locator('#source').inputValue()).includes('ذخیره')) throw new Error('Offline autosave failed');
  const waiting = page.waitForEvent('download');
  await page.locator('#export-document').click();
  await (await waiting).saveAs('/tmp/architecture-studio-offline.mmd');
  await page.locator('#file-input').setInputFiles('/tmp/architecture-studio-offline.mmd');
  await page.locator('#source').waitFor();
  if (!(await page.locator('#source').inputValue()).includes('ذخیره')) throw new Error('Offline Mermaid import failed');
  await page.locator('#diagram-preview svg text').first().waitFor({ timeout: 30000 });
  for (const selector of ['#export-svg', '#export-png']) {
    const imageDownload = page.waitForEvent('download');
    await page.locator(selector).click();
    await imageDownload;
  }
  await page.locator('#file-input').setInputFiles('samples/starter-project.zip');
  for (const fixture of [
    { name: 'فرایند سفارش', selector: '#native-canvas .djs-container' },
    { name: 'تصمیم ارسال', selector: '#native-canvas .dmn-js-parent' },
    { name: 'ساختار سامانه', selector: '.graph-svg [data-node]' },
  ]) {
    await page.locator('.doc-row').filter({ hasText: fixture.name }).click();
    await page.locator(fixture.selector).first().waitFor({ timeout: 30000 });
  }
  await page.locator('#add-node').click();
  await chooseDialogOption(page, 'box');
  if (await page.locator('.graph-svg [data-node]').count() !== 4) throw new Error('Offline graph edit failed');
  const graphExport = page.waitForEvent('download');
  await page.locator('#export-document').click();
  await graphExport;
  for (const name of ['فرایند سفارش', 'تصمیم ارسال']) {
    await page.locator('.doc-row').filter({ hasText: name }).click();
    await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
    const nativeExport = page.waitForEvent('download');
    await page.locator('#export-document').click();
    await nativeExport;
  }
  await page.reload();
  await page.locator('.doc-row').filter({ hasText: 'ساختار سامانه' }).click();
  await page.locator('.graph-svg [data-node]').first().waitFor({ timeout: 30000 });
  const restoredNodes = await page.locator('.graph-svg [data-node]').count();
  if (restoredNodes !== 4) throw new Error(`Offline graph restore failed: ${restoredNodes} nodes`);
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('Offline smoke passed: disconnected Mermaid import/export and images, sample ZIP import, BPMN/DMN exports, graph edit/restore');
} finally { await browser.close(); }
