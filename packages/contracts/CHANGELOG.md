# @outfitter/contracts

## 0.4.2

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.4.1

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).

## 0.4.0

### Minor Changes

- 13b36de: Move `zodToJsonSchema` from `@outfitter/mcp` to `@outfitter/contracts`. MCP re-exports for backward compatibility.

## 0.3.0

### Minor Changes

- d683522: Add `ValidationError.fromMessage()` and improve error factory documentation.
  - **feat**: `ValidationError.fromMessage(message, context?)` for freeform validation errors (#335)
  - **docs**: Error factory quick-reference table and casing behavior documentation (#336)

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
