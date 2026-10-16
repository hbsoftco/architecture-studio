import { TYPES } from './model.js';
import { catalog, categoryNames, searchCatalog, previewSvg, guideSlides } from './catalog.js';
import { attachTemplateGallery } from './template-gallery.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function openDiagramCatalog(dialogs, language, onCreate, templateOptions = {}) {
  const fa = language === 'fa';
  const word = (persian, english) => fa ? persian : english;
  let selected = catalog.find(item => item.id === 'bpmn') || catalog[0];
  let guideOpen = false;
  let slide = 0;
  let autoName = selected.title[language];
  let templateGallery;

  return dialogs.open({
    className: 'catalog-dialog',
    title: word('نمودار تازه', 'New diagram'),
    description: word('نوع نمودار را انتخاب کنید، نمونه را ببینید و سپس آن را بسازید.', 'Choose a diagram type, inspect its example, then create it.'),
    confirmLabel: word('ایجاد نمودار', 'Create diagram'),
    initialFocus: dialog => dialog.querySelector('#catalog-search'),
    render({ content, dialog, submit }) {
      dialog.dir = fa ? 'rtl' : 'ltr';
      content.innerHTML = `<div class="catalog-layout">
        <section class="catalog-list-pane" aria-label="${word('فهرست نمودارها', 'Diagram catalog')}">
          <label class="catalog-search-label"><span class="sr-only">${word('جستجوی نمودار', 'Search diagrams')}</span><input id="catalog-search" class="input" type="search" placeholder="${word('جستجو: BPMN، توالی، پایگاه داده…', 'Search: BPMN, sequence, database…')}" autocomplete="off"></label>
          <div id="catalog-results" class="catalog-results" role="listbox"></div>
        </section>
        <section class="catalog-preview-pane" aria-live="polite"><div id="catalog-preview"></div></section>
        <aside class="catalog-guide" id="catalog-guide" aria-label="${word('راهنمای نمودار', 'Diagram guide')}" aria-hidden="true"></aside>
      </div>
      <div class="catalog-name-row"><label for="catalog-name">${word('نام نمودار', 'Diagram name')}</label><input id="catalog-name" class="input" name="diagramName" type="text" required maxlength="120" value="${escapeHtml(autoName)}"><span id="catalog-selected-type"></span></div>`;
      const results = content.querySelector('#catalog-results');
      const preview = content.querySelector('#catalog-preview');
      const guide = content.querySelector('#catalog-guide');
      guide.inert = true;
      const name = content.querySelector('#catalog-name');
      const search = content.querySelector('#catalog-search');
      const typeLabel = content.querySelector('#catalog-selected-type');

      function renderList() {
        const matches = searchCatalog(search.value, language);
        submit.disabled = matches.length === 0;
        if (!matches.length) { results.innerHTML = `<p class="catalog-empty">${word('نموداری پیدا نشد. نام فارسی، انگلیسی یا کاربرد را امتحان کنید.', 'No diagrams found. Try a name, category, or use case.')}</p>`; return; }
        const groups = Object.keys(categoryNames).map(category => [ category, matches.filter(item => item.category === category) ]).filter(([, items]) => items.length);
        results.innerHTML = groups.map(([category, items]) => `<div class="catalog-group" role="group" aria-label="${categoryNames[category][language]}"><h3>${categoryNames[category][language]}</h3>${items.map(item => `<button type="button" class="catalog-item ${item.id === selected.id ? 'selected' : ''}" data-catalog-id="${item.id}" role="option" aria-selected="${item.id === selected.id}"><span class="catalog-icon" aria-hidden="true">${item.icon}</span><span class="catalog-item-copy"><strong>${item.title[language]}</strong><small>${item.description[language]}</small></span><span class="catalog-capability">${TYPES[item.type].mode === 'source-preview' ? word('متنی', 'Source') : word('دیداری', 'Visual')}</span></button>`).join('')}</div>`).join('');
        results.querySelectorAll('[data-catalog-id]').forEach(button => button.onclick = () => select(button.dataset.catalogId));
      }

      function renderPreview() {
        typeLabel.textContent = `${selected.title[language]} · ${TYPES[selected.type].mode === 'source-preview' ? word('ویرایش متنی', 'Source editor') : word('ویرایش دیداری', 'Visual editor')}`;
        preview.innerHTML = `<div class="catalog-preview-heading"><span class="catalog-preview-icon">${selected.icon}</span><div><p class="catalog-eyebrow">${categoryNames[selected.category][language]}</p><h3>${selected.title[language]}</h3></div></div>
          <div class="catalog-art" dir="ltr">${previewSvg(selected)}</div>
          <p class="catalog-description">${selected.description[language]}</p>
          <div class="catalog-use"><strong>${word('مناسب برای', 'Use it for')}</strong><span>${selected.use[language]}</span></div>
          <button id="catalog-learn" class="btn btn-ghost catalog-learn" type="button">ⓘ ${word('راهنمای گام‌به‌گام', 'Step-by-step guide')}</button>`;
        preview.querySelector('svg').setAttribute('aria-label', `${selected.title[language]} — ${word('نمونهٔ نمودار','diagram example')}`);
        preview.querySelector('#catalog-learn').onclick = () => showGuide(true);
      }

      function renderGuide() {
        const slides = guideSlides(selected, language);
        const current = slides[slide];
        guide.innerHTML = `<div class="catalog-guide-head"><div><span class="catalog-eyebrow">${selected.title[language]}</span><h3>${word('راهنمای کاربردی', 'Practical guide')}</h3></div><button id="catalog-guide-close" class="btn btn-ghost btn-sm" type="button" aria-label="${word('بستن راهنما', 'Close guide')}">×</button></div>
          <div class="catalog-guide-body"><div class="catalog-guide-progress"><span>${word('گام', 'Slide')} ${slide + 1} / ${slides.length}</span><div class="catalog-progress-track"><i style="width:${((slide + 1) / slides.length) * 100}%"></i></div></div><h4>${current.title}</h4><p>${current.text}</p><div class="catalog-guide-visual" dir="ltr">${previewSvg(selected)}</div>${slide === slides.length - 1 ? `<div class="catalog-related">${selected.related.map(id => { const item = catalog.find(entry => entry.id === id); return item ? `<button class="btn btn-sm btn-ghost" type="button" data-related="${id}">${item.title[language]}</button>` : ''; }).join('')}</div>` : ''}</div>
          <div class="catalog-guide-actions"><button id="catalog-guide-prev" class="btn btn-ghost" type="button" ${slide === 0 ? 'disabled' : ''}>${word('قبلی', 'Previous')}</button><button id="catalog-guide-next" class="btn btn-primary" type="button" ${slide === slides.length - 1 ? 'disabled' : ''}>${word('بعدی', 'Next')}</button></div>`;
        guide.querySelector('svg').setAttribute('aria-label', `${selected.title[language]} — ${word('نمونهٔ نمودار','diagram example')}`);
        guide.querySelector('#catalog-guide-close').onclick = () => showGuide(false);
        guide.querySelector('#catalog-guide-prev').onclick = () => { slide = Math.max(0, slide - 1); renderGuide(); guide.querySelector('#catalog-guide-prev').focus(); };
        guide.querySelector('#catalog-guide-next').onclick = () => { slide = Math.min(slides.length - 1, slide + 1); renderGuide(); guide.querySelector('#catalog-guide-next').focus(); };
        guide.querySelectorAll('[data-related]').forEach(button => button.onclick = () => { select(button.dataset.related); slide = 0; renderGuide(); guide.querySelector('#catalog-guide-close').focus(); });
      }

      function showGuide(open) {
        guideOpen = open;
        guide.inert = !open;
        for (const element of [content.querySelector('.catalog-list-pane'), content.querySelector('.catalog-preview-pane'), content.querySelector('.catalog-name-row'), dialog.querySelector('.studio-dialog-actions')]) element.inert = open;
        guide.classList.toggle('open', open);
        guide.setAttribute('aria-hidden', String(!open));
        if (open) { slide = 0; renderGuide(); guide.querySelector('#catalog-guide-close').focus(); }
        else preview.querySelector('#catalog-learn').focus();
      }

      function select(id) {
        const next = catalog.find(item => item.id === id);
        if (!next) return;
        if (!searchCatalog(search.value, language).includes(next)) search.value = '';
        const wasDefault = name.value === autoName;
        selected = next;
        autoName = selected.title[language];
        if (wasDefault) name.value = autoName;
        renderList(); renderPreview();
        if (guideOpen) { slide = 0; renderGuide(); }
        submit.disabled = false;
      }

      search.oninput = () => {
        const matches = searchCatalog(search.value, language);
        if (matches.length && !matches.includes(selected)) {
          const wasDefault = name.value === autoName;
          selected = matches[0]; autoName = selected.title[language];
          if (wasDefault) name.value = autoName;
          renderPreview();
          if (guideOpen) { slide = 0; renderGuide(); }
        }
        renderList();
      };
      search.onkeydown = event => { if (event.key === 'Enter') event.preventDefault(); };
      results.onkeydown = event => {
        if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
        const items = [...results.querySelectorAll('[data-catalog-id]')];
        const index = items.indexOf(document.activeElement);
        const next = items[Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
        if (next) { event.preventDefault(); next.focus(); }
      };
      dialog.addEventListener('cancel', event => {
        if (!guideOpen) return;
        event.preventDefault(); event.stopImmediatePropagation(); showGuide(false);
      }, true);
      dialog.addEventListener('keydown', event => {
        if (!guideOpen || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
        const forward = fa ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
        slide = Math.max(0, Math.min(8, slide + (forward ? 1 : -1)));
        renderGuide(); event.preventDefault();
      });
      renderList(); renderPreview();
      if (templateOptions.getCustomTemplates) templateGallery = attachTemplateGallery({ content, dialog, submit, language,
        folders: templateOptions.folders || [], getCustomTemplates: templateOptions.getCustomTemplates,
        onCreate: templateOptions.onCreateTemplate, onManage: templateOptions.onManage });
    },
    async onConfirm({ content }) {
      if (templateGallery?.mode === 'templates') { await templateGallery.create(); return true; }
      const name = content.querySelector('#catalog-name').value.trim();
      if (!name) throw new Error(word('نام نمودار را وارد کنید.', 'Enter a diagram name.'));
      await onCreate(selected, name);
      return true;
    }
  }).finally(() => templateGallery?.destroy());
}
