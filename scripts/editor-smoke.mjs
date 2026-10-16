import { chromium } from 'playwright-core';
import { createDiagram, chooseDialogOption } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
async function add(type, name) {
  await createDiagram(page, type, name);
}
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await add('bpmn', 'فرایند آزمایشی');
  await page.locator('#native-canvas .djs-container').waitFor({ timeout: 30000 });
  await page.waitForTimeout(700);
  await page.reload();
  await page.locator('#native-canvas .djs-container').waitFor({ timeout: 30000 });
  await page.locator('#export-document').click();
  await add('dmn', 'تصمیم آزمایشی');
  await page.locator('#native-canvas .dmn-js-parent').waitFor({ timeout: 10000 });
  const dmnProblem = await page.locator('#problems').innerText();
  if (/no displayable contents|unparsable|invalid/i.test(dmnProblem)) throw new Error(`DMN import: ${dmnProblem}`);
  await add('c4', 'معماری آزمایشی');
  await page.locator('#add-node').click();
  await chooseDialogOption(page, 'box');
  await page.locator('.graph-svg [data-node]').first().waitFor();
  await page.waitForTimeout(800);
  await page.reload();
  await page.locator('.graph-svg [data-node]').first().waitFor();
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log('Editor smoke passed: BPMN reload, DMN mount, visual graph node restore');
} finally { await browser.close(); }
