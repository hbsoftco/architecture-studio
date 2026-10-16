import { chromium } from 'playwright-core';
import { cpus, totalmem } from 'node:os';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

async function size(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => entry.isDirectory() ? size(join(path, entry.name)) : (await stat(join(path, entry.name))).size))).reduce((a,b) => a+b, 0);
}
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-precise-memory-info'] });
const page = await browser.newPage();
const started = performance.now();
try {
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('.welcome').waitFor();
  const initial = Math.round(performance.now() - started);
  const importStart = performance.now();
  await page.locator('#file-input').setInputFiles('samples/starter-project.zip');
  await page.locator('.doc-row').first().waitFor();
  const projectImport = Math.round(performance.now() - importStart);
  const timings = {};
  for (const fixture of [
    { name: 'جریان سفارش', selector: '#diagram-preview svg text' },
    { name: 'فرایند سفارش', selector: '#native-canvas .djs-container' },
    { name: 'تصمیم ارسال', selector: '#native-canvas .dmn-js-parent' },
    { name: 'ساختار سامانه', selector: '.graph-svg [data-node]' },
  ]) {
    const before = performance.now();
    await page.locator('.doc-row').filter({ hasText: fixture.name }).click();
    await page.locator(fixture.selector).first().waitFor({ timeout: 30000 });
    timings[fixture.name] = Math.round(performance.now() - before);
  }
  const memory = await page.evaluate(() => performance.memory?.usedJSHeapSize || null);
  const output = `# Performance baseline\n\nMeasured with headless ${await browser.version()} on ${cpus()[0].model}, ${Math.round(totalmem() / 1024 ** 3)} GiB RAM. Production Vite preview at 127.0.0.1:4173. Fixture: \`samples/starter-project.zip\` (one document each for Mermaid, BPMN, DMN, and C4). Single run; times include browser UI and lazy module loading, and are not statistical benchmarks.\n\n| Measurement | Result |\n| --- | ---: |\n| Release directory size | ${((await size('dist')) / 1024 ** 2).toFixed(2)} MiB |\n| Initial app ready | ${initial} ms |\n| Sample project ZIP import | ${projectImport} ms |\n| Mermaid first render | ${timings['جریان سفارش']} ms |\n| BPMN first render | ${timings['فرایند سفارش']} ms |\n| DMN first render | ${timings['تصمیم ارسال']} ms |\n| C4 graph first render | ${timings['ساختار سامانه']} ms |\n| Browser JS heap after editors | ${memory ? (memory / 1024 ** 2).toFixed(1) + ' MiB' : 'unavailable'} |\n\nLarge-diagram rendering and memory release after editor close remain unmeasured.\n`;
  await writeFile('docs/BENCHMARKS.md', output);
  console.log(output);
} finally { await browser.close(); }
