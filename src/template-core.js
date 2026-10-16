import { TYPES, createDocument, uid, validateGraph } from './model.js';
import { normalizeSearch } from './catalog.js';
import { validateXMLDocument } from './xml-validation.js';

export const TEMPLATE_VERSION = 1;
export const TEMPLATE_CATEGORIES = {
  process: { fa: 'فرایندهای کسب‌وکار', en: 'Business processes' },
  decision: { fa: 'مدل‌سازی تصمیم', en: 'Decision modeling' },
  uml: { fa: 'مدل‌سازی UML', en: 'UML modeling' },
  architecture: { fa: 'معماری نرم‌افزار', en: 'Software architecture' },
  data: { fa: 'معماری داده', en: 'Data architecture' },
  infrastructure: { fa: 'زیرساخت', en: 'Infrastructure' },
  general: { fa: 'عمومی', en: 'General' }
};

const max = (value, length, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > length) throw new Error(`Invalid ${label}`);
  return value.trim();
};

export function validateTemplateMetadata(template, { imported = false } = {}) {
  if (!template || template.schemaVersion !== TEMPLATE_VERSION || template.version !== 1) throw new Error('Unsupported template version');
  max(template.id, 120, 'template ID');
  if (!/^[\w-]+$/.test(template.id)) throw new Error('Invalid template ID');
  if (!TYPES[template.diagramType]) throw new Error('Unsupported diagram type');
  if (!TEMPLATE_CATEGORIES[template.category]) throw new Error('Unsupported template category');
  if (!['builtin', 'custom'].includes(template.source) || (imported && template.source !== 'custom')) throw new Error('Invalid template source');
  for (const key of ['title', 'description', 'details']) {
    if (!template[key] || typeof template[key] !== 'object') throw new Error(`Invalid template ${key}`);
    max(template[key].fa, key === 'title' ? 120 : 1000, key);
    max(template[key].en, key === 'title' ? 120 : 1000, key);
  }
  if (!Array.isArray(template.tags) || template.tags.length > 20) throw new Error('Invalid template tags');
  for (const tag of template.tags) max(tag, 48, 'template tag');
  if (template.source === 'custom' && (!Number.isFinite(Date.parse(template.createdAt)) || !Number.isFinite(Date.parse(template.updatedAt)))) throw new Error('Invalid template dates');
  if (template.lastUsedAt != null && !Number.isFinite(Date.parse(template.lastUsedAt))) throw new Error('Invalid recent-use date');
  if (template.usageCount != null && (!Number.isSafeInteger(template.usageCount) || template.usageCount < 0)) throw new Error('Invalid usage count');
  if (template.recommended != null && (!Number.isInteger(template.recommended) || template.recommended < 0 || template.recommended > 10)) throw new Error('Invalid recommendation rank');
  if (template.guideId !== undefined && typeof template.guideId !== 'string') throw new Error('Invalid guide reference');
  if (template.sourceFormat !== TYPES[template.diagramType].extension) throw new Error('Incompatible template format');
  if (!template.compatibility || template.compatibility.adapter !== template.diagramType || template.compatibility.documentVersion !== 1) throw new Error('Incompatible template adapter');
  if (typeof template.content !== 'string' || !template.content.trim() || template.content.length > 2_000_000) throw new Error('Invalid template content');
  if (template.thumbnail !== undefined && (typeof template.thumbnail !== 'string' || template.thumbnail.length > 200_000)) throw new Error('Invalid thumbnail');
  return template;
}

export function validateTemplateContent(template) {
  validateTemplateMetadata(template);
  const { diagramType: type, content } = template;
  if (['bpmn', 'dmn'].includes(type)) {
    if (/<!DOCTYPE|<!ENTITY|<script\b/i.test(content)) throw new Error('Unsafe XML');
    if (!/<(?:\w+:)?definitions\b/.test(content) || !/<(?:\w+:)?(?:process|decision)\b/.test(content)) throw new Error('Invalid diagram XML');
    if (typeof DOMParser !== 'undefined') {
      const tree = new DOMParser().parseFromString(content, 'application/xml');
      if (tree.querySelector('parsererror') || tree.documentElement.localName !== 'definitions' ||
        !tree.documentElement.namespaceURI?.includes(type === 'bpmn' ? '/BPMN/' : '/DMN/')) throw new Error('Invalid diagram XML');
      const issues = validateXMLDocument(content, type);
      if (issues.length) throw new Error(issues.join('; '));
    }
  } else if (type === 'mermaid') {
    if (/%%\{init:|<script\b|javascript:/i.test(content)) throw new Error('Unsafe Mermaid source');
    const declaration = content.trim().replace(/^(?:%%[^\n]*\n\s*)+/, '');
    if (!/^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|gitGraph|pie|timeline|mindmap|quadrantChart|requirementDiagram|architecture-beta|C4\w+)\b/.test(declaration)) throw new Error('Unsupported Mermaid source');
  } else {
    const model = validateGraph(JSON.parse(content));
    for (const node of model.nodes) if (typeof node.label !== 'string' || !Number.isFinite(node.w) || !Number.isFinite(node.h) || node.w <= 0 || node.h <= 0) throw new Error('Invalid graph node');
  }
  return template;
}

export function filterTemplates(templates, { query = '', source = 'all', diagramType = 'all', category = 'all', sort = 'recommended', language = 'fa' } = {}) {
  const needle = normalizeSearch(query);
  return templates.filter(item => {
    if (source !== 'all' && item.source !== source) return false;
    if (diagramType !== 'all' && item.diagramType !== diagramType) return false;
    if (category !== 'all' && item.category !== category) return false;
    const haystack = [item.id, item.diagramType, TYPES[item.diagramType]?.en, item.category, TEMPLATE_CATEGORIES[item.category]?.fa, TEMPLATE_CATEGORIES[item.category]?.en,
      ...Object.values(item.title), ...Object.values(item.description), ...Object.values(item.details), ...item.tags].join(' ');
    return normalizeSearch(haystack).includes(needle);
  }).sort((a, b) => {
    if (sort === 'name') return a.title[language].localeCompare(b.title[language], language === 'fa' ? 'fa' : 'en');
    if (sort === 'recent') return (b.lastUsedAt || b.createdAt || '').localeCompare(a.lastUsedAt || a.createdAt || '');
    if (sort === 'created') return (b.createdAt || '').localeCompare(a.createdAt || '');
    return (b.recommended || 0) - (a.recommended || 0) || a.title[language].localeCompare(b.title[language]);
  });
}

export function instantiateTemplate(template, name, folderId = null) {
  validateTemplateContent(template);
  const document = createDocument(template.diagramType, name, folderId);
  if (TYPES[template.diagramType].extension === 'json') {
    const model = structuredClone(JSON.parse(template.content));
    const remap = new Map();
    for (const node of model.nodes) { const next = uid(); remap.set(node.id, next); node.id = next; }
    for (const edge of model.edges) { edge.id = uid(); edge.from = remap.get(edge.from); edge.to = remap.get(edge.to); }
    validateGraph(model);
    document.content = JSON.stringify(model);
  } else {
    // BPMN/DMN element IDs are scoped to their own XML document. Keeping them
    // preserves every internal reference and DI waypoint; the project document
    // itself gets a new ID above.
    document.content = template.content;
  }
  return document;
}

export function customTemplateFromDocument(document, content, values) {
  const title = max(values.name, 120, 'template name');
  const description = max(values.description, 500, 'template description');
  const tags = String(values.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const template = {
    schemaVersion: TEMPLATE_VERSION, id: `user-${uid()}`, version: 1,
    source: 'custom', diagramType: document.type, sourceFormat: TYPES[document.type].extension,
    compatibility: { adapter: document.type, documentVersion: 1 },
    category: values.category, title: { fa: title, en: title }, description: { fa: description, en: description },
    details: { fa: description, en: description }, tags, content, createdAt: now, updatedAt: now,
    recommended: 0
  };
  return validateTemplateContent(template);
}
