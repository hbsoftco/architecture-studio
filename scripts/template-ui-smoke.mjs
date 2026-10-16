import { chromium } from 'playwright-core';
import { submitDialogInput } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const context = await browser.newContext({ viewport:{width:1250,height:820} });
const page = await context.newPage();
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await page.locator('#new-folder').click();
  await submitDialogInput(page, 'Templates folder');
  await page.locator('#new-document').click();
  await page.locator('#catalog-name').fill('Unchanged blank name');
  await page.locator('#mode-templates').click();
  if (process.env.TEMPLATE_SCREENSHOT) { await page.waitForTimeout(1200); await page.screenshot({ path:process.env.TEMPLATE_SCREENSHOT }); }
  await page.locator('#template-search').fill('تأييد');
  await page.locator('[data-template-id="bpmn-approval"]').click();
  await page.locator('#template-diagram-name').fill('Named from template');
  await page.locator('#template-guide').click();
  await page.locator('.template-guide h3').waitFor();
  await page.locator('#template-guide-next').click();
  await page.locator('#template-guide-back').click();
  assert(await page.locator('#template-diagram-name').inputValue() === 'Named from template', 'guide lost template name');
  await page.locator('#mode-blank').click();
  assert(await page.locator('#catalog-name').inputValue() === 'Unchanged blank name', 'mode switch lost blank name');
  await page.locator('#mode-templates').click();
  await page.locator('#template-type').selectOption('c4');
  await page.locator('#template-category').selectOption('architecture');
  await page.locator('#template-search').fill('');
  assert(await page.locator('.template-card').count() === 3, 'type/category filtering failed');
  await page.locator('[data-template-id="c4-context"]').click();
  await page.locator('#template-folder').selectOption({label:'Templates folder'});
  await page.locator('#template-diagram-name').fill('Folder architecture');
  await page.locator('.catalog-dialog .studio-dialog-submit').click();
  await page.locator('.doc-tab.active').filter({hasText:'Folder architecture'}).waitFor();
  const folder = await page.evaluate(async () => {
    const request = indexedDB.open('architecture-studio');
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction('projects');
    const all = await new Promise(resolve => { const r=tx.objectStore('projects').getAll(); r.onsuccess=()=>resolve(r.result); });
    db.close();
    const project = all.find(item => item.documents.some(doc => doc.name === 'Folder architecture'));
    const document = project.documents.find(doc => doc.name === 'Folder architecture');
    return document.folderId === project.folders.find(item => item.name === 'Templates folder')?.id;
  });
  assert(folder, 'destination folder not saved');

  await page.evaluate(() => { localStorage.setItem('as-lang','en'); localStorage.setItem('as-theme','dark'); });
  await page.reload();
  await page.locator('#new-document').click();
  await page.locator('#mode-templates').click();
  assert(await page.locator('#mode-templates').textContent() === 'Templates', 'English label missing');
  assert(await page.locator('html').getAttribute('dir') === 'ltr', 'English direction missing');
  assert(await page.locator('html').getAttribute('data-theme') === 'dark', 'dark theme missing');
  await page.locator('#template-source').selectOption('custom');
  await page.locator('.template-results .template-empty').waitFor();
  assert((await page.locator('.template-results .template-empty').textContent()).includes('No saved templates'), 'custom empty state missing');
  await page.locator('.studio-dialog-close').click();

  const mobile = await browser.newContext({ viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await mobilePage.locator('#mobile-new-document').click();
  await mobilePage.locator('#mode-templates').click();
  await mobilePage.locator('#template-results').waitFor();
  assert(await mobilePage.locator('.template-card').first().isVisible(), 'mobile gallery cards missing');
  assert(await mobilePage.locator('#template-detail').isVisible(), 'mobile preview missing');
  await mobile.close();
  console.log('Template UI smoke passed: mode state, guides, filters, folder, English/dark, mobile');
} finally { await browser.close(); }
