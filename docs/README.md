# Outfitter Documentation

Guides and reference documentation for the Outfitter monorepo.

## Contents

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | Package tiers, dependency graph, boundary conventions, design decisions |
| [Releases](./RELEASES.md) | Changesets, canary publishing, stable release workflow |
| [Getting Started](./getting-started.md) | Build your first CLI, MCP server, or daemon |
| [Migration](./migration.md) | Adopting Outfitter, upgrading between versions |

### CLI

| Document | Description |
|----------|-------------|
| [Conventions](./cli/conventions.md) | Flag presets, verb conventions, schema introspection, queryability |

### Reference

| Document | Description |
|----------|-------------|
| [Patterns](./reference/patterns.md) | Handlers, Result types, error taxonomy, validation |
| [Result API](./reference/result-api.md) | Complete API surface for `Result<T, E>` |
| [Result Cookbook](./reference/result-cookbook.md) | Generator-based composition with `Result.gen()` |
| [Export Contracts](./reference/export-contracts.md) | Package export verification pipeline and tooling |
| [TUI Stacks](./reference/tui-stacks.md) | Composable hstack/vstack primitives for CLI layouts |
| [`.outfitter/` Directory](./reference/outfitter-directory.md) | Project directory conventions, contents, git strategy |

## Package READMEs

Each package has detailed API documentation in its own directory. The canonical
location is `packages/<name>/README.md` (and `packages/<name>/docs/` for deep
docs). Use `outfitter docs list` to browse the docs index, or
`outfitter docs show <id>` to view a specific document.

Stability labels indicate API maturity:

- **Stable** -- APIs locked, breaking changes rare
- **Active** -- APIs evolving based on usage
- **Early** -- APIs will change, not production-ready

### Foundation (Stable)

- [@outfitter/contracts](../packages/contracts/README.md) -- Result/Error patterns, handler contract
- [@outfitter/types](../packages/types/README.md) -- Optional branded types, type utilities

Adoption note: `@outfitter/types` is not a default dependency. Add it when you
have concrete branded ID or shared utility adoption points.

### Runtime (Active)

- [@outfitter/cli](../packages/cli/README.md) -- CLI framework with output modes, terminal rendering
- [@outfitter/config](../packages/config/README.md) -- XDG-compliant configuration
- [@outfitter/logging](../packages/logging/README.md) -- Structured logging with redaction
- [@outfitter/file-ops](../packages/file-ops/README.md) -- Path security, atomic writes
- [@outfitter/state](../packages/state/README.md) -- Pagination cursors, state management
- [@outfitter/mcp](../packages/mcp/README.md) -- MCP server framework with typed tools
- [@outfitter/index](../packages/index/README.md) -- SQLite FTS5 full-text search
- [@outfitter/daemon](../packages/daemon/README.md) -- Daemon lifecycle, IPC, health checks
- [@outfitter/schema](../packages/schema/README.md) -- Schema introspection, surface maps, and drift detection
- [@outfitter/tui](../packages/tui/README.md) -- Terminal UI primitives, themes, prompts, and streaming
- [@outfitter/testing](../packages/testing/README.md) -- Test harnesses for CLI and MCP

### Tooling (Early)

- [outfitter](../apps/outfitter/README.md) -- Umbrella CLI for scaffolding
- [@outfitter/presets](../packages/presets/) -- Scaffold presets and shared dependency versions
- [@outfitter/docs](../packages/docs/README.md) -- Docs CLI, core assembly, freshness checks, and host adapter
- [@outfitter/tooling](../packages/tooling/README.md) -- Dev tooling presets and CLI (Biome, Lefthook, markdownlint)

### Deprecated

- [@outfitter/agents](../packages/agents/README.md) -- Deprecated. Use `npx outfitter add scaffolding` instead.

## Quick Links

- [GitHub Repository](https://github.com/outfitter-dev/outfitter)
- [npm Organization](https://www.npmjs.com/org/outfitter)
