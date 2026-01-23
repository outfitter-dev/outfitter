# Changelog

## 0.1.0

### Minor Changes

- chore: align package versions to 0.1.0

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0

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
