import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { builtInTemplates } from '../src/template-library.js';
import { TEMPLATE_CATEGORIES, filterTemplates, instantiateTemplate, customTemplateFromDocument, validateTemplateContent, validateTemplateMetadata } from '../src/template-core.js';
import { exportTemplates, importTemplates } from '../src/template-package.js';

const asFile = blob => ({ size:blob.size, arrayBuffer:() => blob.arrayBuffer() });

describe('template registry', () => {
  it('contains distinct, versioned templates for every supported editor family', () => {
    expect(builtInTemplates.length).toBe(19);
    expect(new Set(builtInTemplates.map(item => item.id)).size).toBe(builtInTemplates.length);
    expect(new Set(builtInTemplates.map(item => item.diagramType))).toEqual(new Set(['bpmn','dmn','mermaid','c4','erd','dfd','infrastructure','general']));
    for (const item of builtInTemplates) {
      expect(TEMPLATE_CATEGORIES[item.category]).toBeDefined();
      expect(validateTemplateContent(item)).toBe(item);
    }
  });

  it('normalizes Persian and technical aliases, filters, and sorts', () => {
    expect(filterTemplates(builtInTemplates, { query:'تأييد' }).map(item => item.id)).toContain('bpmn-approval');
    expect(filterTemplates(builtInTemplates, { query:'MICROSERVICES' }).map(item => item.id)).toContain('c4-events');
    expect(filterTemplates(builtInTemplates, { category:'decision' }).every(item => item.diagramType === 'dmn')).toBe(true);
    expect(filterTemplates(builtInTemplates, { source:'custom' })).toEqual([]);
    const named = filterTemplates(builtInTemplates, { sort:'name', language:'en' });
    expect(named.map(item => item.title.en)).toEqual([...named.map(item => item.title.en)].sort((a,b) => a.localeCompare(b,'en')));
  });

  it('clones graph IDs and relationships without mutating the template', () => {
    const template = builtInTemplates.find(item => item.id === 'c4-context');
    const first = instantiateTemplate(template, 'First');
    const second = instantiateTemplate(template, 'Second');
    const a = JSON.parse(first.content), b = JSON.parse(second.content), original = JSON.parse(template.content);
    expect(first.id).not.toBe(second.id);
    expect(a.nodes.map(node => node.id)).not.toEqual(b.nodes.map(node => node.id));
    expect(a.edges.every(edge => a.nodes.some(node => node.id === edge.from) && a.nodes.some(node => node.id === edge.to))).toBe(true);
    expect(original.nodes[0].id).toBe('user');
  });

  it('keeps XML references and BPMN DI intact in separate documents', () => {
    const template = builtInTemplates.find(item => item.id === 'bpmn-approval');
    const first = instantiateTemplate(template, 'One');
    const second = instantiateTemplate(template, 'Two');
    expect(first.id).not.toBe(second.id);
    expect(first.content).toBe(template.content);
    expect(second.content).toBe(template.content);
    expect(first.content).toContain('BPMNEdge');
  });

  it('rejects incompatible metadata and unsafe source', () => {
    const example = builtInTemplates[0];
    expect(() => validateTemplateMetadata({ ...example, diagramType:'unknown' })).toThrow();
    expect(() => validateTemplateContent({ ...example, content:'<!DOCTYPE foo><definitions><process/></definitions>' })).toThrow(/Unsafe/);
    expect(() => validateTemplateContent({ ...builtInTemplates.find(item => item.diagramType === 'mermaid'), content:'%%{init: {securityLevel:"loose"}}%%\nflowchart LR\nA-->B' })).toThrow(/Unsafe/);
  });
});

describe('portable custom templates', () => {
  const source = builtInTemplates.find(item => item.id === 'erd-users-roles');
  const document = instantiateTemplate(source, 'Access model');
  const custom = customTemplateFromDocument(document, document.content, { name:'Access model', description:'Reusable access design', category:'data', tags:'erd, roles' });

  it('creates an independent custom record', () => {
    expect(custom.source).toBe('custom');
    expect(custom.diagramType).toBe('erd');
    expect(custom.id).not.toBe(document.id);
    expect(custom.tags).toEqual(['erd','roles']);
  });

  it('round-trips a versioned package without mutable references', async () => {
    const restored = await importTemplates(asFile(await exportTemplates([custom])));
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id:custom.id, content:custom.content, source:'custom', schemaVersion:1 });
    expect(restored[0]).not.toBe(custom);
  });

  it('rejects duplicate IDs and unexpected archive assets', async () => {
    const zip = await JSZip.loadAsync(await (await exportTemplates([custom])).arrayBuffer());
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    manifest.templates.push({ ...manifest.templates[0] });
    zip.file('manifest.json', JSON.stringify(manifest));
    await expect(importTemplates(asFile(await zip.generateAsync({ type:'blob' })))).rejects.toThrow(/duplicate/i);
    manifest.templates.pop();
    zip.file('manifest.json', JSON.stringify(manifest));
    zip.file('extra.js', 'alert(1)');
    await expect(importTemplates(asFile(await zip.generateAsync({ type:'blob' })))).rejects.toThrow(/Unsupported template package asset/);
  });

  it('rejects path changes and executable source', async () => {
    const zip = await JSZip.loadAsync(await (await exportTemplates([custom])).arrayBuffer());
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    manifest.templates[0].path = '../escape.json';
    zip.file('manifest.json', JSON.stringify(manifest));
    await expect(importTemplates(asFile(await zip.generateAsync({ type:'blob' })))).rejects.toThrow();
  });
});
