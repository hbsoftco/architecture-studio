import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createDiagram, chooseDialogOption, submitDialogInput } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: [ '--no-sandbox' ] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => { errors.push(`Native ${dialog.type()} dialog opened`); dialog.dismiss(); });
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  const projectsBefore = await page.locator('#project-select option').count();
  await page.locator('#new-project').click();
  const projectDialog = page.locator('dialog.studio-dialog[open]');
  await projectDialog.locator('.studio-dialog-submit').click();
  assert(await projectDialog.locator('.studio-dialog-error').isVisible(), 'Required field error missing');
  await projectDialog.locator('.studio-dialog-cancel').click();
  assert.equal(await page.locator('#project-select option').count(), projectsBefore);
  await page.locator('#new-project').click();
  await submitDialogInput(page, 'پروژهٔ آزمون');
  assert.equal(await page.locator('#project-select option:checked').innerText(), 'پروژهٔ آزمون');

  await page.locator('#project-actions').click();
  await chooseDialogOption(page, 'rename');
  await submitDialogInput(page, 'پروژهٔ ویرایش‌شده');
  assert.equal(await page.locator('#project-select option:checked').innerText(), 'پروژهٔ ویرایش‌شده');
  await page.locator('#project-actions').click();
  await chooseDialogOption(page, 'delete');
  await page.locator('dialog.studio-dialog[open] .studio-dialog-cancel').click();
  assert.equal(await page.locator('#project-select option:checked').innerText(), 'پروژهٔ ویرایش‌شده');
  await page.locator('#new-folder').click();
  await submitDialogInput(page, 'گروه الف');
  assert(await page.locator('.folder-row').filter({ hasText: 'گروه الف' }).isVisible());

  await createDiagram(page, 'c4', 'معماری تست');
  assert.equal(await page.locator('.graph-svg [data-node]').count(), 3);
  await page.locator('.doc-row').filter({ hasText: 'معماری تست' }).click({ button:'right' });
  await chooseDialogOption(page, 'delete');
  await page.locator('dialog.studio-dialog[open] .studio-dialog-cancel').click();
  assert(await page.locator('.doc-row').filter({ hasText: 'معماری تست' }).isVisible(), 'Cancel deleted a diagram');

  await page.locator('#new-document').click();
  await page.locator('[data-catalog-id="erd"]').click();
  await page.locator('#catalog-name').fill('ثبت ناموفق');
  await page.evaluate(() => {
    window.__originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function() { throw new Error('Simulated storage failure'); };
  });
  await page.locator('.catalog-dialog .studio-dialog-submit').click();
  await page.locator('.catalog-dialog .studio-dialog-error').getByText('Simulated storage failure').waitFor();
  assert.equal(await page.locator('#catalog-name').inputValue(), 'ثبت ناموفق');
  assert.equal(await page.locator('.doc-row').filter({ hasText: 'ثبت ناموفق' }).count(), 0, 'Failed creation left a document');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__originalPut; delete window.__originalPut; });
  await page.locator('.catalog-dialog .studio-dialog-submit').evaluate(button => { button.click(); button.click(); });
  await page.locator('.doc-row').filter({ hasText: 'ثبت ناموفق' }).waitFor();
  assert.equal(await page.locator('.doc-row').filter({ hasText: 'ثبت ناموفق' }).count(), 1, 'Duplicate submission created duplicate documents');

  await page.locator('#theme').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('#new-folder').click();
  assert((await page.locator('dialog.studio-dialog[open]').evaluate(node => getComputedStyle(node).fontFamily)).includes('Vazirmatn'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'new-folder');
  await page.locator('#new-document').click();
  assert.notEqual(await page.locator('dialog.catalog-dialog .modal-box').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
  await page.keyboard.press('Escape');
  await page.locator('#language').click();
  await page.locator('#new-project').click();
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  assert((await page.locator('dialog.studio-dialog[open]').innerText()).includes('New project'));
  await page.keyboard.press('Escape');
  await page.locator('#new-project').click();
  await submitDialogInput(page, 'Temporary project');
  await page.locator('#project-actions').click();
  await chooseDialogOption(page, 'delete');
  await page.locator('dialog.studio-dialog[open] .studio-dialog-submit').click();
  await page.waitForFunction(() => ![...document.querySelectorAll('#project-select option')].some(option => option.textContent === 'Temporary project'));
  assert.equal(await page.locator('#project-select option').filter({ hasText:'Temporary project' }).count(), 0);
  if (errors.length) throw new Error(errors.join('; '));
  console.log('Dialogs smoke passed: validation, cancel, rename, destructive cancel, storage failure, duplicate protection, themes, locales, no native dialogs');
} finally { await browser.close(); }
