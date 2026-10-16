import { validateTemplateContent } from './template-core.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const start = (width, height, x = 0, y = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" role="img" aria-label="Template diagram"><style>text{font:14px Vazirmatn,sans-serif;fill:#244744} .box{fill:#e7f1ee;stroke:#5d938a;stroke-width:2} .edge{fill:none;stroke:#57827b;stroke-width:2;marker-end:url(#arrow)}</style><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="#57827b"/></marker></defs>`;
const end = '</svg>';
let fontReady;
async function measureFont() {
  fontReady ||= document.fonts.load('14px Vazirmatn').catch(() => []);
  await fontReady;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = '14px Vazirmatn, sans-serif';
  return context;
}

function linesFor(label, width, context, limit = 3) {
  width = Math.max(16, width);
  const words = String(label ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const proposal = current ? `${current} ${word}` : word;
    if (context.measureText(proposal).width <= width) { current = proposal; continue; }
    if (current) { lines.push(current); current = ''; }
    for (const character of Array.from(word)) {
      if (context.measureText(current + character).width > width && current) { lines.push(current); current = ''; }
      current += character;
    }
  }
  if (current) lines.push(current);
  if (lines.length > limit) {
    lines.length = limit;
    while (lines[limit - 1] && context.measureText(`${lines[limit - 1]}…`).width > width) lines[limit - 1] = Array.from(lines[limit - 1]).slice(0, -1).join('');
    lines[limit - 1] += '…';
  }
  return lines.length ? lines : [''];
}

function labelSvg(label, x, centerY, width, context, limit = 3) {
  const lines = linesFor(label, width, context, limit);
  return `<text x="${x}" y="${centerY - (lines.length - 1) * 9}" text-anchor="middle" direction="auto"><title>${escape(label)}</title>${lines.map((line, index) => `<tspan x="${x}" dy="${index ? 18 : 0}">${escape(line)}</tspan>`).join('')}</text>`;
}

function graphSvg(content, context) {
  const model = JSON.parse(content);
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const minX = Math.min(0, ...model.nodes.map(node => node.x)) - 45;
  const minY = Math.min(0, ...model.nodes.map(node => node.y)) - 45;
  const width = Math.max(360, Math.max(0, ...model.nodes.map(node => node.x + node.w)) - minX + 45);
  const height = Math.max(240, Math.max(0, ...model.nodes.map(node => node.y + node.h)) - minY + 45);
  const edges = model.edges.map(edge => {
    const a = nodes.get(edge.from), b = nodes.get(edge.to);
    if (!a || !b) return '';
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
    return `<path class="edge" d="M${x1} ${y1}L${x2} ${y2}"/>${edge.label ? labelSvg(edge.label, (x1+x2)/2, (y1+y2)/2-12, Math.max(50, Math.abs(x2-x1)-22), context, 1) : ''}`;
  }).join('');
  const shapes = model.nodes.map(node => `<rect class="box" x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="12"/>${labelSvg(node.label, node.x+node.w/2, node.y+node.h/2+5, node.w-20, context)}`).join('');
  return `${start(width, height, minX, minY)}${edges}${shapes}${end}`;
}

function xmlTree(content) {
  const tree = new DOMParser().parseFromString(content, 'application/xml');
  if (tree.querySelector('parsererror')) throw new Error('Invalid XML preview');
  return tree;
}

function bpmnSvg(content) {
  const tree = xmlTree(content);
  const all = [...tree.getElementsByTagName('*')];
  const byId = new Map(all.filter(element => element.hasAttribute('id')).map(element => [element.getAttribute('id'), element]));
  const shapes = all.filter(element => element.localName === 'BPMNShape').map(shape => {
    const bounds = [...shape.children].find(child => child.localName === 'Bounds');
    const element = byId.get(shape.getAttribute('bpmnElement'));
    if (!bounds || !element) return null;
    const x = Number(bounds.getAttribute('x')), y = Number(bounds.getAttribute('y')),
      w = Number(bounds.getAttribute('width')), h = Number(bounds.getAttribute('height'));
    if (![x,y,w,h].every(Number.isFinite)) return null;
    return { id: element.getAttribute('id'), kind: element.localName, name: element.getAttribute('name') || '', x, y, w, h };
  }).filter(Boolean);
  if (!shapes.length) throw new Error('BPMN DI is missing');
  const minX = Math.min(...shapes.map(shape => shape.x)) - 35, minY = Math.min(...shapes.map(shape => shape.y)) - 35;
  const width = Math.max(...shapes.map(shape => shape.x + shape.w)) - minX + 35;
  const height = Math.max(...shapes.map(shape => shape.y + shape.h)) - minY + 35;
  const shifts = new Map(shapes.map(shape => [shape.id, shape]));
  const edgeDI = new Map(all.filter(element => element.localName === 'BPMNEdge').map(edge => [edge.getAttribute('bpmnElement'), edge]));
  const edges = all.filter(element => element.localName === 'sequenceFlow').map(flow => {
    const di = edgeDI.get(flow.getAttribute('id'));
    const waypoints = di ? [...di.children].filter(child => child.localName === 'waypoint').map(point => [Number(point.getAttribute('x')) - minX, Number(point.getAttribute('y')) - minY]) : [];
    if (waypoints.length >= 2 && waypoints.every(point => point.every(Number.isFinite))) return `<path class="edge" d="M${waypoints.map(point => point.join(' ')).join('L')}"/>`;
    const a = shifts.get(flow.getAttribute('sourceRef')), b = shifts.get(flow.getAttribute('targetRef'));
    if (!a || !b) return '';
    return `<path class="edge" d="M${a.x+a.w-minX} ${a.y+a.h/2-minY}L${b.x-minX} ${b.y+b.h/2-minY}"/>`;
  }).join('');
  const figures = shapes.map(shape => {
    const x = shape.x-minX, y = shape.y-minY, cx = x+shape.w/2, cy = y+shape.h/2;
    const figure = shape.kind.endsWith('Event') ? `<circle class="box" cx="${cx}" cy="${cy}" r="${shape.w/2}"/>`
      : shape.kind === 'exclusiveGateway' ? `<path class="box" d="M${cx} ${y}L${x+shape.w} ${cy}L${cx} ${y+shape.h}L${x} ${cy}Z"/>`
      : `<rect class="box" x="${x}" y="${y}" width="${shape.w}" height="${shape.h}" rx="10"/>`;
    return `${figure}<text x="${cx}" y="${shape.kind.endsWith('Event') || shape.kind === 'exclusiveGateway' ? y+shape.h+20 : cy+5}" text-anchor="middle" direction="auto">${escape(shape.name)}</text>`;
  }).join('');
  return `${start(width, height)}${edges}${figures}${end}`;
}

function dmnSvg(content) {
  const tree = xmlTree(content);
  const all = [...tree.getElementsByTagName('*')];
  const table = all.find(element => element.localName === 'decisionTable');
  const decision = all.find(element => element.localName === 'decision');
  if (!table || !decision) throw new Error('DMN decision table is missing');
  const input = [...table.children].find(element => element.localName === 'input');
  const output = [...table.children].find(element => element.localName === 'output');
  const rules = [...table.children].filter(element => element.localName === 'rule');
  const height = Math.max(280, 260 + (Math.min(rules.length, 6) - 1) * 48);
  const rows = rules.slice(0, 6).map((rule, index) => {
    const entry = kind => [...rule.children].find(child => child.localName === kind)?.textContent?.trim() || '';
    const y = 175 + index * 48;
    return `<path d="M45 ${y+18}H675" stroke="#bad4ce"/><text x="190" y="${y}" text-anchor="middle">${escape(entry('inputEntry'))}</text><text x="510" y="${y}" text-anchor="middle">${escape(entry('outputEntry'))}</text>`;
  }).join('');
  return `${start(720, height)}<rect class="box" x="45" y="45" width="630" height="${height-90}" rx="12"/><text x="360" y="80" text-anchor="middle" font-weight="bold">${escape(decision.getAttribute('name'))}</text><path d="M45 105H675M360 105V${height-45}" stroke="#89b3aa" stroke-width="2"/><text x="190" y="135" text-anchor="middle">${escape(input?.getAttribute('label') || 'Input')}</text><text x="510" y="135" text-anchor="middle">${escape(output?.getAttribute('label') || 'Output')}</text>${rows}${rules.length > 6 ? `<text x="360" y="${height-55}" text-anchor="middle">+ ${rules.length - 6} …</text>` : ''}${end}`;
}

const cache = new Map();
function contentHash(content) {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export async function templateThumbnail(template) {
  validateTemplateContent(template);
  const key = `${template.diagramType}:${template.content.length}:${contentHash(template.content)}`;
  if (cache.has(key)) return cache.get(key);
  let svg;
  if (template.diagramType === 'mermaid') {
    await measureFont();
    const { mountMermaid } = await import('./adapters/mermaid.js');
    const host = document.createElement('div');
    let failure;
    await mountMermaid(host, template.content, error => { failure = error; });
    if (failure || !host.querySelector('svg')) throw new Error(failure || 'Mermaid preview failed');
    svg = host.innerHTML;
  } else if (template.diagramType === 'bpmn') svg = bpmnSvg(template.content);
  else if (template.diagramType === 'dmn') svg = dmnSvg(template.content);
  else svg = graphSvg(template.content, await measureFont());
  if (cache.size > 90) cache.clear();
  cache.set(key, svg);
  return svg;
}

export async function showTemplateThumbnail(template, host, language = 'fa') {
  const loading = language === 'fa' ? 'در حال ساخت پیش‌نمایش…' : 'Rendering preview…';
  const unavailable = language === 'fa' ? 'پیش‌نمایش در دسترس نیست. منبع قالب را بررسی کنید.' : 'Preview unavailable. Check the template source.';
  host.setAttribute('aria-busy', 'true');
  host.innerHTML = `<span class="template-preview-status"><span class="loading loading-spinner loading-xs" aria-hidden="true"></span>${loading}</span>`;
  try {
    const svg = await templateThumbnail(template);
    if (!host.isConnected) return;
    const { default: DOMPurify } = await import('dompurify');
    if (!host.isConnected) return;
    host.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['image', 'a', 'foreignObject'], FORBID_ATTR: ['href', 'xlink:href'] });
    const rendered = host.querySelector('svg');
    if (!rendered) throw new Error('Sanitized preview is empty');
    rendered.setAttribute('aria-label', `${template.title.fa} / ${template.title.en}`);
    const box = rendered.viewBox.baseVal;
    host.classList.toggle('template-preview-portrait', Boolean(box.width && box.height / box.width > 1.5));
  } catch (error) {
    if (host.isConnected) { host.textContent = unavailable; host.dataset.previewError = error.message || String(error); }
  } finally { if (host.isConnected) host.removeAttribute('aria-busy'); }
}
