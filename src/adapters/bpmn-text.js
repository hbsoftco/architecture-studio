import TextRenderer from 'bpmn-js/lib/draw/TextRenderer';

const RTL = /[\u0590-\u08ff\ufb1d-\ufefc]/;
const LTR = /[A-Za-z\u00c0-\u02ff]/;

export function labelDirection(text) {
  for (const character of text) {
    if (RTL.test(character)) return 'rtl';
    if (LTR.test(character)) return 'ltr';
  }
  return 'ltr';
}

// bpmn-js measures and lays out labels through this same service. Keep its
// normal layout logic, then isolate each SVG line's bidirectional text.
export class BpmnTextRenderer extends TextRenderer {
  constructor(config) {
    super(config);
    const createText = this.createText;
    this.createText = (text, options = {}) => {
      const element = createText(text, options);
      for (const line of element.querySelectorAll('tspan')) {
        const direction = labelDirection(line.textContent);
        line.setAttribute('direction', direction);
        line.setAttribute('unicode-bidi', 'isolate');
        if (direction === 'rtl') {
          // diagram-js records the left edge in x. In SVG, `end` with RTL
          // direction keeps that edge fixed while using RTL bidi ordering.
          line.setAttribute('text-anchor', 'end');
        } else {
          line.setAttribute('text-anchor', 'start');
        }
      }
      return element;
    };
  }
}

BpmnTextRenderer.$inject = [ 'config.textRenderer' ];
export const bpmnTextModule = { textRenderer: [ 'type', BpmnTextRenderer ] };
