# Outfitter

Bun-first shared infrastructure for Outfitter projects.

**Status: In Development**

## What's Included

This monorepo contains the following planned packages:

### Foundation Tier
- `@outfitter/contracts` - Transport-agnostic handler types, error taxonomy, shared interfaces
- `@outfitter/types` - Branded types, type utilities, common helpers

### Runtime Tier
- `@outfitter/cli` - CLI framework with typed commands, output modes, pagination
- `@outfitter/config` - XDG-compliant config loading with schema validation
- `@outfitter/logging` - Structured logging with redaction
- `@outfitter/file-ops` - Workspace detection, path security, file locking
- `@outfitter/state` - Pagination state, cursor persistence
- `@outfitter/ui` - Terminal output shapes, colors, renderers
- `@outfitter/index` - SQLite FTS5 indexing with WAL and locking
- `@outfitter/mcp` - MCP server framework with typed tools

### Infrastructure Tier
- `@outfitter/daemon` - Daemon lifecycle, IPC, health checks
- `@outfitter/testing` - Test harnesses for MCP and CLI

### Tooling Tier
- `outfitter` - Umbrella CLI for scaffolding projects

## Documentation

- [Specification](docs/SPEC.md) - Detailed technical specification
- [Implementation Plan](docs/PLAN.md) - Phased implementation roadmap

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Build all packages
bun run build

# Lint and format
bun run lint
bun run format
```

## License

MIT
