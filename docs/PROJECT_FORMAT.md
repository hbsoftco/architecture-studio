# Project ZIP format

`project.json` contains the manifest and document registry. Each registry entry has a relative `path` such as `diagrams/mermaid/<uuid>.mmd`. Source files live under `diagrams/<type>/`. `metadata/links.json` mirrors the links list.

Import checks archive size, entry count, expansion size, paths, JSON Schema, IDs, document types, and references to folders and diagrams. Schema version 1 is the only supported version. Importing a project with an existing project ID assigns a new project ID and preserves document IDs within that imported project.
