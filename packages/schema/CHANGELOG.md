# @outfitter/schema

## 0.2.2

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).
- Updated dependencies [9fc51cc]
  - @outfitter/contracts@0.4.1
  - @outfitter/types@0.2.3

## 0.2.1

### Patch Changes

- 5487e00: fix(release): recover schema publish after blocked 0.2.0 version

  `@outfitter/schema@0.2.0` is currently unavailable from npm while the version is no longer publishable.
  This patch bump advances to a fresh publishable version so release automation can recover.

## 0.2.0

### Minor Changes

- fab89f5: Add `@outfitter/schema` package with manifest generation, surface map I/O, diff, and cross-version snapshot comparison.
- 1c70a3e: Add markdown reference doc generation from action manifests. `formatManifestMarkdown()` converts manifests to readable markdown with surface-aware rendering — MCP shows JSON Schema parameters and deferred loading annotations, CLI shows flag syntax, defaults, and aliases. CLI gains `schema docs` subcommand for writing `MCP_REFERENCE.md` or `CLI_REFERENCE.md` to disk.

### Patch Changes

- Updated dependencies [13b36de]
  - @outfitter/contracts@0.4.0
  - @outfitter/types@0.2.2
