// Capture the pre-fix bpmn-js defaults against the same regression fixture.
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const xml = await readFile('tests/fixtures/bpmn-rtl.bpmn', 'utf8');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: [ '--no-sandbox' ] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await page.locator('#file-input').setInputFiles('tests/fixtures/bpmn-rtl.bpmn');
  await page.locator('#native-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
  const result = await page.evaluate(async source => {
    const { default: Modeler } = await import('/node_modules/bpmn-js/lib/Modeler.js');
    const original = document.querySelector('#native-canvas');
    original.style.visibility = 'hidden';
    const baseline = document.createElement('div');
    baseline.id = 'baseline-canvas';
    baseline.style.cssText = 'position:absolute;inset:0;background:white;direction:rtl';
    original.parentElement.append(baseline);
    const modeler = new Modeler({ container: baseline });
    await modeler.importXML(source);
    modeler.get('canvas').zoom('fit-viewport');
    const label = baseline.querySelector('[data-element-id="Task_RTL"] text.djs-label');
    return { font: getComputedStyle(label).fontFamily, direction: label.querySelector('tspan').getAttribute('direction') };
  }, xml);
  await page.screenshot({ path: '/tmp/architecture-studio-bpmn-before.png' });
  console.log('Original bpmn-js defaults:', result);
} finally { await browser.close(); }
