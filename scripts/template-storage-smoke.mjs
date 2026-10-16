import { chromium } from 'playwright-core';

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
  console.log('Template storage smoke passed: version 1 project retained, version 2 template store added');
} finally { await browser.close(); }
