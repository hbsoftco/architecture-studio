import projectValidator from './generated/project-validator.js';

export const TYPES = {
  mermaid: { fa: 'متن و نمودار', en: 'Mermaid', extension: 'mmd', mode: 'source-preview' },
  bpmn: { fa: 'فرایند BPMN', en: 'BPMN', extension: 'bpmn', mode: 'native-visual' },
  dmn: { fa: 'تصمیم DMN', en: 'DMN', extension: 'dmn', mode: 'native-visual' },
  c4: { fa: 'معماری C4', en: 'C4 architecture', extension: 'json', mode: 'native-visual' },
  erd: { fa: 'مدل داده ERD', en: 'ERD', extension: 'json', mode: 'native-visual' },
  infrastructure: { fa: 'زیرساخت', en: 'Infrastructure', extension: 'json', mode: 'native-visual' },
  dfd: { fa: 'جریان داده', en: 'Data flow', extension: 'json', mode: 'native-visual' },
  general: { fa: 'نمودار آزاد', en: 'General diagram', extension: 'json', mode: 'native-visual' },
};

export const MERMAID_EXAMPLES = {
  flowchart: 'flowchart LR\n  A[کاربر] --> B{درخواست معتبر است؟}\n  B -->|بله| C[پردازش]\n  B -->|خیر| D[نمایش خطا]',
  sequence: 'sequenceDiagram\n  participant U as کاربر\n  participant A as سرویس\n  U->>A: درخواست\n  A-->>U: پاسخ',
  class: 'classDiagram\n  class User {\n    +String name\n    +login()\n  }',
  state: 'stateDiagram-v2\n  [*] --> پیش‌نویس\n  پیش‌نویس --> تاییدشده\n  تاییدشده --> [*]',
  erd: 'erDiagram\n  USER ||--o{ ORDER : places\n  USER {\n    string id PK\n    string name\n  }',
};

export const uid = () => crypto.randomUUID();
export const graph = () => ({ schemaVersion: 1, flowDirection: 'ltr', nodes: [], edges: [] });
export const createProject = name => ({ schemaVersion: 1, id: uid(), name: String(name).trim() || 'پروژهٔ تازه', locale: 'fa-IR', direction: 'rtl', font: 'Vazirmatn', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), folders: [], documents: [], links: [] });
export function createDocument(type, name, folderId = null) {
  if (!TYPES[type]) throw new Error('Unsupported document type');
  let content = type === 'mermaid' ? MERMAID_EXAMPLES.flowchart : ['bpmn', 'dmn'].includes(type) ? '' : JSON.stringify(graph());
  return { id: uid(), type, name: String(name).trim() || TYPES[type].fa, folderId, content, mode: TYPES[type].mode, updatedAt: new Date().toISOString() };
}

export function validateProject(project) {
  if (!projectValidator(project)) throw new Error(`Invalid project manifest: ${projectValidator.errors?.[0]?.instancePath || '/'} ${projectValidator.errors?.[0]?.message || ''}`);
  const ids = new Set();
  for (const item of [...project.folders, ...project.documents]) {
    if (!item.id || ids.has(item.id)) throw new Error('Duplicate or missing ID');
    ids.add(item.id);
  }
  for (const doc of project.documents) {
    if (!TYPES[doc.type] || typeof doc.content !== 'string') throw new Error('Invalid document');
    if (doc.folderId && !project.folders.some(folder => folder.id === doc.folderId)) throw new Error('Missing folder');
  }
  for (const link of project.links) {
    if (!link.id || ids.has(link.id)) throw new Error('Duplicate or missing link ID');
    ids.add(link.id);
    if (!project.documents.some(doc => doc.id === link.fromDocId) || !project.documents.some(doc => doc.id === link.toDocId)) throw new Error('Missing document reference');
  }
  return project;
}

export function validateGraph(model) {
  if (!model || model.schemaVersion !== 1 || !Array.isArray(model.nodes) || !Array.isArray(model.edges)) throw new Error('Invalid graph');
  if (model.flowDirection && !['ltr', 'rtl'].includes(model.flowDirection)) throw new Error('Invalid flow direction');
  const ids = new Set();
  for (const node of model.nodes) {
    if (!node.id || ids.has(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error('Invalid node');
    ids.add(node.id);
  }
  for (const edge of model.edges) if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error('Connector target is missing');
  return model;
}
