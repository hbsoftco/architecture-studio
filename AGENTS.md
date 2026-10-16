# Repository conventions

- Keep application code framework-free JavaScript ES modules.
- Treat diagram source and imported ZIP/XML as untrusted.
- Preserve the authoritative document representation: Mermaid source, BPMN/DMN XML, or versioned graph JSON.
- Update `IMPLEMENTATION_PROGRESS.md` and `docs/KNOWN_LIMITATIONS.md` when capabilities change.
- Run `npm test` and `npm run build` after changes. Run browser smoke checks when UI behavior changes.
- Never mark an unverified roadmap phase complete.
