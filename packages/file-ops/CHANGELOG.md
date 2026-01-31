# Changelog

## 0.1.0-rc.3

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/types@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Add withSharedLock for reader-writer locking with meta-lock protection against race conditions
- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/types@0.1.0-rc.2

All notable changes to `@outfitter/file-ops` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added

#### Workspace Detection

- `findWorkspaceRoot()` - Find project root by marker files (`.git`, `package.json`, or custom markers)
- `getRelativePath()` - Get workspace-relative path from absolute path
- `isInsideWorkspace()` - Check if path is within workspace boundaries

#### Path Security

- `securePath()` - Validate paths against traversal attacks, null bytes, and escape attempts
- `isPathSafe()` - Quick boolean safety check for paths
- `resolveSafePath()` - Safely join path segments with full validation

#### Glob Patterns

- `glob()` - Async file matching with Bun.Glob, supporting ignore patterns and negation
- `globSync()` - Synchronous version of glob for simpler use cases

#### File Locking

- `acquireLock()` - Acquire advisory file lock with PID and timestamp tracking
- `releaseLock()` - Release an acquired file lock
- `withLock()` - Execute callback with automatic lock acquisition and release
- `isLocked()` - Check if file is currently locked

#### Atomic Writes

- `atomicWrite()` - Write files atomically using temp-file-then-rename strategy
- `atomicWriteJson()` - Atomic JSON file writes with serialization

#### Types

- `FindWorkspaceRootOptions` - Options for workspace detection
- `GlobOptions` - Options for glob operations
- `AtomicWriteOptions` - Options for atomic writes
- `FileLock` - Lock metadata interface

### Changed

- Align package versions to 0.1.0

### Dependencies

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0
