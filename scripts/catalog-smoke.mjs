import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: [ '--no-sandbox' ] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => { errors.push(`Native ${dialog.type()} dialog opened`); dialog.dismiss(); });
page.on('request', request => { if (!request.url().startsWith(process.env.APP_URL || 'http://127.0.0.1:5173/') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) errors.push(`External request: ${request.url()}`); });

async function openCatalog() {
  await page.locator((await page.locator('#new-document').isVisible()) ? '#new-document' : '#mobile-new-document').click();
  await page.locator('dialog.catalog-dialog[open]').waitFor();
}
async function create(id, name) {
  await openCatalog();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '/tmp/architecture-studio-catalog-overview-fa.png' });
  await page.locator(`[data-catalog-id="${id}"]`).click();
  await page.locator('#catalog-name').fill(name);
  await page.locator('.catalog-dialog .studio-dialog-submit').click();
  await page.locator('.doc-tab.active').filter({ hasText: name }).waitFor({ timeout: 30000 });
}
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await openCatalog();
  assert.equal(await page.locator('#catalog-search').evaluate(node => node === document.activeElement), true);
  assert.equal(await page.locator('[data-catalog-id="bpmn"]').getAttribute('aria-selected'), 'true');
  await page.locator('[data-catalog-id="bpmn"]').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.catalogId), 'dmn');
  for (const id of ['bpmn','dmn','flowchart','sequence','class','state','c4','erd','infrastructure','dfd','general','mermaid']) {
    await page.locator(`[data-catalog-id="${id}"]`).click();
    assert(await page.locator('#catalog-preview svg').isVisible(), `Preview missing for ${id}`);
  }
  await page.locator('#catalog-search').fill('unfindable-diagram');
  assert(await page.locator('.catalog-empty').isVisible());
  assert(await page.locator('.catalog-dialog .studio-dialog-submit').isDisabled());
  await page.locator('#catalog-search').fill('kubernetes');
  assert(await page.locator('[data-catalog-id="infrastructure"]').isVisible());
  await page.locator('#catalog-search').fill('فرايند');
  assert(await page.locator('[data-catalog-id="bpmn"]').isVisible(), 'Persian/Arabic normalized search missed BPMN');
  await page.locator('#catalog-search').fill('sequence');
  await page.locator('[data-catalog-id="sequence"]').click();
  assert((await page.locator('#catalog-preview').innerText()).includes('توالی'));
  assert((await page.locator('#catalog-preview svg text').evaluateAll(nodes => nodes.map(node => node.textContent))).some(text => text.includes('Frontend')));
  await page.locator('#catalog-name').fill('سناریوی من');
  await page.locator('#catalog-learn').click();
  assert(await page.locator('#catalog-guide.open').isVisible());
  await page.locator('#catalog-guide-next').click();
  assert((await page.locator('.catalog-guide-progress').innerText()).includes('2 / 9'));
  for (let index = 0; index < 7; index++) await page.locator('#catalog-guide-next').click();
  await page.locator('[data-related="class"]').click();
  assert((await page.locator('.catalog-guide-head').innerText()).includes('کلاس'));
  assert.equal(await page.locator('#catalog-name').inputValue(), 'سناریوی من');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#catalog-guide').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('#catalog-name').inputValue(), 'سناریوی من');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/architecture-studio-catalog-fa.png' });
  await page.locator('.catalog-dialog .studio-dialog-cancel').click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await create('sequence', 'توالی سفارش');
  await page.locator('#source').waitFor();
  assert((await page.locator('#source').inputValue()).startsWith('sequenceDiagram'));
  await page.reload();
  await page.locator('#source').waitFor();
  assert((await page.locator('#source').inputValue()).startsWith('sequenceDiagram'));
  await page.locator('#language').click();
  await openCatalog();
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  await page.locator('#catalog-search').fill('database');
  assert(await page.locator('[data-catalog-id="erd"]').isVisible());
  await page.locator('[data-catalog-id="erd"]').click();
  await page.locator('#catalog-learn').click();
  await page.screenshot({ path: '/tmp/architecture-studio-catalog-en-guide.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.setViewportSize({ width: 390, height: 800 });
  await openCatalog();
  const mobile = await page.locator('dialog.catalog-dialog .modal-box').boundingBox();
  assert(mobile.x >= 0 && mobile.x + mobile.width <= 390, 'Catalog overflows a mobile viewport');
  await page.locator('#catalog-learn').click();
  assert(await page.locator('#catalog-guide-close').isVisible());
  await page.waitForTimeout(350);
  await page.screenshot({ path: '/tmp/architecture-studio-catalog-mobile.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  if (errors.length) throw new Error(errors.join('; '));
  console.log('Catalog smoke passed: search, guide, focus, cancel, creation, persistence, English mode, no native dialogs');
} finally { await browser.close(); }
