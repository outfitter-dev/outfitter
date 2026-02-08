# Changelog

## 0.2.0

### Minor Changes

- Version alignment for v0.2.0 release

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.2.0
  - @outfitter/types@0.2.0

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

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [4f58c46]
- Updated dependencies [7522622]
- Updated dependencies
- Updated dependencies [4f58c46]
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0

## 0.1.0-rc.4

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.3
  - @outfitter/types@0.1.0-rc.4

## 0.1.0-rc.3

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/types@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/types@0.1.0-rc.2

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added

- `createCursor()` - Create immutable pagination cursors with optional metadata and TTL
- `advanceCursor()` - Advance cursor to new position while preserving immutability
- `isExpired()` - Check if a cursor has exceeded its time-to-live
- `createCursorStore()` - Create in-memory cursor store with expiration-aware retrieval
- `createPersistentStore()` - Create disk-backed cursor store with atomic writes
- `createScopedStore()` - Create namespace-isolated cursor store for multi-context pagination
- TTL support with automatic expiry detection on `get()` and `has()` operations
- Atomic persistence using temp file + rename pattern to prevent corruption
- Graceful handling of corrupted persistence files (starts empty rather than crash)
- Nested scope support for hierarchical namespace organization
- `prune()` method to bulk-remove expired cursors from stores

### Changed

- Align package versions to 0.1.0

### Dependencies

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0
