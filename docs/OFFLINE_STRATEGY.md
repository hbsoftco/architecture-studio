# Offline strategy

The production build emits only local files. `scripts/precache.js` lists every release asset in the service worker install cache, including lazy editor chunks and fonts. The app uses no remote fonts, APIs, or telemetry. It stores projects in IndexedDB and settings/session choices in localStorage.

Run the release from a local HTTP server. Visit once while provisioned, wait for service worker installation, then disconnect. The service worker is registered only in production builds. An automated Chrome check passed for disconnected reload, Mermaid import/export and images, sample ZIP import, BPMN/DMN XML export, and graph edit/restore. Offline BPMN/DMN visual edits and broader fixtures remain pending.
