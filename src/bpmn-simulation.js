const SUPPORTED = new Set(['startEvent', 'endEvent', 'task', 'userTask', 'serviceTask', 'exclusiveGateway']);

export function createBpmnSimulation(xml) {
  if (/<!DOCTYPE|<!ENTITY|<script\b/i.test(xml)) throw new Error('Unsafe XML');
  const tree = new DOMParser().parseFromString(xml, 'application/xml');
  if (tree.querySelector('parsererror')) throw new Error('Invalid BPMN XML');
  const elements = [...tree.getElementsByTagName('*')];
  const nodes = new Map();
  const flows = new Map();
  for (const element of elements) {
    if (SUPPORTED.has(element.localName) && element.getAttribute('id')) nodes.set(element.getAttribute('id'), { id: element.getAttribute('id'), type: element.localName, name: element.getAttribute('name') || element.localName });
    if (element.localName === 'sequenceFlow') flows.set(element.getAttribute('id'), { id: element.getAttribute('id'), from: element.getAttribute('sourceRef'), to: element.getAttribute('targetRef'), name: element.getAttribute('name') || '' });
  }
  if (!nodes.size) throw new Error('No supported BPMN elements found');
  const starts = [...nodes.values()].filter(node => node.type === 'startEvent');
  if (!starts.length) throw new Error('Simulation requires a start event');
  for (const flow of flows.values()) if (!nodes.has(flow.from) || !nodes.has(flow.to)) throw new Error(`Unsupported flow target: ${flow.id}`);
  let tokens = starts.map(node => node.id);
  let steps = 0;
  return {
    get tokens() { return [...tokens]; },
    get current() { return tokens.map(id => nodes.get(id)); },
    get choices() { return tokens.flatMap(id => nodes.get(id)?.type === 'exclusiveGateway' ? [...flows.values()].filter(flow => flow.from === id) : []); },
    step(choiceId = null) {
      if (++steps > 500) throw new Error('Simulation step limit reached');
      const next = [];
      for (const id of tokens) {
        const node = nodes.get(id);
        if (!node) continue;
        if (node.type === 'endEvent') continue;
        const outgoing = [...flows.values()].filter(flow => flow.from === id);
        if (node.type === 'exclusiveGateway') {
          const chosen = outgoing.find(flow => flow.id === choiceId);
          if (!chosen) throw new Error(`Choose a sequence flow for ${node.name}`);
          next.push(chosen.to);
        } else {
          if (outgoing.length > 1) throw new Error(`Unsupported multiple outgoing flows from ${node.name}`);
          if (outgoing[0]) next.push(outgoing[0].to);
        }
      }
      tokens = next;
      return this.current;
    },
    reset() { tokens = starts.map(node => node.id); steps = 0; return this.current; },
  };
}
