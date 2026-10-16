# BPMN Persian label rendering

## Audit and root causes

- `src/style.css` loads a bundled variable Vazirmatn WOFF2 for the shell. The BPMN canvas was not covered by the graph or Mermaid SVG selectors. `bpmn-js/lib/draw/TextRenderer.js` defaulted to `Arial, sans-serif`, and `diagram-js/lib/util/Text.js` used that style in `canvas.measureText()` to split and place lines. The browser confirmed the original SVG task label computed as Arial. A CSS font override alone would have left Arial line measurements in place.
- `src/adapters/bpmn.js` previously called `importXML()` immediately, before the local font was loaded. On refresh or document switching, fallback font metrics could be used for the first layout.
- `src/main.js` sets the document `dir` according to the shell language and remounts the editor on a language switch. BPMN text had no label-level bidi metadata and inherited the shell direction. The original Persian/mixed task label visibly crossed its task boundary in [the baseline capture](qa/bpmn-before.png).
- Direct editing is an HTML contenteditable layer, while normal labels are SVG text/tspan elements. The bpmn-js editing provider reads its font from the same `textRenderer` service; the editor now also uses `unicode-bidi: plaintext` for each paragraph.
- `src/main.js` embedded the local font in image SVGs, but its `saveImage()` did not await the asynchronous BPMN `getSVG()` method. BPMN SVG and PNG export therefore failed before serialization.

## Changes

- `src/adapters/bpmn.js` waits for Vazirmatn before import, configures bpmn-js's text renderer to measure and draw with that font, and fixes the canvas base direction to LTR independently of the shell.
- `src/adapters/bpmn-text.js` adds per-line direction based on the first strong character and isolates each SVG tspan. RTL uses SVG end anchoring at the left edge calculated by diagram-js, preserving its positions. Text strings and BPMN DI geometry are untouched.
- `src/style.css` gives the direct editing contenteditable layer Vazirmatn and paragraph-level bidi handling.
- `src/main.js` awaits SVG creation. Its existing image path embeds the local WOFF2 as a data URL, which was exercised with the network disabled in the production build.

## Visual verification

All captures use `tests/fixtures/bpmn-rtl.bpmn`, the real local font, and headless Chrome. The fixture has a task with a long multiline mixed label, event and gateway labels, sequence flow labels, and vertical lane and pool labels. Its DI bounds and waypoints are fixed.

| Original bpmn-js settings | Fixed editor, Persian shell | Fixed editor, English shell | Downloaded PNG |
| --- | --- | --- | --- |
| [Before](qa/bpmn-before.png) | [After in Persian](qa/bpmn-after-fa.png) | [After in English](qa/bpmn-after-en.png) | [PNG export](qa/bpmn-export.png) |

The baseline computed as Arial with no tspan direction. The fixed task computed as Vazirmatn with RTL tspan direction; the browser test compares each element transform and label x value across the two shell languages and after refresh. The long task label remains inside its task bounds.

## Verification and limits

`npm test`, `npm run build`, and `npm run test:browser` pass. `CHECK_OFFLINE=1 APP_URL=http://127.0.0.1:4174/ node scripts/bpmn-rtl-smoke.mjs` passed against the production preview. The browser suite verifies XML export/re-import, embedded-font SVG, and PNG signature and size; the PNG was visually inspected for connected Persian glyphs.

Imported DI can still contain bounds too small for its words or external label positions that collide with other shapes. The editor preserves that source geometry. Browser visual checks were performed in Chrome; standalone SVG and PNG rendering in other engines has not been checked.
