import { TYPES } from './model.js';
import { catalog, guideSlides } from './catalog.js';
import { TEMPLATE_CATEGORIES, filterTemplates, validateTemplateMetadata } from './template-core.js';
import { builtInTemplates } from './template-library.js';
import { showTemplateThumbnail } from './template-preview.js';
import { importTemplates } from './template-package.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const words = {
  fa: { templates:'قالب‌ها', blank:'نمودار خالی', search:'جستجوی قالب‌ها', all:'همهٔ قالب‌ها', builtin:'آماده', mine:'قالب‌های من', allTypes:'همهٔ نوع‌ها', allCategories:'همهٔ دسته‌ها', recommended:'پیشنهادی', name:'نام', recent:'اخیراً استفاده‌شده', created:'تازه ساخته‌شده', source:'منبع', builtInSource:'قالب آماده', mySource:'قالب من', create:'ساخت از قالب', nameLabel:'نام نمودار تازه', folder:'پوشهٔ مقصد', root:'ریشهٔ پروژه', preview:'پیش‌نمایش واقعی', details:'کاربرد', guide:'راهنمای نمودار', next:'بعدی', previous:'قبلی', back:'بازگشت به قالب', noResults:'قالبی پیدا نشد. جستجو یا فیلترها را تغییر دهید.', noMine:'هنوز قالبی ذخیره نکرده‌اید. یک نمودار را باز کنید و «ذخیره به‌عنوان قالب» را بزنید.', more:'نمایش قالب‌های بیشتر', edit:'ویرایش قالب', duplicate:'تکثیر', remove:'حذف', export:'خروجی', exportAll:'خروجی همه', import:'ورود قالب', title:'نام قالب', description:'توضیح کوتاه', tags:'برچسب‌ها با ویرگول', category:'دسته', save:'ذخیره تغییرات', cancel:'انصراف', confirmDelete:'برای حذف این قالب دوباره کلیک کنید', confirm:'حذف قطعی', conflict:'شناسهٔ قالب تکراری است', copy:'ورود به‌صورت رونوشت', skip:'رد موارد تکراری', replace:'جایگزینی قالب من', importing:'ورود قالب‌ها', importConfirm:'ورود', fit:'اندازهٔ صفحه', zoomIn:'بزرگ‌نمایی', zoomOut:'کوچک‌نمایی', error:'عملیات انجام نشد' },
  en: { templates:'Templates', blank:'Blank Diagram', search:'Search templates', all:'All templates', builtin:'Built-in', mine:'My templates', allTypes:'All types', allCategories:'All categories', recommended:'Recommended', name:'Name', recent:'Recently used', created:'Recently created', source:'Source', builtInSource:'Built-in template', mySource:'My template', create:'Create from template', nameLabel:'New diagram name', folder:'Destination folder', root:'Project root', preview:'Actual preview', details:'How to use', guide:'Diagram guide', next:'Next', previous:'Previous', back:'Back to template', noResults:'No templates found. Change the search or filters.', noMine:'No saved templates yet. Open a diagram and choose “Save as Template”.', more:'Show more templates', edit:'Edit template', duplicate:'Duplicate', remove:'Delete', export:'Export', exportAll:'Export all', import:'Import templates', title:'Template name', description:'Short description', tags:'Comma-separated tags', category:'Category', save:'Save changes', cancel:'Cancel', confirmDelete:'Click again to delete this template', confirm:'Delete permanently', conflict:'Template IDs already exist', copy:'Import as copies', skip:'Skip duplicates', replace:'Replace my templates', importing:'Import templates', importConfirm:'Import', fit:'Fit view', zoomIn:'Zoom in', zoomOut:'Zoom out', error:'The operation failed' }
};

export function attachTemplateGallery({ content, dialog, submit, language, folders, getCustomTemplates, onCreate, onManage }) {
  const w = words[language];
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('as-template-gallery') || '{}'); } catch { return {}; } })();
  let mode = 'blank';
  let selectedId = builtInTemplates[0].id;
  let autoName = '';
  let zoom = 1;
  let guideStep = -1;
  let editOpen = false;
  let pendingDelete = false;
  let pendingImport = null;
  let visibleCount = 40;
  let observer;
  const tabs = document.createElement('div');
  tabs.className = 'template-mode-tabs';
  tabs.innerHTML = `<button id="mode-blank" type="button" class="btn btn-ghost btn-sm" aria-pressed="true">${w.blank}</button><button id="mode-templates" type="button" class="btn btn-ghost btn-sm" aria-pressed="false">${w.templates}</button>`;
  content.prepend(tabs);
  const blankNodes = [content.querySelector('.catalog-layout'), content.querySelector('.catalog-name-row')];
  const gallery = document.createElement('div');
  gallery.className = 'template-gallery'; gallery.hidden = true;
  gallery.innerHTML = `<div class="template-gallery-top"><label><span class="sr-only">${w.search}</span><input id="template-search" class="input input-sm" type="search" placeholder="${w.search}" autocomplete="off"></label><div class="template-gallery-filters"><select id="template-source" class="select select-sm" aria-label="${w.source}"><option value="all">${w.all}</option><option value="builtin">${w.builtin}</option><option value="custom">${w.mine}</option></select><select id="template-type" class="select select-sm" aria-label="${w.allTypes}"><option value="all">${w.allTypes}</option>${Object.entries(TYPES).map(([id,item]) => `<option value="${id}">${esc(item[language])}</option>`).join('')}</select><select id="template-category" class="select select-sm" aria-label="${w.category}"><option value="all">${w.allCategories}</option>${Object.entries(TEMPLATE_CATEGORIES).map(([id,item]) => `<option value="${id}">${esc(item[language])}</option>`).join('')}</select><select id="template-sort" class="select select-sm" aria-label="${w.recommended}"><option value="recommended">${w.recommended}</option><option value="name">${w.name}</option><option value="recent">${w.recent}</option><option value="created">${w.created}</option></select></div><div class="template-gallery-actions"><button id="template-import" class="btn btn-ghost btn-sm" type="button">⇣ ${w.import}</button><button id="template-export-all" class="btn btn-ghost btn-sm" type="button">⇧ ${w.exportAll}</button><input id="template-file" type="file" accept=".astpl,.zip" hidden></div></div><div class="template-gallery-layout"><div id="template-results" class="template-results" role="listbox" aria-label="${w.templates}"></div><div class="template-detail" id="template-detail" aria-live="polite"></div></div><p class="template-message" id="template-message" role="alert" hidden></p><div class="template-create-row"><label>${w.nameLabel}<input id="template-diagram-name" class="input input-sm" type="text" maxlength="120" required></label><label>${w.folder}<select id="template-folder" class="select select-sm"><option value="">${w.root}</option>${folders.map(folder => `<option value="${esc(folder.id)}">${esc(folder.name)}</option>`).join('')}</select></label></div>`;
  content.append(gallery);
  const $ = selector => gallery.querySelector(selector);
  const search = $('#template-search'), source = $('#template-source'), type = $('#template-type'), category = $('#template-category'), sort = $('#template-sort');
  for (const [control, key] of [[source,'source'],[type,'diagramType'],[category,'category'],[sort,'sort']]) if ([...control.options].some(option => option.value === prefs[key])) control.value = prefs[key];
  const name = $('#template-diagram-name');
  name.required = false;
  const message = (value, error = false) => { const node = $('#template-message'); node.hidden = !value; node.textContent = value || ''; node.classList.toggle('error', error); };
  const templates = () => {
    let usage = {};
    try { usage = JSON.parse(localStorage.getItem('as-template-use') || '{}'); } catch { /* Ignore malformed preferences. */ }
    return [...builtInTemplates, ...getCustomTemplates()].map(item => usage[item.id] && !item.lastUsedAt ? { ...item, lastUsedAt:usage[item.id] } : item);
  };
  const selected = () => templates().find(template => template.id === selectedId);
  const options = () => ({ query:search.value, source:source.value, diagramType:type.value, category:category.value, sort:sort.value, language });

  function setMode(next) {
    mode = next;
    tabs.querySelector('#mode-blank').setAttribute('aria-pressed', String(next === 'blank'));
    tabs.querySelector('#mode-templates').setAttribute('aria-pressed', String(next === 'templates'));
    for (const node of blankNodes) node.hidden = next !== 'blank';
    gallery.hidden = next !== 'templates';
    content.querySelector('#catalog-name').required = next === 'blank';
    name.required = next === 'templates';
    dialog.querySelector('#studio-dialog-description').textContent = next === 'templates'
      ? (language === 'fa' ? 'یک قالب واقعی را بررسی کنید و نمودار تازهٔ خود را از آن بسازید.' : 'Inspect a real template, then create a new diagram from it.')
      : (language === 'fa' ? 'نوع نمودار را انتخاب کنید، نمونه را ببینید و سپس آن را بسازید.' : 'Choose a diagram type, inspect its example, then create it.');
    submit.textContent = next === 'templates' ? w.create : (language === 'fa' ? 'ایجاد نمودار' : 'Create diagram');
    if (next === 'templates') { renderList(); renderDetail(); search.focus(); }
    else { submit.disabled = !content.querySelector('#catalog-results [data-catalog-id]'); message(''); content.querySelector('#catalog-search').focus(); }
  }
  tabs.querySelector('#mode-blank').onclick = () => setMode('blank');
  tabs.querySelector('#mode-templates').onclick = () => setMode('templates');

  function renderList() {
    observer?.disconnect();
    const matches = filterTemplates(templates(), options());
    if (!matches.some(item => item.id === selectedId)) selectedId = matches[0]?.id || null;
    const selectedIndex = matches.findIndex(item => item.id === selectedId);
    if (selectedIndex >= visibleCount) visibleCount = Math.ceil((selectedIndex + 1) / 40) * 40;
    const results = $('#template-results');
    results.innerHTML = matches.length ? matches.slice(0, visibleCount).map(item => `<button type="button" class="template-card ${item.id === selectedId ? 'selected' : ''}" data-template-id="${esc(item.id)}" role="option" aria-selected="${item.id === selectedId}"><span class="template-card-art" data-thumb="${esc(item.id)}" aria-hidden="true"><span class="template-card-loading">${esc(TYPES[item.diagramType][language])}</span></span><span class="template-card-copy"><strong>${esc(item.title[language])}</strong><small>${esc(item.description[language])}</small><span class="template-card-meta"><span>${esc(TYPES[item.diagramType].en)}</span><span>${item.source === 'builtin' ? w.builtin : w.mine}</span></span></span></button>`).join('') + (matches.length > visibleCount ? `<button id="template-more" class="btn btn-ghost" type="button">${w.more} (${matches.length - visibleCount})</button>` : '') : `<p class="template-empty">${source.value === 'custom' && !getCustomTemplates().length ? w.noMine : w.noResults}</p>`;
    results.querySelector('#template-more')?.addEventListener('click', () => { const top = results.scrollTop; visibleCount += 40; renderList(); results.scrollTop = top; });
    results.querySelectorAll('[data-template-id]').forEach(button => button.onclick = () => {
      selectedId = button.dataset.templateId; editOpen = false; pendingDelete = false; guideStep = -1; zoom = 1;
      if (name.value === autoName || !name.value) name.value = selected()?.title[language] || '';
      autoName = selected()?.title[language] || '';
      results.querySelectorAll('[data-template-id]').forEach(card => { const active = card.dataset.templateId === selectedId; card.classList.toggle('selected', active); card.setAttribute('aria-selected', String(active)); });
      renderDetail();
    });
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          const item = templates().find(candidate => candidate.id === entry.target.dataset.thumb);
          if (item) showTemplateThumbnail(item, entry.target);
        }
      }, { root:results, rootMargin:'100px' });
      results.querySelectorAll('[data-thumb]').forEach(node => observer.observe(node));
    } else results.querySelectorAll('[data-thumb]').forEach(node => {
      const item = templates().find(candidate => candidate.id === node.dataset.thumb);
      if (item) showTemplateThumbnail(item, node);
    });
    submit.disabled = !selectedId;
    $('#template-export-all').disabled = getCustomTemplates().length === 0;
    if (selectedId && (!name.value || name.value === autoName)) { autoName = selected().title[language]; name.value = autoName; }
  }

  async function action(kind, payload) {
    try {
      message('');
      await onManage(kind, payload);
      pendingDelete = false; editOpen = false; pendingImport = null;
      renderList(); renderDetail();
    } catch (error) { message(error.message || w.error, true); }
  }

  function renderDetail() {
    const item = selected(), detail = $('#template-detail');
    if (!item) { detail.innerHTML = `<p class="template-empty">${w.noResults}</p>`; return; }
    if (guideStep >= 0 && item.guideId) {
      const guideItem = catalog.find(entry => entry.id === item.guideId);
      if (guideItem) {
        const slides = guideSlides(guideItem, language);
        detail.innerHTML = `<div class="template-guide"><button id="template-guide-back" class="btn btn-ghost btn-sm" type="button">← ${w.back}</button><p class="template-eyebrow">${esc(guideItem.title[language])} · ${guideStep + 1}/${slides.length}</p><h3>${esc(slides[guideStep].title)}</h3><p>${esc(slides[guideStep].text)}</p><div class="template-guide-actions"><button id="template-guide-prev" class="btn btn-ghost btn-sm" type="button" ${guideStep === 0 ? 'disabled' : ''}>${w.previous}</button><button id="template-guide-next" class="btn btn-primary btn-sm" type="button" ${guideStep === slides.length - 1 ? 'disabled' : ''}>${w.next}</button></div></div>`;
        detail.querySelector('#template-guide-back').onclick = () => { guideStep = -1; renderDetail(); };
        detail.querySelector('#template-guide-prev').onclick = () => { guideStep--; renderDetail(); };
        detail.querySelector('#template-guide-next').onclick = () => { guideStep++; renderDetail(); };
        return;
      }
    }
    if (editOpen && item.source === 'custom') {
      detail.innerHTML = `<div id="template-edit-form" class="template-edit-form"><h3>${w.edit}</h3><label>${w.title}<input name="title" class="input input-sm" maxlength="120" value="${esc(item.title[language])}"></label><label>${w.description}<textarea name="description" class="textarea textarea-sm" maxlength="500">${esc(item.description[language])}</textarea></label><label>${w.tags}<input name="tags" class="input input-sm" value="${esc(item.tags.join(', '))}"></label><label>${w.category}<select name="category" class="select select-sm">${Object.entries(TEMPLATE_CATEGORIES).map(([id,entry]) => `<option value="${id}" ${id === item.category ? 'selected' : ''}>${esc(entry[language])}</option>`).join('')}</select></label><div class="template-detail-actions"><button id="template-edit-save" class="btn btn-primary btn-sm" type="button">${w.save}</button><button id="template-edit-cancel" class="btn btn-ghost btn-sm" type="button">${w.cancel}</button></div></div>`;
      detail.querySelector('#template-edit-cancel').onclick = () => { editOpen = false; renderDetail(); };
      detail.querySelector('#template-edit-save').onclick = () => {
        const form = detail.querySelector('#template-edit-form');
        const field = key => form.querySelector(`[name="${key}"]`).value.trim();
        const changed = { ...item, title:{ fa:field('title'), en:field('title') }, description:{ fa:field('description'), en:field('description') }, details:{ fa:field('description'), en:field('description') }, tags:field('tags').split(',').map(tag => tag.trim()).filter(Boolean), category:field('category'), updatedAt:new Date().toISOString() };
        try { validateTemplateMetadata(changed); action('update', changed); } catch (error) { message(error.message, true); }
      };
      return;
    }
    detail.innerHTML = `<div class="template-detail-header"><p class="template-eyebrow">${esc(TEMPLATE_CATEGORIES[item.category][language])} · ${esc(TYPES[item.diagramType].en)}</p><h3>${esc(item.title[language])}</h3><p>${esc(item.description[language])}</p></div><div class="template-detail-art"><div id="template-full-preview" dir="ltr" role="img" aria-label="${esc(w.preview)}"></div></div><div class="template-zoom"><button id="template-zoom-out" class="btn btn-xs btn-ghost" type="button" aria-label="${w.zoomOut}">−</button><button id="template-fit" class="btn btn-xs btn-ghost" type="button">${w.fit}</button><button id="template-zoom-in" class="btn btn-xs btn-ghost" type="button" aria-label="${w.zoomIn}">＋</button></div><p class="template-detail-description"><strong>${w.details}</strong> ${esc(item.details[language])}</p><div class="template-tags">${item.tags.map(tag => `<span dir="auto">${esc(tag)}</span>`).join('')}</div><p class="template-source">${w.source}: ${item.source === 'builtin' ? w.builtInSource : w.mySource} · ${esc(item.sourceFormat.toUpperCase())} · v${item.version}</p><div class="template-detail-actions">${item.guideId ? `<button id="template-guide" class="btn btn-ghost btn-sm" type="button">ⓘ ${w.guide}</button>` : ''}${item.source === 'custom' ? `<button id="template-edit" class="btn btn-ghost btn-sm" type="button">${w.edit}</button><button id="template-duplicate" class="btn btn-ghost btn-sm" type="button">${w.duplicate}</button><button id="template-export" class="btn btn-ghost btn-sm" type="button">${w.export}</button><button id="template-delete" class="btn btn-error btn-soft btn-sm" type="button">${pendingDelete ? w.confirm : w.remove}</button>` : ''}</div>${pendingDelete ? `<p class="template-delete-warning">${w.confirmDelete} <button id="template-delete-cancel" class="btn btn-ghost btn-xs" type="button">${w.cancel}</button></p>` : ''}`;
    const previewHost = detail.querySelector('#template-full-preview');
    showTemplateThumbnail(item, previewHost).then(() => { if (previewHost.isConnected) previewHost.style.zoom = String(zoom); });
    detail.querySelector('#template-zoom-in').onclick = () => { zoom = Math.min(2, zoom * 1.2); previewHost.style.zoom = String(zoom); };
    detail.querySelector('#template-zoom-out').onclick = () => { zoom = Math.max(.5, zoom / 1.2); previewHost.style.zoom = String(zoom); };
    detail.querySelector('#template-fit').onclick = () => { zoom = 1; previewHost.style.zoom = '1'; };
    detail.querySelector('#template-guide')?.addEventListener('click', () => { guideStep = 0; renderDetail(); });
    detail.querySelector('#template-edit')?.addEventListener('click', () => { editOpen = true; renderDetail(); });
    detail.querySelector('#template-duplicate')?.addEventListener('click', () => action('duplicate', item));
    detail.querySelector('#template-export')?.addEventListener('click', () => action('export', [item]));
    detail.querySelector('#template-delete')?.addEventListener('click', () => { if (pendingDelete) action('delete', item); else { pendingDelete = true; renderDetail(); } });
    detail.querySelector('#template-delete-cancel')?.addEventListener('click', () => { pendingDelete = false; renderDetail(); });
  }

  for (const control of [source,type,category,sort]) control.onchange = () => {
    visibleCount = 40;
    localStorage.setItem('as-template-gallery', JSON.stringify({ source:source.value, diagramType:type.value, category:category.value, sort:sort.value }));
    renderList(); renderDetail();
  };
  search.oninput = () => { visibleCount = 40; renderList(); renderDetail(); };
  search.onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); };
  $('#template-results').onkeydown = event => {
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    const cards = [...$('#template-results').querySelectorAll('[data-template-id]')];
    const index = cards.indexOf(document.activeElement);
    const next = cards[Math.max(0, Math.min(cards.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
    if (next) { event.preventDefault(); next.focus(); }
  };
  $('#template-import').onclick = () => $('#template-file').click();
  $('#template-export-all').onclick = () => action('export', getCustomTemplates());
  $('#template-file').onchange = async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    try {
      const incoming = await importTemplates(file);
      const known = new Set(templates().map(item => item.id));
      const conflicts = incoming.filter(item => known.has(item.id));
      if (!conflicts.length) return action('import', { templates:incoming, policy:'skip' });
      pendingImport = incoming;
      gallery.querySelector('.template-import-choice')?.remove();
      message(`${w.conflict}: ${conflicts.length}`);
      const row = document.createElement('div'); row.className = 'template-import-choice';
      row.innerHTML = `<label>${w.importing}<select class="select select-sm" id="template-conflict"><option value="copy">${w.copy}</option><option value="skip">${w.skip}</option><option value="replace">${w.replace}</option></select></label><button id="template-import-confirm" class="btn btn-primary btn-sm" type="button">${w.importConfirm}</button><button id="template-import-cancel" class="btn btn-ghost btn-sm" type="button">${w.cancel}</button>`;
      $('#template-message').after(row);
      row.querySelector('#template-import-confirm').onclick = () => { const policy = row.querySelector('select').value; row.remove(); action('import', { templates:pendingImport, policy }); };
      row.querySelector('#template-import-cancel').onclick = () => { row.remove(); pendingImport = null; message(''); };
    } catch (error) { message(error.message, true); }
  };

  return {
    get mode() { return mode; },
    async create() {
      const item = selected();
      if (!item) throw new Error(w.noResults);
      const documentName = name.value.trim();
      if (!documentName) throw new Error(w.nameLabel);
      await onCreate(item, documentName, $('#template-folder').value || null);
    },
    showTemplates() { setMode('templates'); },
    destroy() { observer?.disconnect(); }
  };
}
