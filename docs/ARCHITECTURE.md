# Architecture

`src/main.js` owns workspace state, tabs, project actions, and editor lifecycle. `src/model.js` defines versioned project/document/graph models and validation. `src/storage.js` owns IndexedDB transactions. `src/export.js` owns portable ZIP and image export. `src/adapters/` isolates Mermaid, BPMN, and DMN engines. `src/graph-editor.js` owns the direct manipulation SVG graph model.

The editor adapters are imported on first use. Every document has one authoritative representation: source text, XML, or graph JSON. IndexedDB holds complete project records and explicit snapshots. ZIP export separates document content from `project.json` and uses relative paths.
