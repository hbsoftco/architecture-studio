import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:1320,height:820}, acceptDownloads:true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  const inventory = await page.evaluate(async () => {
    const { builtInTemplates } = await import('/src/template-library.js');
    const { templateThumbnail } = await import('/src/template-preview.js');
    const result = [];
    for (const item of builtInTemplates) {
      try {
        const svg = await templateThumbnail(item);
        result.push({ id:item.id, type:item.diagramType, preview:svg.includes('<svg'), error:null });
      } catch (error) { result.push({ id:item.id, type:item.diagramType, preview:false, error:error.message }); }
    }
    return result;
  });
  const invalid = inventory.filter(item => !item.preview || item.error);
  if (invalid.length) throw new Error(`Invalid previews: ${JSON.stringify(invalid)}`);
  for (const item of inventory) {
    await page.locator('#new-document').click();
    await page.locator('#mode-templates').click();
    await page.locator('#template-search').fill(item.id);
    await page.locator(`[data-template-id="${item.id}"]`).click();
    await page.locator('#template-diagram-name').fill(`Check ${item.id}`);
    await page.locator('.catalog-dialog .studio-dialog-submit').click();
    await page.locator('.doc-tab.active').filter({hasText:`Check ${item.id}`}).waitFor({timeout:30000});
    if (item.type === 'bpmn') await page.locator('#native-canvas .djs-container').waitFor({timeout:30000});
    else if (item.type === 'dmn') await page.locator('#native-canvas .dmn-js-parent').waitFor({timeout:30000});
    else if (item.type === 'mermaid') await page.locator('#diagram-preview svg').waitFor({timeout:30000});
    else await page.locator('.graph-svg [data-node]').first().waitFor();
    const problem = await page.locator('#problems').textContent();
    if (problem && /parse|invalid|error|unparsable|no displayable/i.test(problem)) throw new Error(`${item.id}: ${problem}`);
    if (['bpmn','dmn'].includes(item.type)) {
      await page.locator('#native-canvas[data-ready="true"]').waitFor({timeout:30000});
      const exportPromise = page.waitForEvent('download');
      await page.locator('#export-document').click();
      const exported = await exportPromise;
      await page.locator('#file-input').setInputFiles(await exported.path());
      await page.locator('#native-canvas[data-ready="true"]').waitFor({timeout:30000});
      const importedProblem = await page.locator('#problems').textContent();
      if (importedProblem && /parse|invalid|error|unparsable|no displayable/i.test(importedProblem)) throw new Error(`${item.id} re-import: ${importedProblem}`);
    }
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log(`Template inventory passed: ${inventory.length} real previews and editor mounts`);
} finally { await browser.close(); }
