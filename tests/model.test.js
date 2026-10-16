import { describe, expect, it } from 'vitest';
import { createProject, createDocument, validateProject, validateGraph } from '../src/model.js';
import { safePath, projectZip, importProjectZip } from '../src/export.js';
import JSZip from 'jszip';

describe('portable project model', () => {
  it('creates stable IDs and validates registry entries', () => {
    const project = createProject('طرح آزمایشی');
    project.documents.push(createDocument('mermaid', 'نمودار اول'));
    expect(validateProject(project)).toBe(project);
    expect(project.documents[0].mode).toBe('source-preview');
    project.documents.push({ ...project.documents[0] });
    expect(() => validateProject(project)).toThrow('Duplicate');
  });
  it('rejects unsafe archive paths', () => {
    for (const path of ['../x', '/root', 'a/../b', 'a\\b', 'a//b']) expect(() => safePath(path)).toThrow();
    expect(safePath('diagrams/c4/abc.json')).toBe('diagrams/c4/abc.json');
  });
  it('round trips Persian source through project ZIP', async () => {
    const project = createProject('سامانه');
    const document = createDocument('mermaid', 'فرایند');
    document.content = 'flowchart LR\n A[کاربر] --> B[پردازش]';
    project.documents.push(document);
    const archive = await projectZip(project);
    const restored = await importProjectZip(archive);
    expect(restored).toEqual(project);
  });
  it('checks diagram references', () => {
    const project = createProject('پیوند');
    const first = createDocument('mermaid', 'اول');
    const second = createDocument('c4', 'دوم');
    project.documents.push(first, second);
    project.links.push({ id: crypto.randomUUID(), fromDocId: first.id, toDocId: second.id });
    expect(validateProject(project)).toBe(project);
    project.links[0].toDocId = 'missing';
    expect(() => validateProject(project)).toThrow('Missing document reference');
  });
  it('rejects unsafe XML inside project ZIP', async () => {
    const project = createProject('unsafe');
    const document = createDocument('bpmn', 'process');
    document.content = '<!DOCTYPE foo><definitions />';
    project.documents.push(document);
    await expect(importProjectZip(await projectZip(project))).rejects.toThrow('Unsafe XML');
  });
  it('rejects traversing ZIP entry names', async () => {
    const zip = new JSZip();
    zip.file('../outside.txt', 'payload');
    zip.file('project.json', '{}');
    await expect(importProjectZip(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow('Unsafe archive path');
  });
});

describe('visual graph', () => {
  it('rejects missing connector targets', () => {
    const graph = { schemaVersion: 1, nodes: [{ id: 'a', x: 1, y: 2 }], edges: [{ id: 'e', from: 'a', to: 'missing' }] };
    expect(() => validateGraph(graph)).toThrow('Connector target');
    graph.flowDirection = 'diagonal';
    expect(() => validateGraph(graph)).toThrow('Invalid flow direction');
  });
});
