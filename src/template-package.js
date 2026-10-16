import { TYPES } from './model.js';
import { safePath } from './export.js';
import { validateTemplateContent, validateTemplateMetadata } from './template-core.js';

const PACKAGE_KIND = 'architecture-studio-templates';
const PACKAGE_VERSION = 1;
const MAX_ARCHIVE = 20 * 1024 * 1024;
const MAX_EXPANDED = 30 * 1024 * 1024;

export async function exportTemplates(templates) {
  if (!Array.isArray(templates) || !templates.length || templates.length > 100) throw new Error('Select 1–100 templates to export');
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const ids = new Set();
  const manifest = { kind: PACKAGE_KIND, schemaVersion: PACKAGE_VERSION, createdAt: new Date().toISOString(), templates: [] };
  for (const item of templates) {
    validateTemplateContent(item);
    if (item.source !== 'custom' || ids.has(item.id)) throw new Error('Only distinct custom templates can be exported');
    ids.add(item.id);
    const path = safePath(`templates/${item.id}.${TYPES[item.diagramType].extension}`);
    const { content, thumbnail, ...metadata } = item;
    manifest.templates.push({ ...metadata, path });
    zip.file(path, content);
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function importTemplates(file) {
  if (file.size > MAX_ARCHIVE) throw new Error('Template package exceeds 20 MB');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files);
  if (entries.length > 220) throw new Error('Too many template package entries');
  let expanded = 0;
  for (const entry of entries) {
    safePath((entry.unsafeOriginalName || entry.name).replace(/\/$/, ''));
    const size = entry.dir ? 0 : entry._data?.uncompressedSize;
    if (!Number.isFinite(size) || size < 0 || size > 2_100_000) throw new Error('Invalid template package entry size');
    expanded += size;
    if (expanded > MAX_EXPANDED) throw new Error('Template package expands beyond 30 MB');
  }
  const rawManifest = zip.file('manifest.json');
  if (!rawManifest) throw new Error('Template manifest is missing');
  const manifest = JSON.parse(await rawManifest.async('string'));
  if (manifest.kind !== PACKAGE_KIND || manifest.schemaVersion !== PACKAGE_VERSION || !Array.isArray(manifest.templates) ||
    !manifest.templates.length || manifest.templates.length > 100) throw new Error('Unsupported template package');
  const ids = new Set(), paths = new Set(), templates = [];
  for (const entry of manifest.templates) {
    validateTemplateMetadata({ ...entry, content: 'pending' }, { imported: true });
    const expected = `templates/${entry.id}.${TYPES[entry.diagramType].extension}`;
    if (safePath(entry.path) !== expected || paths.has(entry.path) || ids.has(entry.id)) throw new Error('Invalid or duplicate template path');
    ids.add(entry.id); paths.add(entry.path);
    const source = zip.file(entry.path);
    if (!source) throw new Error(`Template source missing: ${entry.id}`);
    const content = await source.async('string');
    const { path, thumbnail, ...metadata } = entry;
    templates.push(validateTemplateContent({ ...metadata, content }));
  }
  const allowed = new Set(['manifest.json', ...paths]);
  if (entries.some(entry => !entry.dir && !allowed.has(entry.name))) throw new Error('Unsupported template package asset');
  return templates;
}
