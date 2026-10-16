import { describe, expect, it } from 'vitest';
import { TYPES, validateGraph } from '../src/model.js';
import { catalog, createCatalogDocument, guideSlides, searchCatalog } from '../src/catalog.js';

describe('diagram catalog', () => {
  it('only exposes registered adapters and has a guide for each choice', () => {
    expect(catalog.length).toBeGreaterThan(8);
    for (const item of catalog) {
      expect(TYPES[item.type]).toBeDefined();
      expect(guideSlides(item, 'fa')).toHaveLength(9);
      expect(guideSlides(item, 'en')).toHaveLength(9);
    }
  });

  it('searches aliases, categories, and Persian/Arabic forms', () => {
    expect(searchCatalog('فرايند', 'fa').map(item => item.id)).toContain('bpmn');
    expect(searchCatalog('پايگاه داده', 'fa').map(item => item.id)).toContain('erd');
    expect(searchCatalog('KUBERNETES', 'en').map(item => item.id)).toContain('infrastructure');
    expect(searchCatalog('uml', 'en').map(item => item.id)).toContain('sequence');
    expect(searchCatalog('no-such-diagram', 'en')).toEqual([]);
  });

  it('creates valid documents using the registered adapter and template', () => {
    for (const entry of catalog) {
      const document = createCatalogDocument(entry, 'Example');
      expect(document.type).toBe(entry.type);
      expect(document.name).toBe('Example');
      if (['c4','erd','infrastructure','dfd','general'].includes(entry.type)) validateGraph(JSON.parse(document.content));
      if (entry.id === 'sequence') expect(document.content).toMatch(/^sequenceDiagram/);
    }
  });
});
