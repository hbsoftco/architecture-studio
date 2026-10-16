import { TYPES, validateProject, validateGraph } from './model.js';

export function safePath(path) {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '' || part === '.')) throw new Error('Unsafe archive path');
  return path;
}

export async function projectZip(project) {
  const { default: JSZip } = await import('jszip');
  validateProject(project);
  const zip = new JSZip();
  const manifest = { ...project, documents: project.documents.map(({ content, ...document }) => ({ ...document, path: safePath(`diagrams/${document.type}/${document.id}.${TYPES[document.type].extension}`) })) };
  zip.file('project.json', JSON.stringify(manifest, null, 2));
  zip.file('metadata/links.json', JSON.stringify(project.links, null, 2));
  for (const doc of project.documents) zip.file(manifest.documents.find(item => item.id === doc.id).path, doc.content);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importProjectZip(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Archive exceeds 20 MB');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files);
  if (entries.length > 300) throw new Error('Too many archive entries');
  let expandedBytes = 0;
  for (const entry of entries) {
    safePath((entry.unsafeOriginalName || entry.name).replace(/\/$/, ''));
    const size = entry.dir ? 0 : entry._data?.uncompressedSize;
    if (!Number.isFinite(size) || size < 0 || size > 10 * 1024 * 1024) throw new Error('Invalid archive entry size');
    expandedBytes += size;
    if (expandedBytes > 50 * 1024 * 1024) throw new Error('Archive expands beyond 50 MB');
  }
  const raw = zip.file('project.json');
  if (!raw) throw new Error('Project manifest is missing');
  const manifest = JSON.parse(await raw.async('string'));
  let total = 0;
  const documents = [];
  const paths = new Set();
  for (const doc of manifest.documents || []) {
    safePath(doc.path);
    if (!TYPES[doc.type] || !doc.path.startsWith(`diagrams/${doc.type}/`) || !doc.path.endsWith(`.${TYPES[doc.type].extension}`) || paths.has(doc.path)) throw new Error('Invalid document path');
    paths.add(doc.path);
    const entry = zip.file(doc.path);
    if (!entry) throw new Error(`Document missing: ${doc.path}`);
    const content = await entry.async('string');
    if (['bpmn', 'dmn'].includes(doc.type) && /<!DOCTYPE|<!ENTITY|<script\b/i.test(content)) throw new Error('Unsafe XML in project');
    if (TYPES[doc.type]?.extension === 'json') validateGraph(JSON.parse(content));
    total += content.length;
    if (total > 50 * 1024 * 1024) throw new Error('Archive expands beyond 50 MB');
    const { path, ...metadata } = doc;
    documents.push({ ...metadata, content });
  }
  return validateProject({ ...manifest, documents });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportPng(svg, filename) {
  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(svg.viewBox.baseVal.width || svg.clientWidth));
    canvas.height = Math.max(1, Math.ceil(svg.viewBox.baseVal.height || svg.clientHeight));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    if (!blob) throw new Error('PNG conversion failed');
    download(blob, filename);
  } finally { URL.revokeObjectURL(url); }
}
