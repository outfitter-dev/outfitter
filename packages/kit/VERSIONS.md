# Version Compatibility Matrix

This document tracks version compatibility across @outfitter packages.

## Current Release

| Package | Version | Status |
|---------|---------|--------|
| @outfitter/contracts | 0.1.0-rc.0 | RC |
| @outfitter/types | 0.1.0-rc.0 | RC |
| @outfitter/cli | 0.1.0-rc.0 | RC |
| @outfitter/config | 0.1.0-rc.0 | RC |
| @outfitter/logging | 0.1.0-rc.0 | RC |
| @outfitter/file-ops | 0.1.0-rc.0 | RC |
| @outfitter/state | 0.1.0-rc.0 | RC |
| @outfitter/mcp | 0.1.0-rc.0 | RC |
| @outfitter/index | 0.1.0-rc.0 | RC |
| @outfitter/daemon | 0.1.0-rc.0 | RC |
| @outfitter/testing | 0.1.0-rc.0 | RC |

## Dependency Tiers

### Foundation (cold)
- `@outfitter/contracts` - Result/Error patterns
- `@outfitter/types` - Branded types

### Runtime (warm)
- `@outfitter/cli` - CLI framework (includes terminal rendering)
- `@outfitter/config` - Configuration
- `@outfitter/logging` - Structured logging
- `@outfitter/file-ops` - File operations
- `@outfitter/state` - State management
- `@outfitter/mcp` - MCP server framework
- `@outfitter/index` - SQLite FTS5 indexing
- `@outfitter/daemon` - Daemon lifecycle

### Tooling (lukewarm)
- `@outfitter/testing` - Test harnesses
