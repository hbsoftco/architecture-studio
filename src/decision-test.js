function parseXML(xml) {
  if (/<!DOCTYPE|<!ENTITY|<script\b/i.test(xml)) throw new Error('Unsafe XML');
  const tree = new DOMParser().parseFromString(xml, 'application/xml');
  if (tree.querySelector('parsererror')) throw new Error('Invalid DMN XML');
  return tree;
}
const children = (node, name) => [...node.children].filter(child => child.localName === name);
const child = (node, name) => children(node, name)[0];
const text = node => node?.textContent?.trim() || '';

function literal(raw, type) {
  const value = raw.trim();
  if (type === 'string') {
    if (!/^"(?:[^"\\]|\\.)*"$/.test(value)) throw new Error(`Unsupported string expression: ${value}`);
    return JSON.parse(value);
  }
  if (type === 'boolean') {
    if (value !== 'true' && value !== 'false') throw new Error(`Unsupported boolean expression: ${value}`);
    return value === 'true';
  }
  if (type === 'number' || type === 'integer' || type === 'long' || type === 'double') {
    const number = Number(value);
    if (!Number.isFinite(number) || !value) throw new Error(`Unsupported number expression: ${value}`);
    return number;
  }
  throw new Error(`Unsupported DMN type: ${type}`);
}

function matches(expression, input, type) {
  const raw = expression.trim();
  if (raw === '-') return true;
  if (raw.includes(',')) return raw.split(',').some(part => matches(part, input, type));
  const range = raw.match(/^([[(])\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)\s*([)\]])$/);
  if (range) {
    if (typeof input !== 'number') throw new Error('Numeric range requires a number');
    const lo = Number(range[2]), hi = Number(range[3]);
    return (range[1] === '[' ? input >= lo : input > lo) && (range[4] === ']' ? input <= hi : input < hi);
  }
  const compare = raw.match(/^(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (compare) {
    if (typeof input !== 'number') throw new Error('Numeric comparison requires a number');
    const value = Number(compare[2]);
    return compare[1] === '<' ? input < value : compare[1] === '>' ? input > value : compare[1] === '<=' ? input <= value : input >= value;
  }
  return input === literal(raw, type);
}

export function evaluateDecision(xml, inputs) {
  const tree = parseXML(xml);
  const decision = [...tree.getElementsByTagName('*')].find(node => node.localName === 'decision' && child(node, 'decisionTable'));
  if (!decision) throw new Error('No supported decision table found');
  const table = child(decision, 'decisionTable');
  const policy = table.getAttribute('hitPolicy') || 'UNIQUE';
  if (!['UNIQUE', 'FIRST', 'COLLECT'].includes(policy)) throw new Error(`Unsupported hit policy: ${policy}`);
  const inputColumns = children(table, 'input').map(column => {
    const expression = child(column, 'inputExpression');
    return { name: text(child(expression, 'text')), type: expression?.getAttribute('typeRef') || 'string' };
  });
  const outputColumns = children(table, 'output').map(column => ({ name: column.getAttribute('name') || column.getAttribute('label') || column.getAttribute('id'), type: column.getAttribute('typeRef') || 'string' }));
  if (!inputColumns.length || !outputColumns.length) throw new Error('Decision table requires inputs and outputs');
  for (const column of inputColumns) if (!(column.name in inputs)) throw new Error(`Missing test input: ${column.name}`);
  const matchesRules = [];
  for (const [index, rule] of children(table, 'rule').entries()) {
    const entries = children(rule, 'inputEntry');
    if (entries.length !== inputColumns.length) throw new Error(`Rule ${index + 1} has an invalid input count`);
    if (entries.every((entry, columnIndex) => matches(text(child(entry, 'text')), inputs[inputColumns[columnIndex].name], inputColumns[columnIndex].type))) {
      const outputs = children(rule, 'outputEntry');
      if (outputs.length !== outputColumns.length) throw new Error(`Rule ${index + 1} has an invalid output count`);
      const result = Object.fromEntries(outputs.map((entry, columnIndex) => [outputColumns[columnIndex].name, literal(text(child(entry, 'text')), outputColumns[columnIndex].type)]));
      matchesRules.push({ ruleId: rule.getAttribute('id') || String(index + 1), result });
      if (policy === 'FIRST') break;
    }
  }
  if (policy === 'UNIQUE' && matchesRules.length > 1) throw new Error('UNIQUE hit policy matched multiple rules');
  return { decisionId: decision.getAttribute('id'), policy, matches: matchesRules, result: policy === 'COLLECT' ? matchesRules.map(item => item.result) : matchesRules[0]?.result ?? null };
}
