import { chromium } from 'playwright-core';
import JSZip from 'jszip';

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const page = await browser.newPage();
try {
  const base = process.env.APP_URL || 'http://127.0.0.1:5173/';
  await page.route('**/template-seed.html', route => route.fulfill({ status:200, contentType:'text/html', body:'<!doctype html><title>seed</title>' }));
  await page.goto(new URL('template-seed.html', base).href);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('architecture-studio', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('projects', {keyPath:'id'});
        request.result.createObjectStore('snapshots', {keyPath:'id'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('projects','readwrite');
      tx.objectStore('projects').put({ schemaVersion:1, id:'legacy-project', name:'Legacy project', locale:'fa-IR', direction:'rtl', font:'Vazirmatn', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), folders:[], documents:[], links:[] });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto(base);
  await page.locator('#project-select option[value="legacy-project"]').waitFor({ state:'attached' });
  const result = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('architecture-studio');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = { version:db.version, stores:[...db.objectStoreNames] };
    db.close();
    return value;
  });
  if (result.version !== 2 || !result.stores.includes('templates') || !result.stores.includes('projects') || !result.stores.includes('snapshots')) throw new Error(`Migration failed: ${JSON.stringify(result)}`);
  await page.evaluate(async () => {
    const request = indexedDB.open('architecture-studio');
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    const now = new Date().toISOString();
    const transaction = db.transaction('templates', 'readwrite');
    const store = transaction.objectStore('templates');
    store.put({ id:'invalid-record' });
    store.put({ id:'user-broken-preview', schemaVersion:1, version:1, source:'custom', diagramType:'mermaid', category:'general', sourceFormat:'mmd', compatibility:{adapter:'mermaid',documentVersion:1}, title:{fa:'قالب خراب',en:'Broken preview'}, description:{fa:'آزمایش خطا',en:'Failure test'}, details:{fa:'آزمایش خطا',en:'Failure test'}, tags:[], content:'flowchart LR\nA[', createdAt:now, updatedAt:now });
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    db.close();
  });
  await page.reload();
  await page.locator('#new-document').click();
  await page.locator('#mode-templates').click();
  await page.locator('#template-message').getByText('1 قالب ذخیره‌شده').waitFor();
  await page.locator('#template-source').selectOption('custom');
  await page.locator('#template-full-preview').getByText('پیش‌نمایش در دسترس نیست').waitFor();
  const brokenRecord = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const request = indexedDB.open('architecture-studio'); request.onsuccess = () => resolve(request.result); });
    const record = await new Promise(resolve => { const request = db.transaction('templates').objectStore('templates').get('user-broken-preview'); request.onsuccess = () => resolve(request.result); });
    db.close();
    return record;
  });
  const zip = new JSZip();
  const { content, thumbnail, ...metadata } = brokenRecord;
  const sourcePath = `templates/${metadata.id}.mmd`;
  zip.file('manifest.json', JSON.stringify({ kind:'architecture-studio-templates', schemaVersion:1, createdAt:new Date().toISOString(), templates:[{...metadata, path:sourcePath}] }));
  zip.file(sourcePath, content);
  const bytes = [...await zip.generateAsync({type:'uint8array'})];
  const rejectedImport = await page.evaluate(async ({record,archive}) => {
    const { exportTemplates, importTemplates } = await import('/src/template-package.js');
    let exportRejected = false, importRejected = false;
    try { await exportTemplates([record]); } catch { exportRejected = true; }
    const blob = new Blob([new Uint8Array(archive)]);
    try { await importTemplates({size:blob.size, arrayBuffer:() => blob.arrayBuffer()}); } catch { importRejected = true; }
    return exportRejected && importRejected;
  }, {record:brokenRecord, archive:bytes});
  if (!rejectedImport) throw new Error('malformed Mermaid template package was accepted');
  await page.locator('.catalog-dialog .studio-dialog-submit').click();
  await page.locator('.studio-dialog-error:not([hidden])').waitFor();
  await page.locator('#template-source').selectOption('builtin');
  await page.locator('[data-template-id="bpmn-approval"]').click();
  await page.locator('#template-full-preview svg').waitFor();
  console.log('Template storage smoke passed: version 1 migration, invalid record isolation, preview fallback, creation recovery');
} finally { await browser.close(); }
