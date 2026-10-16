import './style.css';
import { TYPES, MERMAID_EXAMPLES, createProject, createDocument, uid, validateProject, validateGraph } from './model.js';
import { openDatabase, allProjects, saveProject, deleteProject, history, allTemplates, saveTemplate, saveTemplates, removeTemplate } from './storage.js';
import { projectZip, importProjectZip, download, exportPng } from './export.js';
import { GraphEditor } from './graph-editor.js';
import { createDialogs, createNotifications } from './dialogs.js';
import { openDiagramCatalog } from './diagram-creation.js';
import { createCatalogDocument } from './catalog.js';
import { builtInTemplates } from './template-library.js';
import { TEMPLATE_CATEGORIES, instantiateTemplate, customTemplateFromDocument, validateTemplateMetadata } from './template-core.js';
import { templateThumbnail } from './template-preview.js';
import { exportTemplates } from './template-package.js';
import { validateXMLDocument } from './xml-validation.js';
import fontUrl from 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?url';

const app = document.querySelector('#app');
const state = { db: null, projects: [], templates: [], project: null, docId: null, tabs: [], editor: null, dirty: false, saveTimer: null, renderTimer: null, lang: localStorage.getItem('as-lang') || 'fa', theme: localStorage.getItem('as-theme') || 'light' };
let fullscreenFallback = false;
let fullscreenFocus = null;
let fullscreenPanelOpen = false;
const fullscreenIcons = {
  enter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>',
  exit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>'
};
const dialogs = createDialogs(() => state.lang);
const notifications = createNotifications(() => document.querySelector('#toast'));
const labels = {
  fa: { newProject:'پروژهٔ جدید', newDoc:'نمودار جدید', folder:'پوشهٔ جدید', import:'ورود', export:'خروجی پروژه', search:'جست‌وجوی نمودارها', inspector:'ویژگی‌ها', problems:'مسائل', ready:'آماده', saved:'ذخیره شد', saving:'در حال ذخیره…', source:'کد منبع', preview:'پیش‌نمایش', canvas:'بوم طراحی', empty:'یک نمودار از فهرست باز کنید یا نمودار تازه بسازید.', settings:'تنظیمات', rename:'تغییر نام', duplicate:'تکثیر', remove:'حذف', exportDoc:'خروجی سند', addNode:'عنصر', connect:'اتصال', fit:'اندازهٔ صفحه', light:'روشن', dark:'تاریک' },
  en: { newProject:'New project', newDoc:'New diagram', folder:'New folder', import:'Import', export:'Export project', search:'Search diagrams', inspector:'Properties', problems:'Problems', ready:'Ready', saved:'Saved', saving:'Saving…', source:'Source', preview:'Preview', canvas:'Canvas', empty:'Open a diagram or create a new one.', settings:'Settings', rename:'Rename', duplicate:'Duplicate', remove:'Delete', exportDoc:'Export document', addNode:'Node', connect:'Connect', fit:'Fit', light:'Light', dark:'Dark' },
};
const t = key => labels[state.lang][key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const doc = () => state.project?.documents.find(item => item.id === state.docId);
const safeName = value => String(value).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'diagram';

function notify(message, error = false) {
  (error ? notifications.error : notifications.success)(message);
}
const ui = (fa, en) => state.lang === 'fa' ? fa : en;
function renderShell() {
  state.editor?.destroy?.(); state.editor = null;
  document.documentElement.lang = state.lang === 'fa' ? 'fa' : 'en';
  document.documentElement.dir = state.lang === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = state.theme;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand"><div class="brand-mark" aria-hidden="true">◇</div><div><strong>${state.lang === 'fa' ? 'استودیوی معماری' : 'Architecture Studio'}</strong><small>${state.lang === 'fa' ? 'فضای کار محلی' : 'Local workspace'}</small></div></div>
        <span class="top-divider"></span>
        <select id="project-select" class="select select-sm" aria-label="Project">${state.projects.map(p => `<option value="${esc(p.id)}" ${p.id === state.project?.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <button id="new-project" class="btn btn-sm btn-ghost" title="${t('newProject')}">＋ ${t('newProject')}</button>
        <button id="project-actions" class="btn btn-sm btn-ghost" title="Project actions">⋯</button>
        <button id="mobile-new-document" class="btn btn-sm btn-primary" title="${t('newDoc')}" aria-label="${t('newDoc')}">＋</button>
        <div class="top-spacer"></div>
        <span class="offline-indicator"><span></span>${state.lang === 'fa' ? 'محلی و آفلاین' : 'Local & offline'}</span>
        <button id="theme" class="btn btn-sm btn-ghost" title="Theme">${state.theme === 'light' ? '☾' : '☀'}</button>
        <button id="language" class="btn btn-sm btn-ghost">${state.lang === 'fa' ? 'EN' : 'فا'}</button>
        <button id="export-project" class="btn btn-sm btn-primary">${t('export')}</button>
      </header>
      <div class="workspace">
        <aside class="sidebar">
          <div class="sidebar-head"><span>${state.lang === 'fa' ? 'کاوشگر پروژه' : 'Project explorer'}</span><button id="new-folder" class="btn btn-xs btn-ghost" title="${t('folder')}">＋</button></div>
          <div class="search-wrap"><input id="search" class="input input-sm" type="search" placeholder="${t('search')}" aria-label="${t('search')}"></div>
          <div id="explorer" class="explorer"></div>
          <div class="sidebar-actions"><button id="new-document" class="btn btn-sm btn-primary">＋ ${t('newDoc')}</button><button id="import" class="btn btn-sm btn-ghost">⇣ ${t('import')}</button><input id="file-input" type="file" multiple hidden accept=".zip,.mmd,.bpmn,.dmn,.json,.xml"></div>
        </aside>
        <main class="main"><div id="tabs" class="doc-tabs"></div><div id="toolbar" class="toolbar"></div><div id="editor-area" class="editor-area"></div><div id="status" class="statusbar"></div></main>
        <aside class="inspector"><div class="inspector-head">${t('inspector')}</div><div id="properties" class="properties"></div><div class="inspector-head problems-head">${state.lang === 'fa' ? 'نمودارهای مرتبط' : 'Related diagrams'}</div><div id="links" class="links"></div><div class="inspector-head problems-head">${t('problems')}</div><div id="problems" class="problems">${state.lang === 'fa' ? 'موردی یافت نشد' : 'No problems'}</div></aside>
        <div id="toast" class="toast-note" role="status"></div>
      </div>
    </div>`;
  bindShell();
  renderExplorer(); renderTabs(); renderEditor();
}
function workspace() { return document.querySelector('.workspace'); }
function isFullscreen() { return Boolean(fullscreenFallback || (workspace() && document.fullscreenElement === workspace())); }
function resizeEditor() { requestAnimationFrame(() => requestAnimationFrame(() => state.editor?.resize?.())); }
function syncFullscreen() {
  const active = isFullscreen();
  const root = workspace();
  if (!root) return;
  root.classList.toggle('fullscreen-active', active);
  if (!active) { fullscreenPanelOpen = false; root.classList.remove('fullscreen-panel-open'); }
  else root.classList.toggle('fullscreen-panel-open', fullscreenPanelOpen);
  const button = document.querySelector('#fullscreen');
  if (button) {
    const label = active ? ui('خروج از تمام‌صفحه', 'Exit Fullscreen') : ui('نمایش تمام‌صفحه', 'Enter Fullscreen');
    button.innerHTML = active ? fullscreenIcons.exit : fullscreenIcons.enter;
    button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('btn-active', active);
  }
  const panel = document.querySelector('#fullscreen-properties');
  if (panel) { panel.hidden = !active; panel.setAttribute('aria-expanded', String(fullscreenPanelOpen)); panel.classList.toggle('btn-active', fullscreenPanelOpen); }
  resizeEditor();
}
async function toggleFullscreen() {
  const root = workspace();
  if (!root || !doc()) return;
  if (isFullscreen()) {
    if (document.fullscreenElement === root) {
      try { await document.exitFullscreen(); } catch { fullscreenFallback = false; syncFullscreen(); }
    } else { fullscreenFallback = false; syncFullscreen(); }
    (document.querySelector('#fullscreen') || fullscreenFocus)?.focus();
    return;
  }
  fullscreenFocus = document.activeElement;
  try {
    if (!root.requestFullscreen) throw new Error('Fullscreen API unavailable');
    await root.requestFullscreen();
  } catch { fullscreenFallback = true; }
  syncFullscreen();
  document.querySelector('#fullscreen')?.focus();
}
function onFullscreenChange() {
  if (document.fullscreenElement !== workspace()) fullscreenFallback = false;
  syncFullscreen();
  if (!isFullscreen()) (document.querySelector('#fullscreen') || fullscreenFocus)?.focus();
}
function bindShell() {
  document.querySelector('#new-project').onclick = () => dialogs.input({ title: t('newProject'), fields: [{ name: 'name', label: ui('نام پروژه', 'Project name'), required: true }], confirmLabel: ui('ایجاد پروژه', 'Create project'), async onConfirm({ name }) { const project = createProject(name); await saveProject(state.db, project); state.projects.push(project); state.project = project; state.docId = null; state.tabs = []; remember(); renderShell(); } });
  document.querySelector('#project-actions').onclick = projectActions;
  document.querySelector('#mobile-new-document').onclick = newDocument;
  document.querySelector('#project-select').onchange = event => { selectProject(event.target.value); };
  document.querySelector('#theme').onclick = () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('as-theme', state.theme); renderShell(); };
  document.querySelector('#language').onclick = () => { state.lang = state.lang === 'fa' ? 'en' : 'fa'; localStorage.setItem('as-lang', state.lang); renderShell(); };
  document.querySelector('#new-folder').onclick = () => dialogs.input({ title: t('folder'), fields: [{ name:'name', label: ui('نام پوشه', 'Folder name'), required:true }], confirmLabel: ui('ایجاد پوشه', 'Create folder'), onConfirm({ name }) { state.project.folders.push({ id: uid(), name, parentId: null }); changed(); renderExplorer(); } });
  document.querySelector('#new-document').onclick = newDocument;
  document.querySelector('#search').oninput = renderExplorer;
  document.querySelector('#import').onclick = () => document.querySelector('#file-input').click();
  document.querySelector('#file-input').onchange = async event => { for (const file of event.target.files) { try { await importFile(file); } catch (error) { notify(`${file.name}: ${error.message}`, true); } } event.target.value = ''; };
  document.querySelector('#export-project').onclick = async () => { try { await flush(); download(await projectZip(state.project), `${safeName(state.project.name)}.zip`); notify(t('saved')); } catch (error) { notify(error.message, true); } };
}
async function projectActions() {
  const action = await dialogs.choose({ title: ui('کارهای پروژه', 'Project actions'), items: [ ['new',t('newProject')], ['rename',t('rename')], ['duplicate',t('duplicate')], ['history',ui('تاریخچه', 'History')], ['storage',ui('فضای ذخیره', 'Storage')], ['delete',t('remove')] ].map(([value,label]) => ({ value,label })), value:'rename' });
  if (action === 'new') document.querySelector('#new-project').click();
  else if (action === 'rename') await dialogs.input({ title: ui('تغییر نام پروژه', 'Rename project'), fields:[{ name:'name', label:ui('نام پروژه','Project name'), value:state.project.name, required:true }], confirmLabel:t('rename'), onConfirm({ name }) { state.project.name = name; changed(); renderShell(); } });
  else if (action === 'duplicate') {
    const clone = structuredClone(state.project);
    clone.id = uid(); clone.name += ' copy'; clone.createdAt = new Date().toISOString();
    await saveProject(state.db, clone); state.projects.push(clone); await selectProject(clone.id);
  } else if (action === 'history') {
    const snapshots = await history(state.db, state.project.id);
    if (!snapshots.length) return dialogs.info({ title: ui('تاریخچه', 'History'), description: ui('هنوز نسخه‌ای ثبت نشده است.', 'No snapshots yet.') });
    const choice = await dialogs.choose({ title:ui('بازیابی نسخه', 'Restore snapshot'), items:snapshots.map(entry => ({ value:entry.id, label:new Date(entry.createdAt).toLocaleString(state.lang === 'fa' ? 'fa-IR' : 'en-US') })) });
    if (!choice) return;
    const snapshot = snapshots.find(entry => entry.id === choice);
    if (!snapshot) return;
    await dialogs.confirm({ title:ui('بازیابی نسخه', 'Restore snapshot'), description:ui('نسخهٔ فعلی پیش از بازیابی ذخیره می‌شود. ادامه می‌دهید؟', 'The current version will be saved before restoration. Continue?'), destructive:true, confirmLabel:ui('بازیابی', 'Restore'), async onConfirm() {
      await flush(true);
      const restored = structuredClone(snapshot.value);
      await saveProject(state.db, restored);
      state.projects[state.projects.findIndex(project => project.id === restored.id)] = restored;
      state.project = restored; state.docId = null; state.tabs = [];
      remember(); renderShell();
    } });
  } else if (action === 'storage') {
    const estimate = await navigator.storage?.estimate?.();
    await dialogs.info({ title:ui('فضای ذخیره', 'Storage'), description:estimate ? `${(estimate.usage / 1024 ** 2).toFixed(1)} MiB / ${(estimate.quota / 1024 ** 2).toFixed(0)} MiB` : ui('اطلاعات فضای ذخیره در دسترس نیست.', 'Storage estimate unavailable.') });
  } else if (action === 'delete') {
    await dialogs.confirm({ title:ui('حذف پروژه', 'Delete project'), description:ui(`پروژهٔ «${state.project.name}» و نسخه‌های ذخیره‌شدهٔ آن حذف می‌شود.`, `Delete “${state.project.name}” and its saved snapshots?`), destructive:true, confirmLabel:t('remove'), async onConfirm() {
      const id = state.project.id;
      if (state.projects.length === 1) {
        const replacement = createProject(ui('پروژهٔ من', 'My project'));
        await saveProject(state.db, replacement);
        state.projects.push(replacement);
      }
      await deleteProject(state.db, id);
      state.projects = state.projects.filter(project => project.id !== id);
      await selectProject(state.projects[0].id);
    } });
  }
}
function remember() { localStorage.setItem('as-session', JSON.stringify({ projectId: state.project?.id, tabs: state.tabs, docId: state.docId })); }
async function preserveActive() {
  const active = doc();
  if (active && state.editor?.getContent) {
    const content = await contentNow();
    if (content && content !== active.content) { active.content = content; changed(); }
  }
  if (state.dirty) await flush();
}
async function selectProject(id) {
  await preserveActive();
  state.editor?.destroy?.(); state.editor = null;
  state.project = state.projects.find(p => p.id === id);
  state.docId = null; state.tabs = [];
  remember(); renderShell();
}
function renderExplorer() {
  const root = document.querySelector('#explorer');
  const query = document.querySelector('#search').value.toLocaleLowerCase();
  const rows = [];
  const addDocs = folderId => {
    for (const item of state.project.documents.filter(d => d.folderId === folderId && d.name.toLocaleLowerCase().includes(query))) rows.push(`<div class="tree-row doc-row ${item.id === state.docId ? 'active' : ''}" data-id="${esc(item.id)}"><span class="tree-icon">${item.type === 'mermaid' ? '⌘' : item.type === 'bpmn' ? '◇' : item.type === 'dmn' ? '▦' : '⬡'}</span><span class="tree-name">${esc(item.name)}</span><small>${esc(TYPES[item.type].en)}</small></div>`);
  };
  addDocs(null);
  for (const folder of state.project.folders) { rows.push(`<div class="tree-row folder-row" data-id="${esc(folder.id)}"><span class="tree-icon">▣</span><span class="tree-name">${esc(folder.name)}</span></div>`); addDocs(folder.id); }
  root.innerHTML = rows.join('') || `<p class="empty-list">${state.lang === 'fa' ? 'هنوز نموداری نیست.' : 'No diagrams yet.'}</p>`;
  root.querySelectorAll('.doc-row').forEach(row => { row.onclick = () => openDoc(row.dataset.id); row.oncontextmenu = event => { event.preventDefault(); documentMenu(row.dataset.id); }; });
  root.querySelectorAll('.folder-row').forEach(row => { row.oncontextmenu = event => { event.preventDefault(); folderMenu(row.dataset.id); }; });
}
function renderTabs() {
  const root = document.querySelector('#tabs');
  root.innerHTML = state.tabs.map(id => { const item = state.project.documents.find(d => d.id === id); return item ? `<div class="doc-tab ${id === state.docId ? 'active' : ''}" data-id="${esc(id)}"><span>${esc(item.name)}</span><button class="tab-close" aria-label="Close">×</button></div>` : ''; }).join('');
  root.querySelectorAll('.doc-tab').forEach(tab => { tab.onclick = () => openDoc(tab.dataset.id); tab.querySelector('button').onclick = event => { event.stopPropagation(); closeDoc(tab.dataset.id); }; });
}
async function closeDoc(id) {
  if (state.docId === id) await preserveActive();
  state.tabs = state.tabs.filter(item => item !== id);
  if (state.docId === id) { state.editor?.destroy?.(); state.editor = null; state.docId = state.tabs.at(-1) || null; renderEditor(); }
  remember(); renderTabs(); renderExplorer();
}
async function openDoc(id) {
  if (!state.project.documents.some(item => item.id === id)) return;
  if (state.docId === id) return;
  await preserveActive();
  state.editor?.destroy?.(); state.editor = null;
  state.docId = id;
  if (!state.tabs.includes(id)) state.tabs.push(id);
  remember(); renderTabs(); renderExplorer(); renderEditor();
}
async function newDocument() {
  await openDiagramCatalog(dialogs, state.lang, async (entry, name) => addNewDocument(createCatalogDocument(entry, name)), {
    folders: state.project.folders,
    getCustomTemplates: () => state.templates,
    onCreateTemplate: async (template, name, folderId) => {
      if (folderId && !state.project.folders.some(folder => folder.id === folderId)) throw new Error(ui('پوشهٔ مقصد پیدا نشد.', 'Destination folder not found.'));
      await addNewDocument(instantiateTemplate(template, name, folderId));
      try {
        const usage = JSON.parse(localStorage.getItem('as-template-use') || '{}');
        usage[template.id] = new Date().toISOString();
        localStorage.setItem('as-template-use', JSON.stringify(usage));
      } catch { /* Local preferences are optional; document creation already succeeded. */ }
      if (template.source === 'custom') {
        const updated = { ...template, lastUsedAt: new Date().toISOString(), usageCount: (template.usageCount || 0) + 1 };
        try { await saveTemplate(state.db, updated); state.templates = state.templates.map(item => item.id === template.id ? updated : item); }
        catch (error) { notify(error.message, true); }
      }
    },
    onManage: manageTemplate
  });
}
async function addNewDocument(item) {
  await preserveActive();
  const project = state.project;
  const oldUpdatedAt = project.updatedAt;
  project.documents.push(item);
  project.updatedAt = new Date().toISOString();
  try { await saveProject(state.db, project); }
  catch (error) { project.documents = project.documents.filter(document => document.id !== item.id); project.updatedAt = oldUpdatedAt; throw error; }
  state.dirty = false;
  await openDoc(item.id);
  renderExplorer(); updateStatus();
}
async function saveAsTemplate(item = doc()) {
  if (!item) return;
  await dialogs.input({ title:ui('ذخیره به‌عنوان قالب', 'Save as Template'), description:ui('این قالب جدا از نمودار فعلی ذخیره می‌شود.', 'This template is stored separately from the current diagram.'), fields:[
    { name:'name', label:ui('نام قالب','Template name'), value:item.name, required:true },
    { name:'description', label:ui('توضیح کوتاه','Short description'), required:true },
    { name:'category', label:ui('دسته','Category'), type:'select', value:item.type === 'bpmn' ? 'process' : item.type === 'dmn' ? 'decision' : item.type === 'erd' || item.type === 'dfd' ? 'data' : item.type === 'infrastructure' ? 'infrastructure' : item.type === 'c4' ? 'architecture' : 'general', options:Object.entries(TEMPLATE_CATEGORIES).map(([value,title]) => ({ value, label:title[state.lang] })) },
    { name:'tags', label:ui('برچسب‌ها با ویرگول','Comma-separated tags'), value:item.type }
  ], confirmLabel:ui('ذخیرهٔ قالب','Save template'), async onConfirm(values) {
    const content = item.id === state.docId ? await contentNow() : item.content;
    const template = customTemplateFromDocument(item, content, values);
    template.thumbnail = await templateThumbnail(template);
    await saveTemplate(state.db, template);
    state.templates.push(template);
    notify(ui('قالب ذخیره شد.', 'Template saved.'));
  } });
}
async function manageTemplate(action, payload) {
  if (action === 'update') {
    validateTemplateMetadata(payload);
    if (!state.templates.some(item => item.id === payload.id)) throw new Error('Template not found');
    await saveTemplate(state.db, payload);
    state.templates = state.templates.map(item => item.id === payload.id ? payload : item);
  } else if (action === 'duplicate') {
    const now = new Date().toISOString();
    const copy = { ...structuredClone(payload), id:`user-${uid()}`, title:{ fa:`${payload.title.fa} ${ui('رونوشت','copy')}`, en:`${payload.title.en} copy` }, createdAt:now, updatedAt:now, lastUsedAt:null, usageCount:0 };
    await saveTemplate(state.db, copy); state.templates.push(copy);
  } else if (action === 'delete') {
    if (!state.templates.some(item => item.id === payload.id)) throw new Error('Built-in templates cannot be deleted');
    await removeTemplate(state.db, payload.id); state.templates = state.templates.filter(item => item.id !== payload.id);
  } else if (action === 'export') {
    download(await exportTemplates(payload), `architecture-templates-${new Date().toISOString().slice(0,10)}.astpl`);
  } else if (action === 'import') {
    const known = new Set([...builtInTemplates, ...state.templates].map(item => item.id));
    const records = [];
    for (const item of payload.templates) {
      let next = { ...item };
      if (known.has(next.id)) {
        if (payload.policy === 'skip') continue;
        if (payload.policy === 'copy' || builtInTemplates.some(builtIn => builtIn.id === next.id)) next = { ...next, id:`user-${uid()}`, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
      }
      known.add(next.id); records.push(next);
    }
    if (!records.length) return;
    await saveTemplates(state.db, records);
    const incoming = new Set(records.map(item => item.id));
    state.templates = [...state.templates.filter(item => !incoming.has(item.id)), ...records];
  }
  notify(ui('قالب‌ها به‌روزرسانی شدند.', 'Templates updated.'));
}
async function documentMenu(id) {
  const item = state.project.documents.find(d => d.id === id);
  if (!item) return;
  const action = await dialogs.choose({ title:item.name, items:[ ['rename',t('rename')], ['duplicate',t('duplicate')], ['template',ui('ذخیره به‌عنوان قالب','Save as Template')], ['move',ui('انتقال به پوشه','Move to folder')], ['delete',t('remove')] ].map(([value,label]) => ({ value,label })) });
  if (action === 'template') { await saveAsTemplate(item); return; }
  if (action === 'rename') { const result = await dialogs.input({ title:ui('تغییر نام نمودار','Rename diagram'), fields:[{ name:'name', label:ui('نام نمودار','Diagram name'), value:item.name, required:true }], confirmLabel:t('rename') }); if (result) item.name = result.name; else return; }
  else if (action === 'duplicate') state.project.documents.push({ ...structuredClone(item), id: uid(), name: `${item.name} ${ui('رونوشت','copy')}` });
  else if (action === 'delete') { if (!await dialogs.confirm({ title:ui('حذف نمودار','Delete diagram'), description:ui(`«${item.name}» و پیوندهای آن حذف می‌شود.`, `Delete “${item.name}” and its links?`), destructive:true, confirmLabel:t('remove') })) return; state.project.documents = state.project.documents.filter(d => d.id !== id); state.project.links = state.project.links.filter(link => link.fromDocId !== id && link.toDocId !== id); await closeDoc(id); }
  else if (action === 'move') { const folderId = await dialogs.choose({ title:ui('انتقال نمودار','Move diagram'), items:[{ value:'root', label:ui('ریشهٔ پروژه','Project root') }, ...state.project.folders.map(folder => ({ value:folder.id, label:folder.name }))], value:item.folderId || 'root' }); if (!folderId) return; item.folderId = folderId === 'root' ? null : folderId; }
  else return;
  changed(); renderExplorer(); renderTabs();
}
async function folderMenu(id) { const folder = state.project.folders.find(f => f.id === id); if (!folder) return; const result = await dialogs.input({ title:ui('تغییر نام پوشه','Rename folder'), fields:[{ name:'name', label:ui('نام پوشه','Folder name'), value:folder.name, required:true }], confirmLabel:t('rename') }); if (result) { folder.name = result.name; changed(); renderExplorer(); } }
function changed() {
  if (!state.project) return;
  state.project.updatedAt = new Date().toISOString();
  state.dirty = true;
  updateStatus();
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => flush().catch(error => notify(error.message, true)), 600);
}
async function flush(snapshot = false) {
  if (!state.project) return;
  await saveProject(state.db, state.project, snapshot);
  state.dirty = false;
  updateStatus();
}
function updateStatus() { const status = document.querySelector('#status'); if (status) status.innerHTML = `<span>${state.dirty ? t('saving') : t('saved')}</span><span>${doc() ? esc(TYPES[doc().type].mode) : ''}</span><span>${state.project?.documents.length || 0} ${state.lang === 'fa' ? 'سند' : 'documents'}</span>`; }
function issue(message) { document.querySelector('#problems').textContent = message || (state.lang === 'fa' ? 'موردی یافت نشد' : 'No problems'); }
function renderLinks() {
  const root = document.querySelector('#links');
  const item = doc();
  if (!item) { root.innerHTML = ''; return; }
  const related = state.project.links.filter(link => link.fromDocId === item.id || link.toDocId === item.id);
  root.innerHTML = `<button id="add-link" class="btn btn-xs btn-ghost">＋ ${state.lang === 'fa' ? 'افزودن پیوند' : 'Add link'}</button>${related.map(link => {
    const targetId = link.fromDocId === item.id ? link.toDocId : link.fromDocId;
    const target = state.project.documents.find(d => d.id === targetId);
    return `<button class="link-row" data-id="${esc(targetId)}">↗ ${esc(target?.name || 'Missing document')}</button>`;
  }).join('')}`;
  root.querySelector('#add-link').onclick = async () => {
    const options = state.project.documents.filter(d => d.id !== item.id);
    if (!options.length) return notify(ui('ابتدا نمودار دیگری بسازید.', 'Create another diagram first.'));
    const choice = await dialogs.choose({ title:ui('افزودن پیوند','Add link'), items:options.map(document => ({ value:document.id, label:document.name })) });
    if (!choice) return;
    const target = options.find(document => document.id === choice);
    if (!target) return;
    if (!state.project.links.some(link => link.fromDocId === item.id && link.toDocId === target.id)) state.project.links.push({ id: uid(), fromDocId: item.id, fromElementId: null, toDocId: target.id, toElementId: null });
    changed(); renderLinks();
  };
  root.querySelectorAll('.link-row').forEach(button => { button.onclick = () => openDoc(button.dataset.id); });
}
function renderEditor() {
  const area = document.querySelector('#editor-area'); const toolbar = document.querySelector('#toolbar'); const props = document.querySelector('#properties');
  const item = doc(); updateStatus(); issue(null); renderLinks();
  if (!item) { toolbar.innerHTML = ''; props.innerHTML = ''; area.innerHTML = `<div class="welcome"><div class="welcome-glyph">◇</div><h1>${state.lang === 'fa' ? 'فضای طراحی شما' : 'Your design workspace'}</h1><p>${t('empty')}</p><button id="welcome-new" class="btn btn-primary">＋ ${t('newDoc')}</button><div class="welcome-grid"><span>01 · BPMN</span><span>02 · DMN</span><span>03 · Mermaid</span><span>04 · C4 / ERD</span></div></div>`; document.querySelector('#welcome-new').onclick = newDocument; return; }
  toolbar.innerHTML = `<span class="doc-kind">${esc(TYPES[item.type][state.lang])}</span><span class="toolbar-separator"></span><button id="undo" class="btn btn-xs btn-ghost" title="Undo">↶</button><button id="redo" class="btn btn-xs btn-ghost" title="Redo">↷</button><span class="toolbar-separator"></span>${!['mermaid','bpmn','dmn'].includes(item.type) ? `<button id="add-node" class="btn btn-xs btn-ghost">＋ ${t('addNode')}</button><button id="connect" class="btn btn-xs btn-ghost">↗ ${t('connect')}</button><button id="delete-node" class="btn btn-xs btn-ghost">× ${t('remove')}</button><button id="auto-layout" class="btn btn-xs btn-ghost">▦ ${state.lang === 'fa' ? 'چیدمان' : 'Arrange'}</button>` : ''}${['bpmn','dmn'].includes(item.type) ? `<button id="validate" class="btn btn-xs btn-ghost">✓ ${state.lang === 'fa' ? 'اعتبارسنجی' : 'Validate'}</button>` : ''}${item.type === 'bpmn' ? `<button id="find-element" class="btn btn-xs btn-ghost">⌕ ${state.lang === 'fa' ? 'یافتن عنصر' : 'Find element'}</button>` : ''}<button id="zoom-in" class="btn btn-xs btn-ghost" title="Zoom in">＋</button><button id="zoom-out" class="btn btn-xs btn-ghost" title="Zoom out">－</button><button id="fit" class="btn btn-xs btn-ghost" title="${t('fit')}">⌗</button><button id="pan" class="btn btn-xs btn-ghost" title="${ui('جابجایی بوم','Pan canvas')}" aria-label="${ui('جابجایی بوم','Pan canvas')}" aria-pressed="false">✥</button><button id="fullscreen" class="btn btn-xs btn-ghost btn-square fullscreen-toggle" type="button"></button><button id="fullscreen-properties" class="btn btn-xs btn-ghost fullscreen-properties" type="button" hidden title="${t('inspector')}" aria-label="${t('inspector')}">☷ ${t('inspector')}</button><span class="toolbar-spacer"></span><button id="snapshot" class="btn btn-xs btn-ghost" title="Snapshot">◷</button><button id="save-template" class="btn btn-xs btn-ghost" title="${ui('ذخیره به‌عنوان قالب','Save as Template')}">▧ ${ui('قالب','Template')}</button><button id="export-document" class="btn btn-xs btn-ghost">⇧ ${t('exportDoc')}</button><button id="export-svg" class="btn btn-xs btn-ghost">SVG</button><button id="export-png" class="btn btn-xs btn-ghost">PNG</button>`;
  toolbar.querySelector('#undo').onclick = () => state.editor?.undo?.(); toolbar.querySelector('#redo').onclick = () => state.editor?.redo?.();
  toolbar.querySelector('#zoom-in').onclick = () => state.editor?.zoom?.(1.2);
  toolbar.querySelector('#zoom-out').onclick = () => state.editor?.zoom?.(1/1.2);
  toolbar.querySelector('#fit').onclick = () => state.editor?.fit?.();
  toolbar.querySelector('#pan').onclick = event => { const active = state.editor?.pan?.(); event.currentTarget.classList.toggle('btn-active', Boolean(active)); event.currentTarget.setAttribute('aria-pressed', String(Boolean(active))); };
  toolbar.querySelector('#fullscreen').onclick = toggleFullscreen;
  toolbar.querySelector('#fullscreen-properties').onclick = () => { fullscreenPanelOpen = !fullscreenPanelOpen; syncFullscreen(); if (fullscreenPanelOpen) document.querySelector('.inspector button, .inspector input, .inspector select, .inspector textarea')?.focus(); };
  syncFullscreen();
  toolbar.querySelector('#validate')?.addEventListener('click', async () => { const findings = validateXMLDocument(await contentNow(), item.type); issue(findings.length ? findings.join('\n') : null); notify(findings.length ? `${findings.length} issue(s)` : (state.lang === 'fa' ? 'ساختار پایه معتبر است' : 'Basic structure valid')); });
  toolbar.querySelector('#find-element')?.addEventListener('click', async () => { const result = await dialogs.input({ title:ui('یافتن عنصر','Find element'), fields:[{ name:'query', label:ui('نام یا شناسهٔ عنصر','Name or element ID'), required:true }], confirmLabel:ui('جستجو','Find') }); if (!result) return; const found = state.editor?.find?.(result.query); notify(found ? `${found.name} (${found.id})` : ui('عنصری پیدا نشد','Element not found'), !found); });
  toolbar.querySelector('#snapshot').onclick = async () => { await flush(true); notify(state.lang === 'fa' ? 'نسخهٔ محلی ثبت شد' : 'Local snapshot saved'); };
  toolbar.querySelector('#save-template').onclick = () => saveAsTemplate();
  toolbar.querySelector('#export-document').onclick = async () => { const content = await contentNow(); download(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${safeName(item.name)}.${TYPES[item.type].extension}`); };
  toolbar.querySelector('#export-svg').onclick = () => saveImage('svg'); toolbar.querySelector('#export-png').onclick = () => saveImage('png');
  if (item.type === 'mermaid') renderMermaid(area, props, item);
  else if (item.type === 'bpmn' || item.type === 'dmn') renderXmlEditor(area, props, item);
  else renderGraph(area, props, item);
}
function renderMermaid(area, props, item) {
  area.innerHTML = `<div class="source-layout"><div class="source-pane"><div class="pane-heading">${t('source')} <select id="example" class="select select-xs"><option value="">${state.lang === 'fa' ? 'نمونه‌ها' : 'Examples'}</option>${Object.keys(MERMAID_EXAMPLES).map(key => `<option value="${key}">${key}</option>`).join('')}</select></div><div class="code-wrap"><pre id="lines" aria-hidden="true"></pre><div class="editor-stack"><pre id="highlight" aria-hidden="true"></pre><textarea id="source" class="textarea" dir="ltr" spellcheck="false" aria-label="Mermaid source"></textarea></div></div></div><div class="preview-pane"><div class="pane-heading">${t('preview')}</div><div id="diagram-preview" class="diagram-preview"></div></div></div>`;
  const source = area.querySelector('#source'); source.value = item.content;
  const lines = area.querySelector('#lines'); const highlight = area.querySelector('#highlight');
  const previewHost = area.querySelector('#diagram-preview');
  let pan = null;
  let panMode = false;
  previewHost.onpointerdown = event => { if (event.button === 1 || event.altKey || panMode) { event.preventDefault(); pan = { x: event.clientX, y: event.clientY, left: previewHost.scrollLeft, top: previewHost.scrollTop }; previewHost.setPointerCapture(event.pointerId); previewHost.style.cursor = 'grabbing'; } };
  previewHost.onpointermove = event => { if (pan) { previewHost.scrollLeft = pan.left - (event.clientX - pan.x); previewHost.scrollTop = pan.top - (event.clientY - pan.y); } };
  previewHost.onpointerup = previewHost.onpointercancel = () => { pan = null; previewHost.style.cursor = panMode ? 'grab' : ''; };
  const updateSource = () => {
    lines.textContent = Array.from({ length: source.value.split('\n').length }, (_, i) => i + 1).join('\n');
    highlight.innerHTML = source.value.split('\n').map(line => {
      if (line.trimStart().startsWith('%%')) return `<span class="code-comment">${esc(line)}</span>`;
      return esc(line).replace(/^(\s*)(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|gitGraph|pie|timeline|mindmap|quadrantChart|requirementDiagram|architecture-beta|C4Context|C4Container|C4Component)(\b)/, '$1<span class="code-keyword">$2</span>$3').replace(/(--&gt;|--&gt;&gt;|---|==&gt;|-. -&gt;|\|[^|]*\|)/g, '<span class="code-arrow">$1</span>');
    }).join('\n') + '\n';
    lines.scrollTop = highlight.scrollTop = source.scrollTop;
    highlight.scrollLeft = source.scrollLeft;
  };
  let scale = 1;
  const applyZoom = () => {
    const svg = area.querySelector('#diagram-preview svg');
    if (!svg) return;
    const box = svg.viewBox.baseVal;
    svg.style.maxWidth = 'none'; svg.style.maxHeight = 'none';
    svg.style.width = `${Math.max(180, box.width) * scale}px`;
    svg.style.height = `${Math.max(120, box.height) * scale}px`;
  };
  const preview = async () => { try { const { mountMermaid } = await import('./adapters/mermaid.js'); await mountMermaid(area.querySelector('#diagram-preview'), source.value, issue); applyZoom(); } catch (error) { issue(error.message); } };
  source.oninput = () => { item.content = source.value; changed(); updateSource(); clearTimeout(state.renderTimer); state.renderTimer = setTimeout(preview, 450); };
  source.onscroll = updateSource; updateSource(); preview();
  area.querySelector('#example').onchange = async event => { const selected = event.target.value; if (!selected) return; const accepted = await dialogs.confirm({ title:ui('جایگزینی متن نمودار','Replace diagram source'), description:ui('متن فعلی با نمونهٔ انتخاب‌شده جایگزین می‌شود.','The current source will be replaced with the selected example.'), confirmLabel:ui('جایگزین کن','Replace') }); if (accepted) { source.value = MERMAID_EXAMPLES[selected]; source.dispatchEvent(new Event('input')); } event.target.value = ''; };
  props.innerHTML = `<div class="property-row"><label>${state.lang === 'fa' ? 'نوع ویرایش' : 'Editing level'}</label><strong>Source preview</strong></div><p class="helper">${state.lang === 'fa' ? 'کد منبع، نسخهٔ اصلی نمودار است.' : 'The source is the authoritative diagram.'}</p>`;
  state.editor = { getContent: () => source.value, getSVG: () => area.querySelector('#diagram-preview svg'), zoom: factor => { scale = Math.max(.4, Math.min(4, scale * factor)); applyZoom(); }, fit: () => { scale = 1; applyZoom(); }, pan: () => { panMode = !panMode; previewHost.style.cursor = panMode ? 'grab' : ''; return panMode; }, resize: applyZoom, destroy: () => clearTimeout(state.renderTimer) };
}
function renderXmlEditor(area, props, item) {
  area.innerHTML = `<div class="native-editor"><div id="native-canvas"></div></div>`;
  props.innerHTML = `<div id="native-properties"></div><p class="helper">${item.type.toUpperCase()} XML ${state.lang === 'fa' ? 'مدل اصلی این سند است. ویرایش تصویری به صورت محلی ذخیره می‌شود.' : 'is the authoritative model. Visual changes save locally.'}</p><button id="source-view" class="btn btn-sm btn-ghost">${t('source')}</button><textarea id="xml-source" class="textarea xml-source" dir="ltr" spellcheck="false" hidden></textarea><button id="apply-source" class="btn btn-sm btn-primary" hidden>Apply XML</button><div class="native-tools"><button id="native-test" class="btn btn-sm btn-ghost">${item.type === 'bpmn' ? (state.lang === 'fa' ? 'شبیه‌سازی' : 'Simulate') : (state.lang === 'fa' ? 'آزمون تصمیم' : 'Test decision')}</button><div id="native-test-result" class="test-result"></div></div>`;
  const source = props.querySelector('#xml-source'); source.value = item.content;
  props.querySelector('#source-view').onclick = () => { source.hidden = !source.hidden; props.querySelector('#apply-source').hidden = source.hidden; };
  props.querySelector('#apply-source').onclick = () => { if (/<!DOCTYPE|<!ENTITY|<script\b/i.test(source.value)) return issue('Unsafe XML declaration'); item.content = source.value; changed(); state.editor?.destroy?.(); state.editor = null; renderEditor(); };
  props.querySelector('#native-test').onclick = async () => {
    const output = props.querySelector('#native-test-result');
    try {
      const xml = await contentNow();
      if (item.type === 'dmn') {
        const values = await dialogs.input({ title:ui('آزمون تصمیم','Test decision'), fields:[{ name:'json', type:'textarea', label:ui('ورودی JSON','JSON inputs'), value:'{"input":"sample"}', required:true }], confirmLabel:ui('اجرا','Run') });
        if (!values) return;
        const { evaluateDecision } = await import('./decision-test.js');
        const result = evaluateDecision(xml, JSON.parse(values.json));
        output.textContent = JSON.stringify(result, null, 2);
      } else {
        const { createBpmnSimulation } = await import('./bpmn-simulation.js');
        const simulation = createBpmnSimulation(xml);
        const show = () => {
          state.editor?.mark?.(simulation.tokens);
          output.replaceChildren();
          const description = document.createElement('p');
          description.textContent = simulation.current.map(node => node.name).join(' · ') || (state.lang === 'fa' ? 'پایان' : 'Complete');
          output.append(description);
          const step = document.createElement('button'); step.className = 'btn btn-xs'; step.textContent = state.lang === 'fa' ? 'گام بعد' : 'Step';
          step.onclick = async () => { try { const choices = simulation.choices; const choice = choices.length ? await dialogs.choose({ title:ui('مسیر بعدی','Next path'), items:choices.map(flow => ({ value:flow.id, label:flow.name || flow.to })), value:choices[0].id }) : null; if (choices.length && !choice) return; simulation.step(choice); show(); } catch (error) { issue(error.message); } };
          const reset = document.createElement('button'); reset.className = 'btn btn-xs btn-ghost'; reset.textContent = state.lang === 'fa' ? 'بازنشانی' : 'Reset'; reset.onclick = () => { simulation.reset(); show(); };
          output.append(step, reset);
        };
        show();
      }
      issue(null);
    } catch (error) { issue(error.message); output.textContent = error.message; }
  };
  const onSelect = selected => {
    const host = props.querySelector('#native-properties');
    if (!host) return;
    if (!selected) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="property-row"><span>${esc(selected.type)}</span><strong>${esc(selected.id)}</strong></div><label class="field-label">${state.lang === 'fa' ? 'نام عنصر' : 'Element name'}<input id="bpmn-name" class="input input-sm" value="${esc(selected.name)}"></label>`;
    host.querySelector('#bpmn-name').onchange = event => state.editor?.renameSelected?.(selected.id, event.target.value);
  };
  (async () => { try { const module = item.type === 'bpmn' ? await import('./adapters/bpmn.js') : await import('./adapters/dmn.js'); if (state.docId !== item.id) return; const host = area.querySelector('#native-canvas'); const editor = await (item.type === 'bpmn' ? module.mountBpmn : module.mountDmn)(host, item.content, content => { item.content = content; source.value = content; changed(); }, issue, onSelect); if (state.docId === item.id) { state.editor = editor; if (!item.content) { item.content = await editor.getContent(); changed(); } host.dataset.ready = 'true'; resizeEditor(); } else editor.destroy(); } catch (error) { issue(error.message); } })();
}
function renderGraph(area, props, item) {
  area.innerHTML = `<div id="graph-host" class="graph-host"></div>`;
  try { state.editor = new GraphEditor(area.querySelector('#graph-host'), item.content, content => { item.content = content; changed(); }, selected => renderProperties(selected)); }
  catch (error) { issue(error.message); return; }
  renderProperties(null);
  document.querySelector('#add-node').onclick = async () => { const kind = await dialogs.choose({ title:ui('افزودن عنصر','Add node'), items:[ ['box',ui('جعبه','Box')], ['entity',ui('موجودیت','Entity')], ['database',ui('پایگاه داده','Database')], ['service',ui('سرویس','Service')], ['server',ui('سرور','Server')] ].map(([value,label]) => ({ value,label })), value:item.type === 'erd' ? 'entity' : 'box' }); if (kind) state.editor?.addNode(kind); };
  document.querySelector('#connect').onclick = () => state.editor.connect();
  document.querySelector('#delete-node').onclick = () => state.editor.deleteSelected();
  document.querySelector('#auto-layout').onclick = () => state.editor.autoLayout();
  function renderProperties(selected) {
    if (!selected) { props.innerHTML = `<p class="helper">${state.lang === 'fa' ? 'برای ویرایش، یک عنصر را انتخاب کنید. برای افزودن، روی فضای خالی دو بار کلیک کنید.' : 'Select an element to edit it. Double click the canvas to add one.'}</p><label class="field-label">${state.lang === 'fa' ? 'جهت جریان' : 'Flow direction'}<select id="flow-direction" class="select select-sm"><option value="ltr" ${state.editor.model.flowDirection !== 'rtl' ? 'selected' : ''}>LTR</option><option value="rtl" ${state.editor.model.flowDirection === 'rtl' ? 'selected' : ''}>RTL</option></select></label>`; props.querySelector('#flow-direction').onchange = event => state.editor.setFlowDirection(event.target.value); return; }
    props.innerHTML = `<label class="field-label">${state.lang === 'fa' ? 'عنوان' : 'Label'}<input id="node-label" class="input input-sm" value="${esc(selected.label || '')}"></label><label class="field-label">${state.lang === 'fa' ? 'جهت عنوان' : 'Label direction'}<select id="label-direction" class="select select-sm"><option value="auto" ${!selected.labelDirection || selected.labelDirection === 'auto' ? 'selected' : ''}>Auto</option><option value="rtl" ${selected.labelDirection === 'rtl' ? 'selected' : ''}>RTL</option><option value="ltr" ${selected.labelDirection === 'ltr' ? 'selected' : ''}>LTR</option></select></label>${'w' in selected ? `<label class="field-label">Width<input id="node-width" class="input input-sm" type="number" min="60" max="600" value="${Number(selected.w)}"></label><label class="field-label">Height<input id="node-height" class="input input-sm" type="number" min="40" max="500" value="${Number(selected.h)}"></label><label class="field-label">Color<input id="node-color" type="color" value="${esc(selected.fill || '#e7f1ee')}"></label>` : ''}`;
    props.querySelector('#node-label').oninput = event => state.editor.updateSelected({ label: event.target.value });
    props.querySelector('#label-direction').onchange = event => state.editor.updateSelected({ labelDirection: event.target.value });
    props.querySelector('#node-width')?.addEventListener('change', event => state.editor.updateSelected({ w: Number(event.target.value) }));
    props.querySelector('#node-height')?.addEventListener('change', event => state.editor.updateSelected({ h: Number(event.target.value) }));
    props.querySelector('#node-color')?.addEventListener('change', event => state.editor.updateSelected({ fill: event.target.value }));
  }
}
async function contentNow() { return state.editor?.getContent ? await state.editor.getContent() : doc()?.content || ''; }
async function saveImage(kind) {
  try {
    const item = doc(); if (!item) return;
    let svg = await state.editor?.getSVG?.();
    if (typeof svg === 'string') svg = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('SVG export is unavailable for this editor');
    const clone = svg.cloneNode(true); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (state.editor instanceof GraphEditor) clone.setAttribute('viewBox', '0 0 1400 900');
    const fontBytes = new Uint8Array(await (await fetch(fontUrl)).arrayBuffer());
    let binary = ''; for (const byte of fontBytes) binary += String.fromCharCode(byte);
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `@font-face{font-family:Vazirmatn;src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');font-weight:100 900} text{font-family:Vazirmatn,sans-serif}`;
    clone.prepend(style);
    if (kind === 'svg') download(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }), `${safeName(item.name)}.svg`);
    else await exportPng(clone, `${safeName(item.name)}.png`);
  } catch (error) { notify(error.message, true); }
}
async function importFile(file) {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const project = await importProjectZip(file);
    if (state.projects.some(p => p.id === project.id)) project.id = uid();
    state.projects.push(project); await saveProject(state.db, project); selectProject(project.id); return;
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds 5 MB');
  const extension = file.name.split('.').at(-1).toLowerCase();
  const type = ({ mmd:'mermaid', bpmn:'bpmn', dmn:'dmn', xml:'bpmn', json:'general' })[extension];
  if (!type) throw new Error('Unsupported file type');
  const content = await file.text();
  if (['bpmn','dmn'].includes(type) && /<!DOCTYPE|<!ENTITY|<script\b/i.test(content)) throw new Error('Unsafe XML');
  if (type === 'general') validateGraph(JSON.parse(content));
  const item = createDocument(type, file.name.replace(/\.[^.]+$/, ''));
  item.content = content; state.project.documents.push(item); changed(); renderExplorer(); openDoc(item.id);
}
function shortcuts(event) {
  const cmd = event.ctrlKey || event.metaKey;
  if (cmd && event.key.toLowerCase() === 's') { event.preventDefault(); flush(true).then(() => notify(t('saved'))); }
  if (event.key === 'Escape' && isFullscreen() && !document.querySelector('dialog[open]') && !event.target.closest?.('.djs-direct-editing-content')) { event.preventDefault(); toggleFullscreen(); return; }
  if (event.target.closest?.('input,textarea,select,[contenteditable="true"],.djs-direct-editing-content')) return;
  if (cmd && event.shiftKey && event.key.toLowerCase() === 'f' && doc()) { event.preventDefault(); toggleFullscreen(); return; }
  if (cmd && event.key.toLowerCase() === 'z') { event.preventDefault(); state.editor?.undo?.(); }
  if (cmd && event.key.toLowerCase() === 'y') { event.preventDefault(); state.editor?.redo?.(); }
  if (cmd && event.key.toLowerCase() === 'c' && state.editor instanceof GraphEditor) { event.preventDefault(); state.editor.copySelected(); }
  if (cmd && event.key.toLowerCase() === 'v' && state.editor instanceof GraphEditor) { event.preventDefault(); state.editor.paste(); }
  if (event.key === 'Delete' && state.editor instanceof GraphEditor) state.editor.deleteSelected();
}
async function start() {
  try {
    document.addEventListener('keydown', shortcuts);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    state.db = await openDatabase(); [state.projects, state.templates] = await Promise.all([allProjects(state.db), allTemplates(state.db)]);
    if (!state.projects.length) { const first = createProject(state.lang === 'fa' ? 'پروژهٔ من' : 'My project'); state.projects.push(first); await saveProject(state.db, first); }
    const previous = JSON.parse(localStorage.getItem('as-session') || '{}');
    state.project = state.projects.find(p => p.id === previous.projectId) || state.projects[0];
    state.tabs = (previous.tabs || []).filter(id => state.project.documents.some(d => d.id === id));
    state.docId = state.tabs.includes(previous.docId) ? previous.docId : state.tabs.at(-1) || null;
    renderShell();
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
  } catch (error) { app.innerHTML = `<main class="fatal"><h1>Storage error</h1><p>${esc(error.message)}</p></main>`; }
}
start();
