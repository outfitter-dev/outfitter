# Version Compatibility Matrix

This document tracks version compatibility across @outfitter packages.

## Current Release

| Package | Version | Status |
|---------|---------|--------|
| @outfitter/contracts | 0.1.0 | Stable |
| @outfitter/types | 0.1.0 | Stable |
| @outfitter/cli | 0.1.0 | Stable |
| @outfitter/config | 0.1.0 | Stable |
| @outfitter/logging | 0.1.0 | Stable |
| @outfitter/file-ops | 0.1.0 | Stable |
| @outfitter/state | 0.1.0 | Stable |
| @outfitter/ui | 0.1.0 | Stable |
| @outfitter/mcp | 0.1.0 | Stable |
| @outfitter/index | 0.1.0 | Stable |
| @outfitter/daemon | 0.1.0 | Stable |
| @outfitter/testing | 0.1.0 | Stable |

## Dependency Tiers

### Foundation (cold)
- `@outfitter/contracts` - Result/Error patterns
- `@outfitter/types` - Branded types

### Runtime (warm)
- `@outfitter/cli` - CLI framework
- `@outfitter/config` - Configuration
- `@outfitter/logging` - Structured logging
- `@outfitter/file-ops` - File operations
- `@outfitter/state` - State management
- `@outfitter/ui` - Terminal UI
- `@outfitter/mcp` - MCP server framework
- `@outfitter/index` - SQLite FTS5 indexing
- `@outfitter/daemon` - Daemon lifecycle

### Tooling (lukewarm)
- `@outfitter/testing` - Test harnesses
