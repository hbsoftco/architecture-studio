import { chromium } from 'playwright-core';
import { createDiagram } from './dialog-test-helper.mjs';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ acceptDownloads: true });
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await createDiagram(page, 'mermaid', 'نمودار تصویر');
  await page.locator('#diagram-preview svg text').first().waitFor({ timeout: 30000 });
  const svgDownload = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const svg = await svgDownload;
  await svg.saveAs('/tmp/architecture-studio-export.svg');
  const source = await readFile('/tmp/architecture-studio-export.svg', 'utf8');
  if (!source.includes('کاربر') || !source.includes('font/woff2;base64')) throw new Error('SVG missing Persian labels or embedded font');
  const pngDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const png = await pngDownload;
  await png.saveAs('/tmp/architecture-studio-export.png');
  console.log('Image smoke passed: Persian SVG labels, embedded font, PNG download');
} finally { await browser.close(); }
