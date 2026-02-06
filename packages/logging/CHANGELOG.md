# Changelog

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
- Updated dependencies
  - @outfitter/contracts@0.1.0

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

## 0.1.0-rc.3

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers

## 0.1.0-rc.2

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added

- `createLogger()` - Create configured logger instances with level filtering, sinks, and redaction
- `createChildLogger()` - Create child loggers with inherited configuration and merged context
- `configureRedaction()` - Configure global redaction patterns and keys
- `flush()` - Flush all pending log writes before process exit
- `createJsonFormatter()` - JSON output formatter for log aggregation
- `createPrettyFormatter()` - Human-readable formatter with optional ANSI colors
- `createConsoleSink()` - Console output with stdout/stderr routing by level
- `createFileSink()` - File output with buffered writes
- Automatic redaction of sensitive data (password, token, secret, apikey)
- Support for custom redaction patterns (regex) and keys
- Recursive redaction for nested objects
- Error object serialization with name, message, and stack trace
- Runtime level changes via `setLevel()`
- Dynamic sink addition via `addSink()`

### Changed

- Align package versions to 0.1.0

### Dependencies

- Updated dependencies
  - @outfitter/contracts@0.1.0
