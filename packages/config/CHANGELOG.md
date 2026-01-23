# Changelog

## 0.1.0

### Minor Changes

- chore: align package versions to 0.1.0

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0

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
