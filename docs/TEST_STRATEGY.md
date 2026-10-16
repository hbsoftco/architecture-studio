# Test strategy

The unit suite also rejects malicious XML in project ZIPs and ZIP entry paths that traverse outside the archive root.

Vitest covers project validation, graph connector validation, path rejection, diagram links, and Persian ZIP round-trip. `scripts/smoke.mjs` drives installed Chrome through project creation, Mermaid rendering, autosave/reload, and ZIP download. `scripts/editor-smoke.mjs` checks BPMN reload, DMN mounting, and graph node restore. `scripts/sample-smoke.mjs` imports the four-document sample ZIP and renders every document. `scripts/roundtrip-smoke.mjs` tests BPMN visual label edit and DMN source export/re-import. `scripts/simulation-smoke.mjs` steps the BPMN sample and evaluates the DMN sample. `scripts/image-smoke.mjs` checks Persian SVG and PNG export. `scripts/offline-smoke.mjs` blocks network after PWA install and checks Mermaid rendering and IndexedDB restore. Planned tests include DMN edit round-trip fixtures, malicious sources, and accessibility.
