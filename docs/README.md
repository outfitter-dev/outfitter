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

## Packages

Each package has detailed API documentation in its own directory. The canonical
location is `packages/<name>/README.md` (and `packages/<name>/docs/` for deep
docs). Use `outfitter docs list` to browse the docs index, or
`outfitter docs show <id>` to view a specific document.

<!-- BEGIN:GENERATED:PACKAGE_LIST -->
| Package | Description |
|---------|-------------|
| [`@outfitter/agents`](../packages/agents/) | DEPRECATED: Use `outfitter add` instead. Agent documentation and scaffolding for AI-ready projects |
| [`@outfitter/cli`](../packages/cli/) | Typed CLI runtime with terminal detection, rendering, output contracts, and input parsing |
| [`@outfitter/config`](../packages/config/) | XDG-compliant config loading with schema validation for Outfitter |
| [`@outfitter/contracts`](../packages/contracts/) | Result/Error patterns, error taxonomy, and handler contracts for Outfitter |
| [`@outfitter/daemon`](../packages/daemon/) | Daemon lifecycle, IPC, and health checks for Outfitter |
| [`@outfitter/docs`](../packages/docs/) | CLI and host command adapter for Outfitter docs workflows |
| [`@outfitter/file-ops`](../packages/file-ops/) | Workspace detection, secure path handling, and file locking for Outfitter |
| [`@outfitter/index`](../packages/index/) | SQLite FTS5 full-text search indexing for Outfitter |
| [`@outfitter/logging`](../packages/logging/) | Structured logging via logtape with redaction support for Outfitter |
| [`@outfitter/mcp`](../packages/mcp/) | MCP server framework with typed tools for Outfitter |
| [`@outfitter/presets`](../packages/presets/) | Scaffold presets and shared dependency versions for Outfitter projects |
| [`@outfitter/schema`](../packages/schema/) | Schema introspection, surface map generation, and drift detection for Outfitter |
| [`@outfitter/state`](../packages/state/) | Pagination cursor persistence and state management for Outfitter |
| [`@outfitter/testing`](../packages/testing/) | Test harnesses, fixtures, and utilities for Outfitter packages |
| [`@outfitter/tooling`](../packages/tooling/) | Dev tooling configuration presets for Outfitter projects (biome, typescript, lefthook, markdownlint) |
| [`@outfitter/tui`](../packages/tui/) | Terminal UI rendering: tables, lists, boxes, trees, spinners, themes, prompts, and streaming |
| [`@outfitter/types`](../packages/types/) | Branded types, type guards, and type utilities for Outfitter |
<!-- END:GENERATED:PACKAGE_LIST -->

## Quick Links

- [GitHub Repository](https://github.com/outfitter-dev/outfitter)
- [npm Organization](https://www.npmjs.com/org/outfitter)
