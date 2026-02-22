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

## Package READMEs

Each package has detailed API documentation. The generated mirror lives under
`docs/packages/*` and can be refreshed with `bun run docs:sync`.

Stability labels indicate API maturity:

- **Stable** -- APIs locked, breaking changes rare
- **Active** -- APIs evolving based on usage
- **Early** -- APIs will change, not production-ready

### Foundation (Stable)

- [@outfitter/contracts](./packages/contracts/) -- Result/Error patterns, handler contract
- [@outfitter/types](./packages/types/) -- Optional branded types, type utilities

Adoption note: `@outfitter/types` is not a default dependency. Add it when you
have concrete branded ID or shared utility adoption points.

### Runtime (Active)

- [@outfitter/cli](./packages/cli/) -- CLI framework with output modes, terminal rendering
- [@outfitter/config](./packages/config/) -- XDG-compliant configuration
- [@outfitter/logging](./packages/logging/) -- Structured logging with redaction
- [@outfitter/file-ops](./packages/file-ops/) -- Path security, atomic writes
- [@outfitter/state](./packages/state/) -- Pagination cursors, state management
- [@outfitter/mcp](./packages/mcp/) -- MCP server framework with typed tools
- [@outfitter/index](./packages/index/) -- SQLite FTS5 full-text search
- [@outfitter/daemon](./packages/daemon/) -- Daemon lifecycle, IPC, health checks
- [@outfitter/schema](./packages/schema/) -- Schema introspection, surface maps, and drift detection
- [@outfitter/tui](./packages/tui/) -- Terminal UI primitives, themes, prompts, and streaming
- [@outfitter/testing](./packages/testing/) -- Test harnesses for CLI and MCP

### Tooling (Early)

- [outfitter](../apps/outfitter/README.md) -- Umbrella CLI for scaffolding
- [@outfitter/presets](../packages/presets/) -- Scaffold presets and shared dependency versions
- [@outfitter/docs](./packages/docs/) -- Docs CLI, core assembly, freshness checks, and host adapter
- [@outfitter/tooling](./packages/tooling/) -- Dev tooling presets and CLI (Biome, Lefthook, markdownlint)

### Deprecated

- [@outfitter/agents](./packages/agents/) -- Deprecated. Use `npx outfitter add scaffolding` instead.

## Quick Links

- [GitHub Repository](https://github.com/outfitter-dev/outfitter)
- [npm Organization](https://www.npmjs.com/org/outfitter)
