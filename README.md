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

Create a project, choose **New diagram**, then enter a type ID: `mermaid`, `bpmn`, `dmn`, `c4`, `erd`, `infrastructure`, `dfd`, or `general`. Documents autosave to IndexedDB. The project menu (`⋯`) offers rename, duplicate, snapshot restore, and delete. Right-click a document for rename, duplicate, move, or delete. Import individual `.mmd`, `.bpmn`, `.dmn`, or graph `.json` files, or a project `.zip`. Export the active document with **Export document**, or the whole project with **Export project**.

Project ZIP files are the portable backup format. Browser storage is local to the browser profile and origin; export ZIP backups regularly.

Direct dependency and font licenses are summarized in [dependencies](docs/DEPENDENCIES.md). The built release includes their license texts under `dist/licenses/`.

## Checks

```bash
npm test
npm run build
npm run test:browser
```

Browser tests expect the development server at `http://127.0.0.1:5173/`. For the disconnected release test, run `npm run preview` and then `npm run test:offline`. `npm run benchmark` writes the production baseline to `docs/BENCHMARKS.md`. See [known limitations](docs/KNOWN_LIMITATIONS.md) and [progress](IMPLEMENTATION_PROGRESS.md) for the exact implementation status.
