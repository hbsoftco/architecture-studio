import { chromium } from 'playwright-core';
import { submitDialogInput } from './dialog-test-helper.mjs';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ acceptDownloads: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await page.locator('#file-input').setInputFiles('samples/starter-project.zip');
  for (const family of [
    { name: 'فرایند سفارش', extension: 'bpmn', marker: 'Task_review', selector: '#native-canvas .djs-container' },
    { name: 'تصمیم ارسال', extension: 'dmn', marker: 'Decision_ship', selector: '#native-canvas .dmn-js-parent' },
  ]) {
    await page.locator('.doc-row').filter({ hasText: family.name }).click();
    await page.locator(family.selector).waitFor({ timeout: 30000 });
    await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
    await page.locator('#validate').click();
    const initialProblems = await page.locator('#problems').innerText();
    if (!/موردی یافت نشد|No problems/.test(initialProblems)) throw new Error(`${family.extension} basic validation found an issue: ${initialProblems}`);
    if (family.extension === 'bpmn') {
      await page.locator('[data-element-id="Task_review"] .djs-hit').first().dblclick({ force: true });
      const editField = page.locator('.djs-direct-editing-content');
      await editField.waitFor({ timeout: 5000 });
      await editField.fill('بازبینی سفارش');
      await editField.press('Enter');
      await page.locator('#find-element').click();
      await submitDialogInput(page, 'Task_review');
      if (!(await page.locator('#toast').innerText()).includes('Task_review')) throw new Error('BPMN element search failed');
    }
    const waiting = page.waitForEvent('download');
    await page.locator('#export-document').click();
    const download = await waiting;
    const path = `/tmp/architecture-studio-roundtrip.${family.extension}`;
    await download.saveAs(path);
    const xml = await readFile(path, 'utf8');
    if (!xml.includes(family.marker)) throw new Error(`${family.extension} export lost ${family.marker}`);
    if (family.extension === 'bpmn' && !xml.includes('بازبینی سفارش')) throw new Error('BPMN visual edit was not exported');
    if (family.extension === 'bpmn') {
      const invalid = xml.replace('id="Task_review"', 'id="Start_order"');
      const findings = await page.evaluate(async source => (await import('/src/xml-validation.js')).validateXMLDocument(source, 'bpmn'), invalid);
      if (!findings.some(issue => issue.includes('Duplicate ID'))) throw new Error('Duplicate BPMN ID was not detected');
    }
    await page.locator('#file-input').setInputFiles(path);
    await page.locator(family.selector).waitFor({ timeout: 30000 });
    const problem = await page.locator('#problems').innerText();
    if (/unparsable|invalid|no displayable contents/i.test(problem)) throw new Error(`${family.extension} re-import: ${problem}`);
  }
  if (errors.length) throw new Error(errors.join('; '));
  console.log('Native round-trip smoke passed: BPMN and DMN sample export and re-import');
} finally { await browser.close(); }
