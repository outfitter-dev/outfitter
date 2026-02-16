# @outfitter/schema

## 0.2.0

### Minor Changes

- fab89f5: Add `@outfitter/schema` package with manifest generation, surface map I/O, diff, and cross-version snapshot comparison.
- 1c70a3e: Add markdown reference doc generation from action manifests. `formatManifestMarkdown()` converts manifests to readable markdown with surface-aware rendering — MCP shows JSON Schema parameters and deferred loading annotations, CLI shows flag syntax, defaults, and aliases. CLI gains `schema docs` subcommand for writing `MCP_REFERENCE.md` or `CLI_REFERENCE.md` to disk.

### Patch Changes

- Updated dependencies [13b36de]
  - @outfitter/contracts@0.4.0
  - @outfitter/types@0.2.2
