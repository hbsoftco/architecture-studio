# Diagram adapters

| Adapter | Editing level | Authoritative data | Implemented |
| --- | --- | --- | --- |
| Mermaid | C: source-preview | Mermaid source | source edit, parse diagnostics, preview, SVG/PNG export |
| BPMN | A: native-visual | BPMN XML | native modeler, XML import/export, SVG/PNG export, undo/redo, limited step simulation |
| DMN | A: native-visual | DMN XML | native modeler, DRD/table/literal views where supported, XML import/export, limited table testing |
| Visual graph | A: native-visual | versioned JSON | nodes, connectors, drag, properties, undo/redo, SVG/PNG export |

Level B (verified lossless bidirectional editing) is not claimed. Native XML editors expose source replacement as a separate operation; unsupported extensions may not survive modeler serialization.
