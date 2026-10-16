import { chromium } from 'playwright-core';
import { createDiagram, chooseDialogOption } from './dialog-test-helper.mjs';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-features=Translate'] });
const context = await browser.newContext({ viewport: { width: 1180, height: 760 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function snapshot(selector) {
  return page.locator(selector).evaluate(element => ({
    node: element, box: element.getBoundingClientRect().toJSON(),
    viewBox: element.getAttribute('viewBox'),
    scrollLeft: element.scrollLeft, scrollTop: element.scrollTop
  }));
}
async function open(type, name) {
  if (await page.locator('#fullscreen').count() && await page.locator('#fullscreen').getAttribute('aria-pressed') === 'true') await page.locator('#fullscreen').click();
  await createDiagram(page, type, name);
}
async function enter() {
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.querySelector('#fullscreen')?.getAttribute('aria-pressed') === 'true');
  assert(await page.locator('.workspace').evaluate(el => el.matches(':fullscreen') || el.classList.contains('fullscreen-active')), 'workspace did not expand');
  assert(!(await page.locator('.doc-tabs').isVisible()), 'tabs visible in fullscreen');
  assert(!(await page.locator('.sidebar').isVisible()), 'explorer visible in fullscreen');
  assert(await page.locator('#toolbar').isVisible(), 'toolbar hidden in fullscreen');
}
async function exit() {
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => document.querySelector('#fullscreen')?.getAttribute('aria-pressed') === 'false');
  assert(await page.locator('.doc-tabs').isVisible(), 'tabs missing after exit');
}
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.locator('.welcome').waitFor();
  await open('c4', 'Fullscreen graph');
  await page.locator('#add-node').click(); await chooseDialogOption(page, 'box');
  await page.locator('.graph-svg [data-node]').first().waitFor();
  await page.locator('#zoom-in').click();
  await page.locator('#pan').click();
  const graphZoomedView = await page.locator('.graph-svg').getAttribute('viewBox');
  const graphCanvas = await page.locator('.graph-svg').boundingBox();
  await page.mouse.move(graphCanvas.x + graphCanvas.width / 2, graphCanvas.y + graphCanvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(graphCanvas.x + graphCanvas.width / 2 + 60, graphCanvas.y + graphCanvas.height / 2 + 35, { steps: 8 });
  await page.mouse.up();
  assert(await page.locator('.graph-svg').getAttribute('viewBox') !== graphZoomedView, 'graph pan did not move viewport');
  await page.locator('#pan').click();
  const graphBefore = await snapshot('.graph-svg');
  const graphHandle = await page.locator('.graph-svg').elementHandle();
  const selectedBefore = await page.locator('.graph-svg [data-node]').last().getAttribute('data-node');
  await enter();
  if (process.env.FULLSCREEN_SCREENSHOT) await page.screenshot({ path: process.env.FULLSCREEN_SCREENSHOT });
  const graphDuring = await snapshot('.graph-svg');
  assert(await graphHandle.evaluate((el, other) => el === other, await page.locator('.graph-svg').elementHandle()), 'graph editor recreated');
  assert(graphDuring.viewBox === graphBefore.viewBox, 'graph viewport changed');
  assert(await page.locator(`.graph-svg [data-node="${selectedBefore}"]`).count(), 'graph selection lost');
  const graphNodesBefore = await page.locator('.graph-svg [data-node]').count();
  await page.locator('#add-node').click();
  await chooseDialogOption(page, 'service');
  assert(await page.locator('.graph-svg [data-node]').count() === graphNodesBefore + 1, 'fullscreen dialog or graph creation failed');
  const editedId = await page.locator('.graph-svg [data-node]').last().getAttribute('data-node');
  await page.locator('#fullscreen-properties').click();
  assert(await page.locator('.inspector').isVisible(), 'properties panel unavailable');
  await page.locator('#node-label').fill('Edited fullscreen');
  await page.locator('#pan').click();
  assert(await page.locator('#pan').getAttribute('aria-pressed') === 'true', 'pan unavailable');
  await page.locator('#pan').click();
  await page.locator('#undo').click(); await page.locator('#redo').click();
  assert((await page.locator(`.graph-svg [data-node="${editedId}"] text`).first().textContent()) === 'Edited fullscreen', `graph edit/undo/redo failed: ${await page.locator(`.graph-svg [data-node="${editedId}"] text`).first().textContent()}`);
  await exit();
  assert(await graphHandle.evaluate((el, other) => el === other, await page.locator('.graph-svg').elementHandle()), 'graph recreated on exit');

  await open('mermaid', 'Fullscreen Mermaid');
  await page.locator('#source').fill('flowchart LR\nA[Fullscreen source] --> B[Editable]');
  await page.locator('#diagram-preview svg').waitFor({ timeout: 30000 });
  await page.locator('#zoom-in').click();
  await page.locator('#source').focus();
  await page.keyboard.press('Control+Shift+f');
  assert(await page.locator('#fullscreen').getAttribute('aria-pressed') === 'false', 'shortcut fired while typing');
  const mermaidNormalWidth = (await page.locator('#diagram-preview').boundingBox()).width;
  const mermaidBefore = await snapshot('#diagram-preview svg');
  const mermaidHandle = await page.locator('#diagram-preview svg').elementHandle();
  await enter();
  const mermaidDuring = await snapshot('#diagram-preview svg');
  assert(await mermaidHandle.evaluate((el, other) => el === other, await page.locator('#diagram-preview svg').elementHandle()), 'Mermaid preview recreated');
  assert(mermaidDuring.box.width === mermaidBefore.box.width, 'Mermaid zoom reset');
  assert((await page.locator('#diagram-preview').boundingBox()).width > mermaidNormalWidth, 'Mermaid preview did not resize');
  await page.locator('#source').fill('flowchart LR\nA[Changed inside fullscreen] --> B[Editable]');
  await page.locator('#diagram-preview').getByText('Changed inside fullscreen').waitFor({ timeout: 30000 });
  await exit();
  assert((await page.locator('#source').inputValue()).includes('Changed inside fullscreen'), 'Mermaid source lost');

  await open('bpmn', 'Fullscreen BPMN');
  await page.locator('#native-canvas .djs-container').waitFor({ timeout: 30000 });
  await page.locator('#native-canvas').evaluate(el => el.dataset.ready === 'true');
  await page.locator('#zoom-in').click();
  await page.locator('#native-canvas .djs-element').first().click({ force: true });
  const bpmnNormalWidth = (await page.locator('#native-canvas').boundingBox()).width;
  const bpmnHandle = await page.locator('#native-canvas .djs-container').elementHandle();
  const bpmnBefore = await page.locator('#native-canvas').evaluate(el => ({
    container: el.querySelector('.djs-container'), transform: el.querySelector('.viewport')?.getAttribute('transform'),
    selected: el.querySelectorAll('.djs-element.selected').length,
    xml: document.querySelector('#xml-source')?.value
  }));
  await enter();
  const bpmnDuring = await page.locator('#native-canvas').evaluate(el => ({
    container: el.querySelector('.djs-container'), transform: el.querySelector('.viewport')?.getAttribute('transform'),
    selected: el.querySelectorAll('.djs-element.selected').length
  }));
  assert(await bpmnHandle.evaluate((el, other) => el === other, await page.locator('#native-canvas .djs-container').elementHandle()), 'BPMN modeler recreated');
  assert(bpmnDuring.transform === bpmnBefore.transform, 'BPMN zoom or pan changed');
  assert(bpmnBefore.selected > 0, 'BPMN element was not selected');
  assert(bpmnDuring.selected === bpmnBefore.selected, 'BPMN selection changed');
  assert((await page.locator('#native-canvas').boundingBox()).width > bpmnNormalWidth, 'BPMN canvas did not resize');
  assert(await page.locator('.djs-palette').isVisible(), 'BPMN palette hidden');
  await page.locator('#fullscreen-properties').click();
  await page.locator('#bpmn-name').fill('Edited in fullscreen');
  await page.locator('#bpmn-name').dispatchEvent('change');
  await page.waitForTimeout(450);
  assert((await page.locator('#xml-source').inputValue()).includes('Edited in fullscreen'), 'BPMN visual editing failed');
  await page.locator('#source-view').click();
  assert(await page.locator('#xml-source').isVisible(), 'BPMN source inaccessible');
  await page.locator('#validate').click();
  await page.locator('#fullscreen-properties').click();
  const elementCount = await page.locator('#native-canvas .djs-element').count();
  const paletteBox = await page.locator('.djs-palette .entry.bpmn-icon-task').boundingBox();
  const canvasBox = await page.locator('#native-canvas .djs-container').boundingBox();
  await page.mouse.move(paletteBox.x + paletteBox.width / 2, paletteBox.y + paletteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 20 });
  await page.mouse.up();
  await page.waitForFunction(count => document.querySelectorAll('#native-canvas .djs-element').length > count, elementCount, { timeout: 5000 });
  await exit();
  assert((await page.locator('#xml-source').inputValue()).includes('Edited in fullscreen'), 'BPMN unsaved changes lost');

  await open('dmn', 'Fullscreen DMN');
  await page.locator('#native-canvas .dmn-js-parent').waitFor({ timeout: 30000 });
  const dmnBefore = await page.locator('#native-canvas .dmn-js-parent').elementHandle();
  const dmnNormalWidth = (await page.locator('#native-canvas').boundingBox()).width;
  await enter();
  const dmnDuring = await page.locator('#native-canvas .dmn-js-parent').elementHandle();
  assert(await dmnBefore.evaluate((el, other) => el === other, dmnDuring), 'DMN editor recreated');
  assert((await page.locator('#native-canvas').boundingBox()).width > dmnNormalWidth, 'DMN container did not resize');
  await page.locator('#fullscreen-properties').click();
  await page.locator('#source-view').click();
  assert(await page.locator('#xml-source').isVisible(), 'DMN source inaccessible');
  await exit();
  await page.locator('#fullscreen').click();
  assert(await page.evaluate(() => document.fullscreenElement === document.querySelector('.workspace')), 'native Fullscreen API was not used');
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => document.querySelector('#fullscreen')?.getAttribute('aria-pressed') === 'false');
  assert(await page.locator('.doc-tabs').isVisible(), 'browser fullscreen exit did not restore layout');
  await enter();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#fullscreen')?.getAttribute('aria-pressed') === 'false', null, { timeout: 5000 });

  await page.evaluate(() => { Object.defineProperty(document.querySelector('.workspace'), 'requestFullscreen', { value: undefined, configurable: true }); });
  await page.locator('#fullscreen').click();
  assert(await page.locator('.workspace').evaluate(el => el.classList.contains('fullscreen-active') && !el.matches(':fullscreen')), 'fallback failed');
  await page.locator('#xml-source').focus();
  await page.keyboard.press('Escape');
  assert(await page.locator('#fullscreen').getAttribute('aria-pressed') === 'false', 'fallback Escape failed');
  await page.keyboard.press('Control+Shift+f');
  assert(await page.locator('#fullscreen').getAttribute('aria-pressed') === 'true', 'fullscreen shortcut failed');
  await page.keyboard.press('Control+Shift+f');

  for (const lang of ['en', 'fa']) for (const theme of ['light', 'dark']) {
    await page.evaluate(({ lang, theme }) => { localStorage.setItem('as-lang', lang); localStorage.setItem('as-theme', theme); }, { lang, theme });
    await page.reload();
    await page.locator('#fullscreen').waitFor();
    assert(await page.locator('#fullscreen').getAttribute('title') === (lang === 'fa' ? 'نمایش تمام‌صفحه' : 'Enter Fullscreen'), 'locale tooltip wrong');
    assert(await page.locator('html').getAttribute('dir') === (lang === 'fa' ? 'rtl' : 'ltr'), 'UI direction wrong');
    assert(await page.locator('html').getAttribute('data-theme') === theme, 'theme wrong');
    await enter();
    assert(await page.locator('#fullscreen').getAttribute('title') === (lang === 'fa' ? 'خروج از تمام‌صفحه' : 'Exit Fullscreen'), 'exit tooltip wrong');
    await exit();
  }
  assert(!errors.length, `browser errors: ${errors.join('; ')}`);
  console.log('Fullscreen smoke passed: graph, Mermaid, BPMN, DMN, fallback, shortcuts, locale, themes');
} finally { await browser.close(); }
