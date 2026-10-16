import { uid, validateGraph } from './model.js';

const SVG = 'http://www.w3.org/2000/svg';
const make = (tag, attrs = {}) => {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
};

export class GraphEditor {
  constructor(host, content, onChange, onSelect) {
    this.host = host;
    this.model = validateGraph(JSON.parse(content));
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.selected = null;
    this.history = [JSON.stringify(this.model)];
    this.position = 0;
    this.scale = 1;
    this.view = { x: 0, y: 0, w: 1400, h: 900 };
    this.svg = make('svg', { class: 'graph-svg', viewBox: '0 0 1400 900', xmlns: SVG, role: 'img', 'aria-label': 'Diagram canvas' });
    this.host.replaceChildren(this.svg);
    this.svg.addEventListener('pointermove', event => this.move(event));
    this.svg.addEventListener('pointerup', () => this.end());
    this.svg.addEventListener('pointercancel', () => this.end());
    this.svg.addEventListener('pointerdown', event => {
      if (!this.panMode) return;
      this.panDrag = { x: event.clientX, y: event.clientY, vx: this.view.x, vy: this.view.y };
      this.svg.setPointerCapture(event.pointerId);
      event.preventDefault(); event.stopPropagation();
    }, true);
    this.svg.addEventListener('pointerdown', event => {
      if (event.target === this.svg || event.target.hasAttribute('data-background')) {
        this.panDrag = { x: event.clientX, y: event.clientY, vx: this.view.x, vy: this.view.y };
        this.svg.setPointerCapture(event.pointerId);
      }
    });
    this.svg.addEventListener('wheel', event => { event.preventDefault(); this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    this.svg.addEventListener('dblclick', event => { if (event.target === this.svg || event.target.hasAttribute('data-background')) { const rect = this.svg.getBoundingClientRect(); this.addNode('box', event.clientX - rect.left, event.clientY - rect.top); } });
    this.render();
  }
  commit() {
    const content = JSON.stringify(this.model);
    this.history = this.history.slice(0, this.position + 1);
    this.history.push(content);
    this.position++;
    this.onChange(content);
    this.render();
  }
  addNode(kind = 'box', x = 180, y = 160) {
    const point = this.point(x, y);
    const node = { id: uid(), kind, label: kind === 'entity' ? 'موجودیت' : kind === 'database' ? 'پایگاه داده' : 'عنصر جدید', labelDirection: 'auto', x: Math.round(point.x / 20) * 20, y: Math.round(point.y / 20) * 20, w: 180, h: 96, fill: '#e7f1ee' };
    this.model.nodes.push(node);
    this.selected = node.id;
    this.commit();
    this.onSelect(node);
  }
  connect() {
    if (!this.selected) return;
    this.connectFrom = this.selected;
    this.onSelect(this.model.nodes.find(node => node.id === this.selected), 'connector');
  }
  deleteSelected() {
    if (!this.selected) return;
    this.model.nodes = this.model.nodes.filter(node => node.id !== this.selected);
    this.model.edges = this.model.edges.filter(edge => edge.from !== this.selected && edge.to !== this.selected && edge.id !== this.selected);
    this.selected = null;
    this.commit();
    this.onSelect(null);
  }
  copySelected() { const node = this.model.nodes.find(item => item.id === this.selected); if (node) this.clipboard = structuredClone(node); }
  paste() {
    if (!this.clipboard) return;
    const node = { ...structuredClone(this.clipboard), id: uid(), x: this.clipboard.x + 40, y: this.clipboard.y + 40 };
    this.clipboard = structuredClone(node);
    this.model.nodes.push(node); this.selected = node.id; this.commit(); this.onSelect(node);
  }
  autoLayout() {
    this.model.nodes.forEach((node, index) => { node.x = this.model.flowDirection === 'rtl' ? 1100 - (index % 4) * 300 : 90 + (index % 4) * 300; node.y = 90 + Math.floor(index / 4) * 180; });
    this.commit();
  }
  setFlowDirection(direction) { if (!['ltr', 'rtl'].includes(direction)) return; this.model.flowDirection = direction; this.commit(); }
  updateSelected(patch) {
    const item = this.model.nodes.find(node => node.id === this.selected) || this.model.edges.find(edge => edge.id === this.selected);
    if (!item) return;
    Object.assign(item, patch);
    this.commit();
  }
  undo() { if (this.position > 0) this.restore(--this.position); }
  redo() { if (this.position < this.history.length - 1) this.restore(++this.position); }
  restore(position) { this.model = JSON.parse(this.history[position]); this.onChange(this.history[position]); this.render(); }
  zoom(factor) {
    const nextW = Math.max(350, Math.min(2800, this.view.w / factor));
    const nextH = nextW * 900 / 1400;
    this.view.x += (this.view.w - nextW) / 2;
    this.view.y += (this.view.h - nextH) / 2;
    this.view.w = nextW; this.view.h = nextH;
    this.render();
  }
  fit() { this.view = { x: 0, y: 0, w: 1400, h: 900 }; this.render(); }
  pan() { this.panMode = !this.panMode; this.svg.style.cursor = this.panMode ? 'grab' : ''; return this.panMode; }
  resize() { this.svg.setAttribute('viewBox', `${this.view.x} ${this.view.y} ${this.view.w} ${this.view.h}`); }
  point(x, y) {
    const rect = this.svg.getBoundingClientRect();
    const point = new DOMPoint(rect.left + x, rect.top + y).matrixTransform(this.svg.getScreenCTM().inverse());
    return { x: point.x, y: point.y };
  }
  move(event) {
    if (this.panDrag) {
      const rect = this.svg.getBoundingClientRect();
      this.view.x = this.panDrag.vx - (event.clientX - this.panDrag.x) * this.view.w / rect.width;
      this.view.y = this.panDrag.vy - (event.clientY - this.panDrag.y) * this.view.h / rect.height;
      this.render(); return;
    }
    if (!this.drag) return;
    const node = this.model.nodes.find(item => item.id === this.drag.id);
    if (!node) return;
    const point = this.point(event.clientX - this.svg.getBoundingClientRect().left, event.clientY - this.svg.getBoundingClientRect().top);
    node.x = Math.round((point.x - this.drag.dx) / 20) * 20;
    node.y = Math.round((point.y - this.drag.dy) / 20) * 20;
    this.render();
  }
  end() { this.panDrag = null; if (this.drag) { this.drag = null; this.commit(); } }
  render() {
    this.svg.setAttribute('viewBox', `${this.view.x} ${this.view.y} ${this.view.w} ${this.view.h}`);
    this.svg.replaceChildren();
    const defs = make('defs');
    const pattern = make('pattern', { id: 'grid', width: 20, height: 20, patternUnits: 'userSpaceOnUse' });
    pattern.append(make('circle', { cx: 1, cy: 1, r: 1, fill: '#c8d8d4' }));
    defs.append(pattern);
    this.svg.append(defs, make('rect', { width: 1400, height: 900, fill: '#f8fbfa', 'data-background': '' }), make('rect', { width: 1400, height: 900, fill: 'url(#grid)', 'data-background': '' }));
    for (const edge of this.model.edges) {
      const from = this.model.nodes.find(node => node.id === edge.from);
      const to = this.model.nodes.find(node => node.id === edge.to);
      if (!from || !to) continue;
      const x1 = from.x + from.w / 2, y1 = from.y + from.h / 2, x2 = to.x + to.w / 2, y2 = to.y + to.h / 2;
      const path = make('path', { d: `M ${x1} ${y1} L ${x1} ${(y1+y2)/2} L ${x2} ${(y1+y2)/2} L ${x2} ${y2}`, fill: 'none', stroke: edge.id === this.selected ? '#0b7776' : '#668481', 'stroke-width': 2.5 });
      path.style.cursor = 'pointer';
      path.addEventListener('click', () => { this.selected = edge.id; this.render(); this.onSelect(edge); });
      this.svg.append(path);
      const label = make('text', { x: (x1+x2)/2, y: (y1+y2)/2 - 8, 'text-anchor': 'middle', 'font-size': 15, fill: '#31545a', direction: 'auto' });
      label.textContent = edge.label || '';
      this.svg.append(label);
    }
    for (const node of this.model.nodes) {
      const group = make('g', { transform: `translate(${node.x},${node.y})`, 'data-node': node.id, tabindex: 0 });
      const shape = make(node.kind === 'database' ? 'ellipse' : 'rect', node.kind === 'database' ? { cx: node.w/2, cy: node.h/2, rx: node.w/2, ry: node.h/2 } : { width: node.w, height: node.h, rx: node.kind === 'entity' ? 3 : 14 });
      shape.setAttribute('fill', node.fill || '#e7f1ee');
      shape.setAttribute('stroke', node.id === this.selected ? '#0b7776' : '#86aaa4');
      shape.setAttribute('stroke-width', node.id === this.selected ? 3 : 1.5);
      group.append(shape);
      const label = make('text', { x: node.w/2, y: node.h/2+5, 'text-anchor': 'middle', 'font-size': 17, fill: '#173f44', direction: node.labelDirection || 'auto', 'unicode-bidi': 'plaintext' });
      label.textContent = node.label;
      group.append(label);
      group.style.cursor = 'move';
      group.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (this.connectFrom && this.connectFrom !== node.id) {
          this.model.edges.push({ id: uid(), from: this.connectFrom, to: node.id, label: '' });
          this.connectFrom = null;
          this.commit();
        } else {
          this.selected = node.id;
          const point = this.point(event.clientX - this.svg.getBoundingClientRect().left, event.clientY - this.svg.getBoundingClientRect().top);
          this.drag = { id: node.id, dx: point.x-node.x, dy: point.y-node.y };
          this.svg.setPointerCapture(event.pointerId);
          this.render();
          this.onSelect(node);
        }
      });
      this.svg.append(group);
    }
  }
  getSVG() { return this.svg; }
  destroy() { this.host.replaceChildren(); }
}
