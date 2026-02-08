# @outfitter/contracts

## 0.2.0

### Minor Changes

- Add error ergonomics and Result boundary helpers

  - Add optional `context` field to `NotFoundError` and `ValidationError` for attaching structured domain metadata
  - Add `static create()` factory methods to all 10 error classes for concise construction
  - Add `AmbiguousError` class (category: `validation`, code: `AMBIGUOUS_MATCH`) for disambiguation scenarios with a `candidates` field
  - Add `expect(result, message)` utility — unwraps Ok or throws with a contextual error message

## 0.1.0

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- 4f58c46: Add ERROR_CODES constant with granular numeric error codes organized by category

## 0.1.0-rc.3

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

## 0.1.0-rc.2

### Patch Changes

- Add ERROR_CODES constant with granular numeric error codes organized by category

## 0.1.0

### Minor Changes

- chore: align package versions to 0.1.0
