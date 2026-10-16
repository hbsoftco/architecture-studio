import { chromium } from 'playwright-core';
import { submitDialogInput } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await page.locator('#file-input').setInputFiles('samples/starter-project.zip');
  await page.locator('.doc-row').filter({ hasText: 'فرایند سفارش' }).click();
  await page.locator('#native-canvas .djs-container').waitFor();
  await page.locator('#native-test').click();
  await page.locator('#native-test-result').getByText('سفارش', { exact: true }).waitFor();
  await page.locator('#native-test-result button').first().click();
  await page.locator('#native-test-result').getByText('بررسی سفارش', { exact: true }).waitFor();
  await page.locator('.doc-row').filter({ hasText: 'تصمیم ارسال' }).click();
  await page.locator('#native-canvas .dmn-js-parent').waitFor();
  await page.locator('#native-test').click();
  await submitDialogInput(page, '{"urgent":true}');
  await page.locator('#native-test-result').getByText('پیک', { exact: false }).waitFor();
  if (errors.length) throw new Error(errors.join('; '));
  console.log('Simulation smoke passed: BPMN step and DMN boolean decision test');
} finally { await browser.close(); }
