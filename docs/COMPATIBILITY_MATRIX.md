# Compatibility matrix

| Format | Import | Edit | Export | Verified round-trip |
| --- | --- | --- | --- | --- |
| Mermaid `.mmd` | yes | source | `.mmd`, SVG, PNG | source autosave/ZIP and Persian SVG/PNG smoke |
| BPMN `.bpmn` | yes | bpmn-js | `.bpmn`, SVG, PNG | sample import → visual label edit → export → re-import smoke |
| DMN `.dmn` | yes | dmn-js | `.dmn` | sample import → export → re-import smoke; edit preservation pending |
| Graph JSON | yes | SVG graph editor | `.json`, SVG, PNG | node autosave/reload smoke and unit validation |
| Project ZIP | yes | project workspace | ZIP | unit test and four-document sample browser import |

The native modelers' supported BPMN and DMN feature subsets depend on the pinned library versions. Unknown extensions are not yet guaranteed to round-trip.
