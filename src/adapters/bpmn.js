import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { bpmnTextModule } from './bpmn-text.js';

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://architecture.studio/bpmn">
  <bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="StartEvent_1" name="آغاز" /></bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"><bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="180" y="120" width="36" height="36" /></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export async function mountBpmn(host, source, onChange, onError, onSelect = () => {}) {
  host.dir = 'ltr';
  // Font metrics are captured while XML is imported, including after refresh
  // and when a project or diagram is reopened.
  await document.fonts.load('12px Vazirmatn', 'فارسی BPMN');
  await document.fonts.ready;
  if (!document.fonts.check('12px Vazirmatn', 'فارسی BPMN')) throw new Error('Vazirmatn font is unavailable');
  const { default: Modeler } = await import('bpmn-js/lib/Modeler');
  const modeler = new Modeler({
    container: host,
    additionalModules: [ bpmnTextModule ],
    textRenderer: { defaultStyle: { fontFamily: 'Vazirmatn, sans-serif' } }
  });
  try {
    const { warnings } = await modeler.importXML(source || EMPTY);
    modeler.get('canvas').zoom('fit-viewport');
    onError(warnings.length ? warnings.map(w => w.message || String(w)).join('; ') : null);
  } catch (error) { onError(error.message || String(error)); }
  let timer;
  modeler.on('commandStack.changed', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { onChange((await modeler.saveXML({ format: true })).xml); }
      catch (error) { onError(error.message || String(error)); }
    }, 350);
  });
  modeler.get('eventBus').on('selection.changed', event => {
    const element = event.newSelection[0];
    onSelect(element ? { id: element.id, type: element.type, name: element.businessObject?.name || '' } : null);
  });
  let marked = [];
  return {
    async getContent() { return (await modeler.saveXML({ format: true })).xml; },
    async getSVG() { return (await modeler.saveSVG()).svg; },
    undo() { modeler.get('commandStack').undo(); },
    redo() { modeler.get('commandStack').redo(); },
    zoom(delta) { const canvas = modeler.get('canvas'); canvas.zoom(canvas.zoom() * delta); },
    fit() { modeler.get('canvas').zoom('fit-viewport'); },
    pan() { const handTool = modeler.get('handTool'); handTool.toggle(); return handTool.isActive(); },
    resize() { modeler.get('canvas').resized(); },
    renameSelected(id, name) { const element = modeler.get('elementRegistry').get(id); if (element) modeler.get('modeling').updateProperties(element, { name }); },
    find(query) {
      const normalized = query.toLocaleLowerCase();
      const element = modeler.get('elementRegistry').find(item => item.id.toLocaleLowerCase().includes(normalized) || item.businessObject?.name?.toLocaleLowerCase().includes(normalized));
      if (!element) return null;
      modeler.get('selection').select(element);
      modeler.get('canvas').scrollToElement(element);
      return { id: element.id, name: element.businessObject?.name || element.id };
    },
    mark(ids) { const canvas = modeler.get('canvas'); for (const id of marked) canvas.removeMarker(id, 'sim-active'); marked = ids; for (const id of ids) if (modeler.get('elementRegistry').get(id)) canvas.addMarker(id, 'sim-active'); },
    destroy() { clearTimeout(timer); modeler.destroy(); },
  };
}
