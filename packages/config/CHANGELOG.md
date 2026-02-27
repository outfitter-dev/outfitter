# Changelog

## 0.3.4

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

- Updated dependencies [debf2e2]
  - @outfitter/contracts@0.4.2
  - @outfitter/types@0.2.4

## 0.3.3

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).
- Updated dependencies [9fc51cc]
  - @outfitter/contracts@0.4.1
  - @outfitter/types@0.2.3

## 0.3.2

### Patch Changes

- Updated dependencies [13b36de]
  - @outfitter/contracts@0.4.0
  - @outfitter/types@0.2.2

## 0.3.1

### Patch Changes

- d683522: Replace `json5` dependency with Bun-native `Bun.JSON5` parser (#346).
- Updated dependencies [d683522]
  - @outfitter/contracts@0.3.0
  - @outfitter/types@0.2.1

## 0.3.0

### Minor Changes

- 0c099bc: Add unified environment profiles (`OUTFITTER_ENV`) for cross-package defaults.

  **@outfitter/config:** New `getEnvironment()` and `getEnvironmentDefaults()` for reading environment profiles (development/production/test).

  **@outfitter/mcp:** Add `defaultLogLevel` option to `McpServerOptions` with precedence-based resolution: `OUTFITTER_LOG_LEVEL` > options > environment profile > null. Also adds `sendLogMessage()` for server-to-client log forwarding.

  **@outfitter/logging:** New `resolveLogLevel()` utility with precedence: `OUTFITTER_LOG_LEVEL` > explicit level > environment profile > "info".

  **@outfitter/cli:** New `resolveVerbose()` utility with precedence: `OUTFITTER_VERBOSE` > explicit flag > environment profile > false.

## 0.2.0

### Minor Changes

- Add JSONC config file support
  - Add JSONC (JSON with Comments) parsing for config files
  - Add `.jsonc` to config file discovery preference order

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

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added

- `loadConfig()` - Load configuration from XDG-compliant paths with Zod validation
- `resolveConfig()` - Merge configuration from multiple sources with precedence (flags > env > file > defaults)
- `parseConfigFile()` - Parse TOML, YAML, JSON, and JSON5 configuration files
- `getConfigDir()` - Get XDG config directory (`$XDG_CONFIG_HOME` or `~/.config`)
- `getDataDir()` - Get XDG data directory (`$XDG_DATA_HOME` or `~/.local/share`)
- `getCacheDir()` - Get XDG cache directory (`$XDG_CACHE_HOME` or `~/.cache`)
- `getStateDir()` - Get XDG state directory (`$XDG_STATE_HOME` or `~/.local/state`)
- `deepMerge()` - Deep merge utility for configuration objects
- `ParseError` - Tagged error class for configuration parsing failures
- `ConfigSources<T>` - Type for multi-layer configuration sources
- `LoadConfigOptions` - Options interface for `loadConfig()`

### Changed

- Align package versions to 0.1.0

### Dependencies

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0
