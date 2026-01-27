# Outfitter Documentation

Guides and reference documentation for the Outfitter monorepo.

## Contents

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | Package tiers, dependency graph, design decisions |
| [Getting Started](./GETTING-STARTED.md) | Build your first CLI, MCP server, or daemon |
| [Patterns](./PATTERNS.md) | Handlers, Result types, error taxonomy, validation |
| [Migration](./MIGRATION.md) | Adopting Outfitter, upgrading between versions |

## Package READMEs

Each package has detailed API documentation. Stability labels indicate API maturity:
- **Stable** — APIs locked, breaking changes rare
- **Active** — APIs evolving based on usage
- **Early** — APIs will change, not production-ready

### Foundation (Stable)

- [@outfitter/contracts](../packages/contracts/README.md) — Result/Error patterns, handler contract
- [@outfitter/types](../packages/types/README.md) — Branded types, type utilities

### Runtime (Active)

- [@outfitter/cli](../packages/cli/README.md) — CLI framework with output modes
- [@outfitter/config](../packages/config/README.md) — XDG-compliant configuration
- [@outfitter/logging](../packages/logging/README.md) — Structured logging with redaction
- [@outfitter/file-ops](../packages/file-ops/README.md) — Path security, atomic writes
- [@outfitter/state](../packages/state/README.md) — Pagination cursors, state management
- [@outfitter/ui](../packages/ui/README.md) — Terminal colors, renderers
- [@outfitter/mcp](../packages/mcp/README.md) — MCP server framework with typed tools
- [@outfitter/index](../packages/index/README.md) — SQLite FTS5 full-text search
- [@outfitter/daemon](../packages/daemon/README.md) — Daemon lifecycle, IPC, health checks
- [@outfitter/agents](../packages/agents/README.md) — Agent scaffolding and bootstrap

### Tooling (Early)

- [outfitter](../apps/outfitter/README.md) — Umbrella CLI for scaffolding
- [@outfitter/testing](../packages/testing/README.md) — Test harnesses for CLI and MCP
- [@outfitter/stack](../packages/stack/README.md) — Version coordination

## Quick Links

- [GitHub Repository](https://github.com/outfitter-dev/outfitter)
- [npm Organization](https://www.npmjs.com/org/outfitter)
