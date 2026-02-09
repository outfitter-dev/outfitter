# Changelog

## 0.3.0

### Minor Changes

- 0c099bc: Add unified environment profiles (`OUTFITTER_ENV`) for cross-package defaults.

  **@outfitter/config:** New `getEnvironment()` and `getEnvironmentDefaults()` for reading environment profiles (development/production/test).

  **@outfitter/mcp:** Add `defaultLogLevel` option to `McpServerOptions` with precedence-based resolution: `OUTFITTER_LOG_LEVEL` > options > environment profile > null. Also adds `sendLogMessage()` for server-to-client log forwarding.

  **@outfitter/logging:** New `resolveLogLevel()` utility with precedence: `OUTFITTER_LOG_LEVEL` > explicit level > environment profile > "info".

  **@outfitter/cli:** New `resolveVerbose()` utility with precedence: `OUTFITTER_VERBOSE` > explicit flag > environment profile > false.

- 2da60d3: Add `--json` as a global CLI option, replacing per-command definitions. All commands now inherit `--json` automatically via `createCLI()`.

### Patch Changes

- 4894673: Complete migration system: add `--cwd` flag to `outfitter update`, ship migration docs in `@outfitter/kit` npm package, add migration docs for all packages.
- 8d48564: Fix `output()` to default to human mode for non-TTY environments. Previously, non-TTY output (piped, subprocess) unexpectedly emitted JSON. Machine-readable output now requires explicit `--json` flag or `OUTFITTER_JSON=1` env var, per CLI conventions.
- Updated dependencies [0c099bc]
  - @outfitter/config@0.3.0

## 0.2.0

### Minor Changes

- Add JSON output mode, command normalization, and prompt improvements

  - Normalize command signatures so argument syntax is separated from command name during registration
  - Add portable `createCLI` return type re-exported from `@outfitter/cli/command`
  - Add `--json` output mode for `init`, `add`, and `doctor` commands
  - Route all CLI output through `output()` / `exitWithError()` contract
  - Map `pageSize` prompt option to clack `maxItems`
  - Add `ANSI.inverse` escape code to colors module
  - Add `getSeverityIndicator()` utility

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @outfitter/config@0.2.0
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
