# Architecture Studio

An offline-first, Persian-first architecture modeling workspace built with vanilla JavaScript, Vite, IndexedDB, Mermaid, bpmn-js, dmn-js, and a small SVG graph editor.

## Run

Requires Node.js 22 or later. Install dependencies while connected, then build and run locally:

```bash
npm ci --legacy-peer-deps
npm run build
npm run preview
```

Open the local address printed by Vite. The built release includes a service worker that caches its local assets after the first successful load. Keep a local server running; `file://` is unsupported. For development use `npm run dev`. No account or external API is used at runtime.

## Use

Create a project, choose **New diagram**, then use **Blank Diagram** to choose a type or **Templates** to browse the 19 editable examples. Search and filter templates, inspect their previews and guides, name the new diagram, and choose its folder. Documents autosave to IndexedDB. **Save as Template** on an open diagram stores your current work in **My templates**; the gallery can edit, duplicate, delete, import, and export those templates as `.astpl` packages. The project menu (`⋯`) offers rename, duplicate, snapshot restore, and delete. Right-click a document for rename, duplicate, move, or delete. Import individual `.mmd`, `.bpmn`, `.dmn`, or graph `.json` files, or a project `.zip`. Export the active document with **Export document**, or the whole project with **Export project**.

Project ZIP files are the portable backup format for project documents. Custom templates are stored separately, so export them from **My templates** as `.astpl` packages too. Browser storage is local to the browser profile and origin.

Direct dependency and font licenses are summarized in [dependencies](docs/DEPENDENCIES.md). The built release includes their license texts under `dist/licenses/`.

## Checks

```bash
npm test
npm run build
npm run test:browser
```

Browser tests expect the development server at `http://127.0.0.1:5173/`. For the disconnected release test, run `npm run preview` and then `npm run test:offline`. `npm run benchmark` writes the production baseline to `docs/BENCHMARKS.md`. See [known limitations](docs/KNOWN_LIMITATIONS.md) and [progress](IMPLEMENTATION_PROGRESS.md) for the exact implementation status.
