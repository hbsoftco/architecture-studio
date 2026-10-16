# Template gallery implementation

## Baseline and plan

Baseline on 2026-10-16: `npm test` passes 11 tests; `npm run build` passes; all 10 Chrome browser suites pass. The supported document types are the eight keys in `src/model.js` `TYPES`. New Diagram currently opens the catalog with type search, previews, guide slides, and blank/starter creation. Projects and snapshots use IndexedDB version 1; documents autosave inside projects. No template store or package format exists.

1. Add a versioned template registry using `TYPES`, validated built-in source documents, and preview generation from the source.
2. Upgrade the existing IndexedDB database with a separate custom-template store, plus portable validated ZIP import/export.
3. Extend the existing New Diagram dialog with Templates and Blank Diagram modes, preserving catalog search, guide slides, names, and creation behavior.
4. Add Save as Template and My Templates management through application dialogs; instantiate independent project documents through the existing save/open path.
5. Add unit, browser, offline, and regression checks; document verified coverage and any adapter limits.

Project ZIP backup covers project documents and does not include global custom templates. Custom templates use their own portable export.

## Architecture and supported inventory

`src/model.js` `TYPES` remains the adapter registry. `src/template-library.js` supplies 19 built-in records; `src/template-core.js` validates metadata/content, searches, sorts, and instantiates independent documents. `src/template-preview.js` draws BPMN from DI, DMN from decision rules, and graph diagrams from versioned graph JSON. It renders Mermaid using the installed adapter only for visible cards or the selected detail; previews are read-only and cached. `src/template-gallery.js` extends the existing New Diagram dialog and reuses `guideSlides` for education. Blank Diagram retains the original catalog and starter behavior.

| Family | Built-in templates |
| --- | --- |
| BPMN | Request approval, service request, exception handling |
| DMN | Shipping method, eligibility |
| Mermaid | Validation flow, API sequence, order classes, order lifecycle, registration activity |
| C4 graph | Order system context, store containers, event-driven services |
| ERD graph | Users and roles, e-commerce data |
| DFD graph | Order data flow |
| Infrastructure graph | Three-tier deployment, load-balanced app |
| General graph | Project workflow |

All records have stable IDs, version 1, bilingual title/description/details, tags, source format, adapter compatibility, source content, and a guide reference where the existing catalog has one. Gallery filters cover source, type, category, normalized bilingual search, and recommended/name/recent/created ordering. Sort/filter preferences and recent use are local preferences. Lists render in batches of 40, and thumbnails render only when visible. Recommended is an editorial rank, not a popularity count.

The current adapter registry does not contain independent UML use-case/component editors, Kubernetes/cloud-specific editors, or a dedicated multi-decision DRD template authoring flow. Those examples are omitted rather than presented as editable built-ins. Mermaid source templates cover only syntax verified with the installed Mermaid version.

## Creation and custom management

New Diagram opens with the existing Blank Diagram catalog. Switching to Templates preserves the blank name and selection. The template mode has its own name and destination folder. Creation validates the record, makes a new project document ID, commits through the existing `saveProject` path, opens the existing editor, and closes the dialog only on success. Graph node/edge IDs and references are remapped. BPMN/DMN internal IDs are scoped to each XML document and remain unchanged so semantic references and DI coordinates survive cloning. Mermaid source is copied as an immutable string. The original template is not modified.

Save as Template is on the document toolbar and document menu. It serializes the active editor through its existing adapter, including current unsaved content, validates it, creates a source-derived thumbnail, and saves to the custom-template store. My Templates supports search, metadata editing, duplication, explicit two-step deletion, export, import, and creation. Built-ins have no edit or delete actions. Storage failures keep the dialog and entered values available for correction or retry.

## IndexedDB and migration

The existing `architecture-studio` database advances from version 1 to 2. It retains the `projects` and `snapshots` stores and adds a `templates` store keyed by stable template ID. The upgrade creates only missing stores and does not rewrite project documents. Each custom record has `schemaVersion: 1`, `version: 1`, `source: 'custom'`, adapter/source-format compatibility, bilingual metadata, string content, timestamps, and an optional sanitized SVG thumbnail. Bulk imports write records in one IndexedDB transaction. Custom templates are global to this browser origin, separate from projects and snapshots.

## Portable package

`.astpl` is a ZIP archive with `manifest.json` and one source file per template under `templates/<id>.<native extension>`. The manifest contains `kind: 'architecture-studio-templates'`, `schemaVersion: 1`, creation time, and template metadata including each source path. Runtime SVG thumbnails are optional and are regenerated after import; arbitrary additional assets are rejected. The import rejects unsupported versions/types, duplicate IDs inside a package, unexpected assets, unsafe paths, oversized archives/entries, unsafe XML/Mermaid source, and invalid graph JSON. On an ID conflict, the gallery offers copy, skip, or replace; built-ins cannot be overwritten. Project ZIP backups do **not** include these global templates, so export custom templates separately.

Package limits: 20 MB compressed, 30 MB expanded, 100 templates, 220 entries, and 2.1 MB per entry. These bounds protect browser memory and ZIP processing.

Preview hardening: the gallery waits for the local Vazirmatn font before measuring graph labels and rendering Mermaid. Graph labels wrap within source node bounds; the preview shortens labels beyond three lines while keeping the authoritative graph JSON untouched. The built-in class diagram requests a horizontal Mermaid layout, and DMN rows use source-dependent preview height. Cards render lazily; a render error produces a localized fallback. Imported and exported Mermaid sources must render successfully, and creation rechecks Mermaid source. Invalid stored metadata is retained in IndexedDB and excluded from the gallery with a visible warning, so one corrupt record cannot block other templates. Malformed local gallery preferences are ignored. Graph templates are bounded to 2,000 nodes, 5,000 edges, coordinates within ±100,000, and node dimensions no greater than 10,000 for safe previewing.

## Verification

`npm test`, `npm run build`, and `npm run test:browser` are required. `tests/templates.test.js` covers registry metadata, search, filtering, sorting, cloning, XML reference preservation, package round-trip, and unsafe package rejection. Chrome template suites cover all 19 source-derived previews and editor mounts, BPMN/DMN XML export/re-import, custom save/edit/duplicate/delete/export/import, ID conflict copy/skip/replace, storage failure retry, blank-mode regression, guides, folder destination, RTL/LTR, themes, mobile layout, and version 1 → 2 storage migration. Production `npm run test:offline` includes gallery creation and custom template persistence/export without network access.

Hardening run on 2026-10-16: `npm test` passed 20/20; `npm run build` passed with 133 local release files precached; `npm run test:browser` passed all 15 suites; production `npm run test:offline` passed both suites. The new layout suite checks 1440, 1250, 1024, 820, 600, and 390 px widths, plus class text collisions and graph label containment. English dark desktop/mobile and a 390×600 short screen were visually inspected. The original implementation baseline was 11 unit tests, a passing build, and 10 passing Chrome suites. Broad native DMN edit autosave, imported vendor XML extensions, and a full accessibility/security audit remain outside this verification; see [Known limitations](KNOWN_LIMITATIONS.md).
