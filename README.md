# Outfitter

Shared infrastructure for building AI-agent-ready tools. CLIs, MCP servers, daemons—with patterns that work for both humans and machines.

**Status: v0.1.0-rc.1 (Release Candidate)**

## Quick Start

```bash
bunx outfitter init cli my-project
cd my-project
bun install
bun run dev
```

**Output:**
```
my-project v0.1.0

Usage: my-project [command] [options]

Commands:
  example    Run example command
  help       Display help for command
```

That scaffolds a working CLI with typed commands, output mode detection, and proper error handling. Four commands to useful software.

## Why Outfitter

We kept solving the same problems across projects: config loading, error handling, CLI output modes, MCP server boilerplate. Every tool needed the same foundation.

So we extracted it.

Outfitter is opinionated infrastructure for the Bun ecosystem. The patterns assume you're building tools that agents will consume—structured output, typed errors, predictable behavior. Humans benefit too; agents just make the stakes clearer.

**The core idea:** handlers are pure functions returning `Result` types. CLI and MCP are thin adapters over the same logic. Write the handler once, expose it everywhere.

## Packages

Three tiers, one goal: shared infrastructure that works for humans and machines.
- **Stable** — APIs locked, breaking changes rare
- **Active** — APIs evolving based on usage
- **Early** — APIs will change, not production-ready

### Foundation (Stable)

APIs everything else depends on.

| Package | What it does |
|---------|--------------|
| `@outfitter/contracts` | Result/Error patterns and the handler contract |
| `@outfitter/types` | Type utilities and branded types |

### Runtime (Active)

The building blocks for applications.

| Package | What it does |
|---------|--------------|
| `@outfitter/cli` | CLI framework with human/JSON output modes |
| `@outfitter/mcp` | MCP server framework with typed tools |
| `@outfitter/config` | Config loading that respects XDG paths |
| `@outfitter/logging` | Structured logging with automatic redaction |
| `@outfitter/file-ops` | Path security, atomic writes, file locking |
| `@outfitter/index` | SQLite full-text search (FTS5) with WAL mode |
| `@outfitter/daemon` | Daemon lifecycle, health checks, IPC |
| `@outfitter/agents` | Agent scaffolding and templates |
| `@outfitter/state` | Pagination cursors and ephemeral state |
| `@outfitter/ui` | Terminal colors and renderers |

### Tooling (Early)

Developer-facing tools built on the runtime.

| Package | What it does |
|---------|--------------|
| `outfitter` | Umbrella CLI for scaffolding projects |
| `@outfitter/testing` | Test harnesses for CLI and MCP |

## Documentation

| Guide | When to read it |
|-------|-----------------|
| [Getting Started](docs/GETTING-STARTED.md) | Build your first CLI, MCP server, or daemon |
| [Patterns](docs/PATTERNS.md) | Understand handlers, Result types, error taxonomy |
| [Architecture](docs/ARCHITECTURE.md) | How packages fit together |
| [Migration](docs/MIGRATION.md) | Adopting Outfitter or upgrading versions |

## Development

```bash
bun install          # Install dependencies
bun run test         # Run tests
bun run build        # Build all packages
bun run lint         # Check formatting and lint
bun run typecheck    # TypeScript validation
```

## Requirements

Bun >= 1.3.6

## License

MIT

---

Questions? Ideas? We're building this in the open — come find us at [github.com/outfitter-dev/outfitter](https://github.com/outfitter-dev/outfitter). Or just start building and see where it takes you.
