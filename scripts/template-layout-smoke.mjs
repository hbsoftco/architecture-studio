import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox'] });
const sizes = process.env.TEMPLATE_LAYOUT_SIZES?.split(',').map(Number) || [1440, 1250, 1024, 820, 600, 390];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
try {
  for (const width of sizes) {
    const context = await browser.newContext({ viewport:{width,height:Number(process.env.TEMPLATE_LAYOUT_HEIGHT || 820)} });
    const page = await context.newPage();
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
    if (process.env.TEMPLATE_LAYOUT_LANG || process.env.TEMPLATE_LAYOUT_THEME) {
      await page.evaluate(({language,theme}) => { if (language) localStorage.setItem('as-lang', language); if (theme) localStorage.setItem('as-theme', theme); }, { language:process.env.TEMPLATE_LAYOUT_LANG, theme:process.env.TEMPLATE_LAYOUT_THEME });
      await page.reload();
    }
    await page.locator(width <= 700 ? '#mobile-new-document' : '#new-document').click();
    await page.locator('#mode-templates').click();
    await page.locator('#template-results svg').first().waitFor();
    const report = await page.evaluate(() => {
      const rect = selector => { const node = document.querySelector(selector); const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom }; };
      const controls = ['#template-search','#template-source','#template-type','#template-category','#template-sort'].map(rect);
      return { controls, dialog:rect('.catalog-dialog .studio-dialog-box'), top:rect('.template-gallery-top'), footer:rect('.template-create-row'), folder:rect('#template-folder'), create:rect('.studio-dialog-actions'), card:rect('.template-card'), preview:rect('#template-full-preview'), scrollWidth:document.querySelector('.studio-dialog-box').scrollWidth };
    });
    if (process.env.TEMPLATE_LAYOUT_CAPTURE) await page.screenshot({path:`/tmp/gallery-${width}.png`});
    assert(report.dialog.x >= 0 && report.dialog.right <= width, `${width}px dialog overflows horizontally`);
    assert(report.footer.bottom <= report.create.y + 1, `${width}px creation fields overlap actions`);
    assert(report.create.bottom <= report.dialog.bottom + 1, `${width}px dialog actions are clipped`);
    assert(report.folder.w >= 105, `${width}px destination folder is too narrow`);
    assert(report.card.right <= report.dialog.right, `${width}px card overflows dialog`);
    if (width >= 1024) assert(report.controls.every(control => Math.abs(control.y - report.controls[0].y) < 1), `${width}px discovery controls wrap`);
    if (width <= 650 && Number(process.env.TEMPLATE_LAYOUT_HEIGHT || 820) <= 650) {
      await page.locator('#template-detail').evaluate(node => node.scrollIntoView({block:'start'}));
      assert(await page.locator('#template-full-preview').isVisible(), 'short viewport detail preview cannot be reached');
      assert(await page.locator('#template-diagram-name').isVisible(), 'short viewport diagram name is inaccessible');
    }
    if (width === 1250) {
      await page.locator('#template-search').fill('class');
      await page.locator('[data-template-id="mermaid-class"]').click();
      await page.locator('#template-full-preview svg').waitFor();
      if (process.env.TEMPLATE_LAYOUT_CAPTURE) await page.screenshot({path:'/tmp/gallery-class.png'});
      const overlaps = await page.locator('#template-full-preview svg').evaluate(svg => {
        const labels = [...svg.querySelectorAll('text')].map(node => ({ text:node.textContent.trim(), rect:node.getBoundingClientRect() })).filter(item => item.text);
        return labels.flatMap((a,i) => labels.slice(i+1).filter(b => Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>2 && Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>2).map(b => [a.text,b.text]));
      });
      assert(overlaps.length === 0, `class preview text overlaps: ${JSON.stringify(overlaps)}`);
      await page.locator('#template-search').fill('roles');
      await page.locator('[data-template-id="erd-users-roles"]').click();
      await page.locator('#template-full-preview svg text').first().waitFor();
      const contained = await page.locator('#template-full-preview svg').evaluate(svg => {
        const label = [...svg.querySelectorAll('text')].find(node => node.textContent.includes('Memberships'));
        const bounds = label?.previousElementSibling?.getBoundingClientRect(), text = label?.getBoundingClientRect();
        return Boolean(bounds && text && text.left >= bounds.left - 2 && text.right <= bounds.right + 2);
      });
      assert(contained, 'long ERD label escapes its source node');
      const narrow = await page.evaluate(async () => {
        const [{ builtInTemplates }, { templateThumbnail }] = await Promise.all([import('/src/template-library.js'), import('/src/template-preview.js')]);
        const template = builtInTemplates.find(item => item.id === 'erd-users-roles');
        const graph = JSON.parse(template.content);
        graph.nodes[0].w = 1;
        graph.nodes[0].label = 'Long untrusted label with many words';
        return (await templateThumbnail({ ...template, id:'tiny-node-smoke', content:JSON.stringify(graph) })).includes('<svg');
      });
      assert(narrow, 'narrow graph node prevented preview generation');
    }
    await context.close();
  }
  console.log('Template layout smoke passed: responsive filter and footer geometry, class and ERD previews');
} finally { await browser.close(); }
