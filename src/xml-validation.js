export function validateXMLDocument(xml, type) {
  const issues = [];
  if (/<!DOCTYPE|<!ENTITY|<script\b/i.test(xml)) return ['Unsafe XML declaration'];
  const tree = new DOMParser().parseFromString(xml, 'application/xml');
  if (tree.querySelector('parsererror')) return ['XML parser error'];
  const elements = [...tree.getElementsByTagName('*')];
  const ids = new Set();
  for (const element of elements) {
    const id = element.getAttribute('id');
    if (!id) continue;
    if (ids.has(id)) issues.push(`Duplicate ID: ${id}`);
    ids.add(id);
  }
  if (type === 'bpmn') {
    const processes = elements.filter(element => element.localName === 'process');
    if (!processes.length) issues.push('No BPMN process found');
    for (const process of processes) {
      const children = [...process.children];
      if (!children.some(child => child.localName === 'startEvent')) issues.push(`Process ${process.getAttribute('id') || ''} has no start event`);
      if (!children.some(child => child.localName === 'endEvent')) issues.push(`Process ${process.getAttribute('id') || ''} has no end event`);
    }
    for (const flow of elements.filter(element => element.localName === 'sequenceFlow')) {
      for (const attr of ['sourceRef', 'targetRef']) if (!ids.has(flow.getAttribute(attr))) issues.push(`Sequence flow ${flow.getAttribute('id') || ''} has invalid ${attr}`);
    }
  }
  if (type === 'dmn') {
    const decisions = elements.filter(element => element.localName === 'decision');
    if (!decisions.length) issues.push('No DMN decision found');
    for (const table of elements.filter(element => element.localName === 'decisionTable')) {
      const columns = [...table.children];
      if (!columns.some(child => child.localName === 'input')) issues.push(`Decision table ${table.getAttribute('id') || ''} has no input`);
      if (!columns.some(child => child.localName === 'output')) issues.push(`Decision table ${table.getAttribute('id') || ''} has no output`);
    }
  }
  return issues;
}
