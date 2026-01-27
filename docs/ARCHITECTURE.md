# Architecture

Outfitter is a Bun-first monorepo providing shared infrastructure for AI-agent-ready tooling. This document explains how the packages fit together and the design decisions behind them.

## Design Philosophy

### Bun-First

We reach for Bun-native APIs first. Not out of dogma, but because they're already there and they're fast:

- `Bun.hash()`, `Bun.Glob`, `Bun.semver`, `Bun.$` for shell commands
- `Bun.color()`, `Bun.stringWidth()`, `Bun.stripANSI()` for terminal output
- `bun:sqlite` for SQLite with FTS5 full-text search
- `Bun.randomUUIDv7()` for time-sortable request IDs

If Bun has it, we use it. npm is the fallback, not the default.

### Transport-Agnostic Handlers

Domain logic lives in handlers that know nothing about CLI flags, MCP tool schemas, or HTTP routes. A single handler can power all three surfaces:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CLI Adapter│     │ MCP Adapter │     │ API Adapter │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Handler   │
                    │ (pure logic)│
                    └─────────────┘
```

### Result Over Exceptions

All fallible operations return `Result<T, E>` instead of throwing. This makes error handling explicit and composable:

```typescript
const result = await handler(input, ctx);

if (result.isOk()) {
  return result.value;
} else {
  // TypeScript knows result.error is the specific error type
  logger.error("Failed", { error: result.error });
}
```

### Tagged Errors

Errors carry a `_tag` discriminator and `category` for automatic mapping to exit codes and HTTP status:

```typescript
class NotFoundError extends TaggedError {
  readonly _tag = "NotFoundError";
  readonly category = "not_found"; // → exit 2, HTTP 404
}
```

## Package Tiers

Packages are organized into tiers based on stability and dependency direction. Higher tiers depend on lower tiers, never the reverse.

```
┌─────────────────────────────────────────────────────────┐
│                    TOOLING (Early)                      │
│  outfitter CLI, @outfitter/testing                      │
├─────────────────────────────────────────────────────────┤
│                    RUNTIME (Active)                     │
│  cli, config, logging, file-ops, state, ui,            │
│  mcp, index, daemon, agents                             │
├─────────────────────────────────────────────────────────┤
│                   FOUNDATION (Stable)                   │
│  @outfitter/contracts, @outfitter/types                 │
└─────────────────────────────────────────────────────────┘
```

### Foundation Tier (Stable)

APIs locked, breaking changes rare. All other packages depend on these.

| Package | Purpose |
|---------|---------|
| `@outfitter/contracts` | Result/Error patterns, error taxonomy, handler contract, adapters |
| `@outfitter/types` | Branded types, type guards, utility types |

### Runtime Tier (Active)

APIs evolving based on usage. These implement the core functionality.

| Package | Purpose |
|---------|---------|
| `@outfitter/cli` | Typed CLI framework with output modes, input parsing, pagination |
| `@outfitter/config` | XDG-compliant config loading with Zod validation |
| `@outfitter/logging` | Structured logging via logtape with redaction |
| `@outfitter/file-ops` | Workspace detection, path security, file locking, atomic writes |
| `@outfitter/state` | Pagination cursors, ephemeral state management |
| `@outfitter/ui` | Color tokens, terminal renderers, progress bars |
| `@outfitter/mcp` | MCP server framework with typed tools |
| `@outfitter/index` | SQLite FTS5 indexing with WAL mode |
| `@outfitter/daemon` | Daemon lifecycle, IPC, health checks |
| `@outfitter/agents` | Agent scaffolding and templates |

### Tooling Tier (Early)

APIs will change, not production-ready. Developer-facing tools built on the runtime packages.

| Package | Purpose |
|---------|---------|
| `outfitter` | Umbrella CLI for scaffolding projects |
| `@outfitter/testing` | Test harnesses for CLI and MCP |
| `@outfitter/stack` | Version coordination meta-package |

## Dependency Graph

```
                    ┌──────────────┐
                    │   outfitter  │ (CLI)
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌────────┐        ┌─────────┐        ┌────────┐
   │  cli   │        │   mcp   │        │ daemon │
   └───┬────┘        └────┬────┘        └───┬────┘
       │                  │                 │
       └────────┬─────────┴─────────┬───────┘
                │                   │
                ▼                   ▼
         ┌──────────┐        ┌──────────┐
         │  config  │        │ file-ops │
         └────┬─────┘        └────┬─────┘
              │                   │
              └─────────┬─────────┘
                        │
                        ▼
               ┌────────────────┐
               │   contracts    │◄──── types
               └────────────────┘
```

**Key relationships:**

- `contracts` is the foundation — everything depends on it
- `types` provides utilities to `contracts`
- `config` and `file-ops` are shared by CLI, MCP, and daemon surfaces
- `logging` is used throughout but kept optional via interface injection
- `ui` is CLI-specific (terminal output)
- `state` is shared for pagination across surfaces

## Directory Structure

```
outfitter/stack/
├── apps/
│   └── outfitter/           # Umbrella CLI
│       ├── src/
│       └── templates/       # Project scaffolding templates
├── packages/
│   ├── agents/              # Agent scaffolding
│   ├── cli/                 # CLI framework
│   ├── config/              # Configuration loading
│   ├── contracts/           # Core contracts (foundation)
│   ├── daemon/              # Daemon lifecycle
│   ├── file-ops/            # File operations
│   ├── index/               # SQLite FTS5 indexing
│   ├── logging/             # Structured logging
│   ├── mcp/                 # MCP server framework
│   ├── stack/               # Version coordination
│   ├── state/               # State management
│   ├── testing/             # Test harnesses
│   ├── types/               # Type utilities
│   └── ui/                  # Terminal UI
├── docs/                    # Documentation (you are here)
├── AGENTS.md                # AI agent instructions
├── CLAUDE.md                # Claude Code entry point
└── README.md                # Project overview
```

## Design Decisions

### Why Result Types?

A function that throws looks identical to one that doesn't. That's a problem when agents are calling your code.

Exceptions are invisible in type signatures:

```typescript
// Both have the same signature: (id: string) => Promise<User>
async function getUserThrowing(id: string): Promise<User> { ... }
async function getUserSafe(id: string): Promise<User> { ... }
```

With Result types, the possibility of failure is explicit:

```typescript
async function getUser(id: string): Promise<Result<User, NotFoundError>> { ... }
```

This forces callers to handle errors and enables TypeScript to narrow error types.

### Why Tagged Errors?

The `_tag` discriminator enables exhaustive pattern matching:

```typescript
switch (error._tag) {
  case "NotFoundError":
    return res.status(404).json({ error: error.message });
  case "ValidationError":
    return res.status(400).json({ error: error.message, details: error.details });
  // TypeScript ensures all cases are handled
}
```

The `category` field provides automatic mapping to exit codes and HTTP status without switch statements in every adapter.

### Why Handler Contract?

The handler contract (`Handler<TInput, TOutput, TError>`) decouples business logic from transport concerns:

1. **Just call the function** — No mocking HTTP or CLI, handlers are pure functions
2. **Write once** — Same handler powers CLI, MCP, and HTTP
3. **Types all the way down** — Input, output, and error types are explicit
4. **Composable** — Handlers can wrap other handlers

### Why XDG Paths?

The [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) provides predictable, user-configurable paths:

| Variable | Default | Purpose |
|----------|---------|---------|
| `XDG_CONFIG_HOME` | `~/.config` | Configuration files |
| `XDG_DATA_HOME` | `~/.local/share` | Persistent data |
| `XDG_CACHE_HOME` | `~/.cache` | Regenerable cache |
| `XDG_STATE_HOME` | `~/.local/state` | Logs, history, cursors |

This keeps user home directories clean and makes paths predictable for both humans and agents.

### Why Separate Adapters?

Each surface (CLI, MCP, API) has different concerns:

| Surface | Input | Output | Errors |
|---------|-------|--------|--------|
| CLI | Flags, args, stdin | stdout/stderr, exit codes | Human-readable |
| MCP | Tool call JSON | Tool response JSON | Structured |
| API | HTTP request | HTTP response | Status codes |

Adapters translate between surface-specific formats and the unified handler contract. The handler never knows which surface invoked it.

## Error Taxonomy

Ten error categories cover all failure modes:

| Category | Exit | HTTP | When to Use |
|----------|------|------|-------------|
| `validation` | 1 | 400 | Invalid input, schema failures |
| `not_found` | 2 | 404 | Resource doesn't exist |
| `conflict` | 3 | 409 | Resource already exists, version mismatch |
| `permission` | 4 | 403 | Forbidden action |
| `timeout` | 5 | 504 | Operation took too long |
| `rate_limit` | 6 | 429 | Too many requests |
| `network` | 7 | 503 | Connection failures |
| `internal` | 8 | 500 | Unexpected errors, bugs |
| `auth` | 9 | 401 | Authentication required |
| `cancelled` | 130 | 499 | User interrupted (Ctrl+C) |

Exit code 130 follows Unix convention (128 + SIGINT).

## Related Documentation

- [Getting Started](./GETTING-STARTED.md) — Build your first project
- [Patterns](./PATTERNS.md) — Common conventions and idioms
- [Migration](./MIGRATION.md) — Upgrading and adoption guide
