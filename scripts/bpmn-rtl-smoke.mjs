import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: [ '--no-sandbox' ] });
const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function snapshot() {
  return page.evaluate(() => Object.fromEntries([ 'Pool_RTL', 'Lane_RTL', 'Start_RTL', 'Task_RTL', 'Gateway_RTL', 'End_RTL', 'Flow_Task' ].map(id => {
    const root = document.querySelector(`[data-element-id="${id}"]`);
    const text = root?.querySelector('text.djs-label');
    const line = text?.querySelector('tspan');
    return [ id, {
      font: text ? getComputedStyle(text).fontFamily : null,
      direction: line?.getAttribute('direction'),
      anchor: line?.getAttribute('text-anchor'),
      content: text?.textContent,
      x: line?.getAttribute('x'),
      geometry: root?.getAttribute('transform')
    } ];
  })));
}

async function assertLabels() {
  const labels = await page.locator('#native-canvas text.djs-label').evaluateAll(nodes => nodes.map(node => ({
    font: getComputedStyle(node).fontFamily,
    text: node.textContent,
    lines: [...node.querySelectorAll('tspan')].map(line => ({ direction: line.getAttribute('direction'), anchor: line.getAttribute('text-anchor') }))
  })));
  assert(labels.length >= 9, `Expected internal and external labels, got ${labels.length}`);
  assert(labels.every(label => label.font.startsWith('Vazirmatn')), 'Some BPMN labels use another font');
  assert(labels.some(label => label.text.includes('وضعیت API')), 'Sequence flow label missing');
  assert(labels.some(label => label.text.includes('تأیید شد')), 'Gateway label missing');
  assert(labels.some(label => label.text.includes('شروع')), 'Event label missing');
  assert(labels.some(label => label.text.includes('گروه بررسی')), 'Lane label missing');
  assert(labels.every(label => label.lines.every(line => line.direction && line.anchor)), 'Label bidi metadata missing');
  const task = await page.evaluate(() => {
    const root = document.querySelector('[data-element-id="Task_RTL"]');
    const text = root.querySelector('text.djs-label');
    const bounds = text.getBoundingClientRect();
    const shape = root.querySelector('.djs-visual > rect').getBoundingClientRect();
    return { lines: text.querySelectorAll('tspan').length, inside: bounds.left >= shape.left - 1 && bounds.right <= shape.right + 1 && bounds.top >= shape.top - 1 && bounds.bottom <= shape.bottom + 1 };
  });
  assert(task.lines >= 3 && task.inside, 'Long multiline Persian task label clips outside the task');
}

try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await page.locator('#file-input').setInputFiles('tests/fixtures/bpmn-rtl.bpmn');
  await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  assert.match(await page.locator('#problems').innerText(), /موردی یافت نشد|No problems/);
  await assertLabels();
  const first = await snapshot();
  await page.locator('[data-element-id="Task_RTL"] .djs-hit').first().dblclick({ force: true });
  const editField = page.locator('.djs-direct-editing-content');
  await editField.waitFor();
  const editStyle = await editField.evaluate(node => ({ font: getComputedStyle(node).fontFamily, bidi: getComputedStyle(node).unicodeBidi }));
  assert(editStyle.font.startsWith('Vazirmatn') && editStyle.bidi === 'plaintext', 'Direct editing font or bidi differs from display');
  await editField.press('Escape');
  await page.screenshot({ path: '/tmp/architecture-studio-bpmn-after-fa.png' });
  await page.locator('#language').click();
  await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  await assertLabels();
  const second = await snapshot();
  assert.deepEqual(second, first, 'Changing shell language changed BPMN label or element geometry');
  await page.screenshot({ path: '/tmp/architecture-studio-bpmn-after-en.png' });
  await page.reload();
  await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  await assertLabels();
  assert.deepEqual(await snapshot(), first, 'Refresh changed BPMN label or element geometry');

  const waitXml = page.waitForEvent('download');
  await page.locator('#export-document').click();
  await (await waitXml).saveAs('/tmp/architecture-studio-bpmn-rtl.bpmn');
  const xml = await readFile('/tmp/architecture-studio-bpmn-rtl.bpmn', 'utf8');
  assert(xml.includes('بررسی سفارش 123 (API)'), 'BPMN XML lost logical Unicode label');
  assert(xml.includes('width="160"'), 'BPMN DI dimensions changed');
  await page.locator('#file-input').setInputFiles('/tmp/architecture-studio-bpmn-rtl.bpmn');
  await page.locator('.doc-tab.active').filter({ hasText: 'architecture-studio-bpmn-rtl' }).waitFor({ timeout: 30000 });
  await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  await assertLabels();
  if (process.env.CHECK_OFFLINE) await page.context().setOffline(true);
  const waitSvg = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  await (await waitSvg).saveAs('/tmp/architecture-studio-bpmn-rtl.svg');
  const svg = await readFile('/tmp/architecture-studio-bpmn-rtl.svg', 'utf8');
  assert(svg.includes('font/woff2;base64') && svg.includes('بررسی سفارش'), 'SVG lost embedded font or Persian text');
  assert(svg.includes('direction="rtl"') && svg.includes('text-anchor="end"'), 'SVG lost label bidi metadata');
  const waitPng = page.waitForEvent('download');
  await page.locator('#export-png').click();
  await (await waitPng).saveAs('/tmp/architecture-studio-bpmn-rtl.png');
  const png = await readFile('/tmp/architecture-studio-bpmn-rtl.png');
  assert(png.subarray(0, 8).equals(Buffer.from([ 137, 80, 78, 71, 13, 10, 26, 10 ])) && png.length > 10000, 'PNG export is invalid');
  if (errors.length) throw new Error(errors.join('; '));
  console.log('BPMN RTL smoke passed: font, all label types, locale, refresh, XML round-trip, SVG, PNG');
} finally { await browser.close(); }
