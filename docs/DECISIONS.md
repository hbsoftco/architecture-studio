# Decisions

- Vanilla JavaScript ES modules and Vite provide a small application core. Specialized diagram engines are lazy loaded.
- Mermaid is source-preview only. There is no arbitrary visual-to-Mermaid conversion.
- BPMN/DMN XML remains authoritative. Graph documents use schema version 1 JSON.
- IndexedDB is the primary store; ZIP is the backup and transfer format.
- Vazirmatn is bundled from the OFL-1.1 licensed package. SVG exports embed the font as a data URL.
- PWA service worker precaches built assets, including lazy editor chunks, for offline use after installation.
