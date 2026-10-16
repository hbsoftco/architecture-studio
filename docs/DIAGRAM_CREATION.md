# Diagram creation and application dialogs

The New Diagram action opens a searchable application modal. `src/model.js` `TYPES` remains the source of truth for supported document adapters. `src/catalog.js` adds bilingual descriptions, search terms, guides, and locally generated SVG examples to those registered types. Mermaid catalog entries select existing `MERMAID_EXAMPLES`; graph entries create versioned graph JSON with a small starter structure. BPMN and DMN continue to use their existing native adapters and XML formats.

The catalog supports Persian/English and Arabic/Persian letter normalization, category search, one selected type, live preview, capability labels, and nine guide slides per type. Guide navigation stays inside the modal and related guide links only change the selection. The guide, list, preview, and name remain in one dialog so selection and typed names survive guide navigation. The modal uses local assets and initializes no additional BPMN or DMN editors.

`src/dialogs.js` provides queued `open`, `input`, `choose`, `confirm`, and `info` methods plus `notifications.success` and `notifications.error`. Each request owns one native HTML `<dialog>` element, handles Escape and focus restoration, validates fields, blocks duplicate submissions, and keeps the dialog open on async operation failure. The catalog uses the same dialog shell. Browser file pickers and downloads remain native capabilities.

## Replaced native dialog call sites

All former JavaScript `prompt()`/`confirm()` interactions in `src/main.js` now use application UI:

1. New project name.
2. New folder name.
3. Project action selection.
4. Project rename.
5. Snapshot selection and restore confirmation.
6. Project deletion confirmation.
7. Diagram type and name creation.
8. Diagram action selection, rename, deletion confirmation, and folder selection.
9. Folder rename.
10. Cross-document link target selection.
11. BPMN element search.
12. Mermaid example replacement confirmation.
13. DMN test JSON input.
14. BPMN simulation route selection.
15. Graph node type selection.

The creation operation persists the new document before opening it. A storage failure removes the tentative document from the in-memory project, leaves the modal open, and shows the error. The submit button stays disabled during that operation.

## Template gallery

The New Diagram dialog also has a **Templates** tab. It offers 19 source-backed built-ins across BPMN, DMN, Mermaid, C4, ERD, DFD, infrastructure, and general graph types. Search, source/type/category filters, sorting, source-derived previews, and related guide slides use the same dialog shell. Creation copies the authoritative source to a new document through the existing project save/open path. The selected folder and entered name apply only to that document. Switching tabs preserves each tab's selection and name.

**Save as Template** in the open document toolbar or context menu captures the current editor source, including unsaved edits. Custom templates live in the separate IndexedDB `templates` store. The gallery supports metadata editing, duplication, deletion, and `.astpl` ZIP import/export, including explicit copy/skip/replace choices on ID conflicts. Project ZIP backups do not contain global custom templates. See [Template gallery](TEMPLATE_GALLERY.md) for the record and package formats, migration, and verified inventory.

## Visual checks

Chrome captures: [Persian catalog](qa/catalog-overview-fa.png), [English guide](qa/catalog-guide-en.png), and [mobile guide](qa/catalog-mobile.png).

## Verification

`tests/catalog.test.js` checks registry alignment, localized guides, search normalization, and valid starter documents. `scripts/catalog-smoke.mjs` covers every preview, search, keyboard navigation, guide slides and related links, cancellation, creation, persistence, localization, mobile layout, and local-only resource requests. `scripts/dialogs-smoke.mjs` covers validation, cancellation, rename, destructive-action cancellation, storage failure, duplicate submission, focus, themes, and locales. Existing browser scripts were updated to operate the custom dialogs.
