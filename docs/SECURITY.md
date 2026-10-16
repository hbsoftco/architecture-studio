# Security

The application has a restrictive HTML CSP, blocks external runtime connections, uses Mermaid strict mode and DOMPurify for generated SVG, rejects XML with DTD/entity/script declarations on file import and source replacement, validates ZIP paths, and caps archive/file sizes. Text in the workspace and graph SVG is escaped or set through `textContent`.

This is an initial boundary, not a completed security audit. BPMN/DMN import via their modelers needs malicious fixture testing. ZIP entry size checks rely on JSZip metadata and still need adversarial archive tests. Do not import files from untrusted sources into a sensitive browser profile.
