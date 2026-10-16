import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';

const EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_1" name="تصمیم جدید" namespace="http://architecture.studio/dmn">
  <decision id="Decision_1" name="تصمیم جدید"><decisionTable id="DecisionTable_1" hitPolicy="UNIQUE"><input id="Input_1" label="ورودی"><inputExpression id="InputExpression_1" typeRef="string"><text>input</text></inputExpression></input><output id="Output_1" label="خروجی" name="result" typeRef="string"/></decisionTable></decision>
  <dmndi:DMNDI><dmndi:DMNDiagram id="DMNDiagram_1"><dmndi:DMNShape id="DMNShape_1" dmnElementRef="Decision_1"><dc:Bounds x="160" y="110" width="180" height="80"/></dmndi:DMNShape></dmndi:DMNDiagram></dmndi:DMNDI>
</definitions>`;

export async function mountDmn(host, source, onChange, onError) {
  const { default: Modeler } = await import('dmn-js/lib/Modeler');
  const modeler = new Modeler({ container: host });
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { onChange((await modeler.saveXML({ format: true })).xml); }
      catch (error) { onError(error.message || String(error)); }
    }, 350);
  };
  modeler.on('viewer.created', ({ viewer }) => {
    viewer.on('elements.changed', schedule);
    viewer.on('commandStack.changed', schedule);
  });
  host.addEventListener('change', schedule);
  host.addEventListener('input', schedule);
  try {
    const { warnings } = await modeler.importXML(source || EMPTY);
    onError(warnings.length ? warnings.map(w => w.message || String(w)).join('; ') : null);
  } catch (error) { onError(error.message || String(error)); }
  modeler.on('views.changed', schedule);
  const service = name => modeler.getActiveViewer()?.get?.(name, false);
  return {
    async getContent() { return (await modeler.saveXML({ format: true })).xml; },
    undo() { service('commandStack')?.undo(); },
    redo() { service('commandStack')?.redo(); },
    zoom(delta) { const canvas = service('canvas'); if (canvas) canvas.zoom(canvas.zoom() * delta); },
    fit() { service('canvas')?.zoom('fit-viewport'); },
    pan() { const handTool = service('handTool'); handTool?.toggle(); return handTool?.isActive() || false; },
    resize() { service('canvas')?.resized(); },
    destroy() { clearTimeout(timer); modeler.destroy(); },
  };
}
