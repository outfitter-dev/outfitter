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

- 2a45c44: Replace custom `wrapText()` implementation with native `Bun.wrapAnsi()` for 33-88x faster ANSI-aware text wrapping
- 4f58c46: Add text utilities (pluralize, slugify), format utilities (formatDuration, formatBytes), parseDateRange, and registerRenderer for custom shape renderers
- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [4f58c46]
- Updated dependencies [7522622]
- Updated dependencies
- Updated dependencies [4f58c46]
  - @outfitter/contracts@0.1.0
  - @outfitter/config@0.1.0
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
  - @outfitter/config@0.1.0-rc.4

## 0.1.0-rc.3

### Patch Changes

- 2a45c44: Replace custom `wrapText()` implementation with native `Bun.wrapAnsi()` for 33-88x faster ANSI-aware text wrapping
- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/config@0.1.0-rc.3
  - @outfitter/types@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Add text utilities (pluralize, slugify), format utilities (formatDuration, formatBytes), parseDateRange, and registerRenderer for custom shape renderers
- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/types@0.1.0-rc.2
  - @outfitter/config@0.1.0-rc.2

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

## [0.0.1] - 2025-01-22

### Added

- **Output utilities**

  - `output()` - Auto-detecting output with support for human, JSON, and JSONL modes
  - `exitWithError()` - Error formatting with category-based exit codes
  - TTY detection for automatic mode selection
  - `OUTFITTER_OUTPUT_FORMAT` environment variable support

- **Input utilities**

  - `collectIds()` - Multi-format ID collection (space/comma-separated, `@file`, stdin)
  - `expandFileArg()` - `@file` reference expansion with size limits
  - `parseGlob()` - Glob pattern expansion using `Bun.Glob`
  - `parseKeyValue()` - `key=value` pair parsing
  - `parseRange()` - Numeric and date range parsing
  - `parseFilter()` - Filter expression parsing with operators
  - `parseSortSpec()` - Sort specification parsing
  - `normalizeId()` - ID normalization with validation
  - `confirmDestructive()` - Destructive operation confirmation with `--yes` bypass

- **Pagination utilities**

  - `loadCursor()` - Load persisted pagination state
  - `saveCursor()` - Save pagination state to XDG state directory
  - `clearCursor()` - Clear pagination state for `--reset` support

- **Error handling**

  - Exit code mapping from error categories (validation, not_found, permission, etc.)
  - Structured JSON error output for non-TTY environments
  - Human-readable error formatting for TTY environments

- **Type exports**
  - `CLIConfig`, `CommandConfig`, `CommandAction`, `CommandFlags`
  - `OutputMode`, `OutputOptions`
  - `CollectIdsOptions`, `ExpandFileOptions`, `ParseGlobOptions`
  - `PaginationState`, `CursorOptions`
  - `ValidationError`, `CancelledError`

[0.0.1]: https://github.com/outfitter-dev/outfitter/releases/tag/@outfitter/cli@0.0.1
