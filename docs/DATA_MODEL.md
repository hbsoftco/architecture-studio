# Data model

Project schema version 1 contains `id`, `name`, `locale`, `direction`, `font`, timestamps, `folders`, `documents`, and `links`. [The JSON Schema](../schemas/project.schema.json) is compiled with Ajv at build time into a CSP-compatible validator; additional semantic checks enforce unique IDs and valid folder/document references. Document fields include stable `id`, `type`, `name`, `folderId`, `content`, `mode`, and `updatedAt`. A graph document stores `{ schemaVersion: 1, flowDirection: 'ltr', nodes: [], edges: [] }` as JSON. Node IDs and edge targets are validated. IDs are UUIDs.

Migration support is not implemented yet. Unknown schema versions are rejected.
