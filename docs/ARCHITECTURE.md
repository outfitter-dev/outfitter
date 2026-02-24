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
│  outfitter CLI, presets, docs, tooling                   │
├─────────────────────────────────────────────────────────┤
│                    RUNTIME (Active)                     │
│  cli, config, logging, file-ops, state, schema, tui,   │
│  mcp, index, daemon, testing                            │
├─────────────────────────────────────────────────────────┤
│                   FOUNDATION (Stable)                   │
│  @outfitter/contracts, @outfitter/types                 │
└─────────────────────────────────────────────────────────┘
```

### Foundation Tier (Stable)

APIs locked, breaking changes rare. All other packages depend on these.

| Package                | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `@outfitter/contracts` | Result/Error patterns, error taxonomy, handler contract, adapters |
| `@outfitter/types`     | Branded types, type guards, utility types                         |

### Runtime Tier (Active)

APIs evolving based on usage. These implement the core functionality.

| Package               | Purpose                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@outfitter/cli`      | Typed CLI framework with output modes, input parsing, pagination, terminal rendering (`/render`, `/terminal` subpaths)                                |
| `@outfitter/config`   | XDG-compliant config loading with Zod validation                                                                                                      |
| `@outfitter/logging`  | Structured logging via logtape with redaction                                                                                                         |
| `@outfitter/file-ops` | Workspace detection, path security, file locking, atomic writes                                                                                       |
| `@outfitter/state`    | Pagination cursors, ephemeral state management                                                                                                        |
| `@outfitter/mcp`      | MCP server framework with typed tools                                                                                                                 |
| `@outfitter/index`    | SQLite FTS5 indexing with WAL mode                                                                                                                    |
| `@outfitter/daemon`   | Daemon lifecycle, IPC, health checks                                                                                                                  |
| `@outfitter/schema`   | Schema introspection, surface map generation, drift detection, and markdown reference output (`/diff`, `/manifest`, `/markdown`, `/surface` subpaths) |
| `@outfitter/tui`      | Terminal UI rendering: tables, lists, boxes, trees, spinners, themes, prompts, and streaming                                                          |
| `@outfitter/testing`  | Test harnesses for CLI and MCP                                                                                                                        |

### Tooling Tier (Early)

APIs will change, not production-ready. Developer-facing tools built on the runtime packages.

| Package              | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `outfitter`          | Umbrella CLI for scaffolding projects                              |
| `@outfitter/presets` | Scaffold presets and shared dependency versions (catalog-resolved) |
| `@outfitter/docs`    | Docs CLI, core assembly, freshness checks, and host adapter        |
| `@outfitter/tooling` | Dev tooling presets and CLI workflows                              |

### Deprecated Packages

- `@outfitter/agents` is deprecated. Use `npx outfitter add scaffolding` instead.

## Dependency Graph

```
                    ┌──────────────┐
                    │   outfitter  │ (CLI)
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌────────┐        ┌─────────┐        ┌─────────┐
   │  cli   │        │ presets │        │ tooling │
   └───┬────┘        └────┬────┘        └────┬────┘
       │                  │                  │
       │            (catalog-resolved        │
       │             dep versions)           │
       │                  │                  │
       ▼                  ▼                  ▼
   ┌────────┐        ┌─────────┐        ┌────────┐
   │  mcp   │        │  config │        │ daemon │
   └───┬────┘        └────┬────┘        └───┬────┘
       │                  │                 │
       └────────┬─────────┴─────────┬───────┘
                │                   │
                ▼                   ▼
         ┌──────────┐        ┌──────────┐
         │ file-ops │        │  logging │
         └────┬─────┘        └──────────┘
              │
              ▼
     ┌────────────────┐
     │   contracts    │◄──── types
     └────────────────┘
```

**Key relationships:**

- `contracts` is the foundation — everything depends on it
- `types` provides utilities to `contracts`
- `presets` holds scaffold presets and shared dependency versions (catalog-resolved at publish time)
- `config` and `file-ops` are shared by CLI, MCP, and daemon surfaces
- `logging` is used throughout but kept optional via interface injection
- `cli` includes terminal rendering via `/render` and `/terminal` subpaths
- `schema` powers schema introspection, manifest generation, and drift detection
- `tui` provides shared terminal UI primitives for rendering and prompts
- `state` is shared for pagination across surfaces

## Directory Structure

```
outfitter/stack/
├── apps/
│   └── outfitter/           # Umbrella CLI
│       ├── src/
│       └── templates/       # Project scaffolding templates
├── packages/
│   ├── agents/              # DEPRECATED: use `npx outfitter add scaffolding`
│   ├── cli/                 # CLI framework
│   ├── config/              # Configuration loading
│   ├── contracts/           # Core contracts (foundation)
│   ├── daemon/              # Daemon lifecycle
│   ├── file-ops/            # File operations
│   ├── index/               # SQLite FTS5 indexing
│   ├── logging/             # Structured logging
│   ├── mcp/                 # MCP server framework
│   ├── presets/             # Scaffold presets and shared dep versions
│   ├── schema/              # Schema introspection and surface maps
│   ├── state/               # State management
│   ├── testing/             # Test harnesses
│   ├── tui/                 # Terminal UI rendering
│   └── types/               # Type utilities
├── docs/                    # Documentation (you are here)
├── AGENTS.md                # AI agent instructions
├── .claude/CLAUDE.md        # Claude Code entry point
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
    return res
      .status(400)
      .json({ error: error.message, context: error.context });
  // TypeScript ensures all cases are handled
}
```

The `category` field provides automatic mapping to exit codes and HTTP status without switch statements in every adapter.

### Why Handler Contract?

The handler contract (`Handler<TInput, TOutput, TError extends OutfitterError = OutfitterError>`) decouples business logic from transport concerns:

1. **Just call the function** — No mocking HTTP or CLI, handlers are pure functions
2. **Write once** — Same handler powers CLI, MCP, and HTTP
3. **Types all the way down** — Input, output, and error types are explicit
4. **Composable** — Handlers can wrap other handlers

### Why XDG Paths?

The [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) provides predictable, user-configurable paths:

| Variable          | Default          | Purpose                |
| ----------------- | ---------------- | ---------------------- |
| `XDG_CONFIG_HOME` | `~/.config`      | Configuration files    |
| `XDG_DATA_HOME`   | `~/.local/share` | Persistent data        |
| `XDG_CACHE_HOME`  | `~/.cache`       | Regenerable cache      |
| `XDG_STATE_HOME`  | `~/.local/state` | Logs, history, cursors |

This keeps user home directories clean and makes paths predictable for both humans and agents.

### Why Separate Adapters?

Each surface (CLI, MCP, API) has different concerns:

| Surface | Input              | Output                    | Errors         |
| ------- | ------------------ | ------------------------- | -------------- |
| CLI     | Flags, args, stdin | stdout/stderr, exit codes | Human-readable |
| MCP     | Tool call JSON     | Tool response JSON        | Structured     |
| API     | HTTP request       | HTTP response             | Status codes   |

Adapters translate between surface-specific formats and the unified handler contract. The handler never knows which surface invoked it.

### Why Barrel Imports in Workspace Code?

Packages like `@outfitter/config` expose subpath exports (`./environment`, `./env`) so published consumers can import narrow slices without pulling in transitive dependencies like `node:fs`:

```typescript
// Published consumer — uses subpath export, no node:fs in bundle
import { getEnvironment } from "@outfitter/config/environment";
```

In workspace source code, we use barrel imports instead:

```typescript
// Workspace source — barrel import
import { getEnvironment } from "@outfitter/config";
```

**Why?** Bun's runtime module resolver doesn't support subpath exports for workspace-linked packages (symlinks). TypeScript resolves them fine (`moduleResolution: "bundler"`), but `bun test` and direct execution fail. This is a Bun limitation, not a design choice.

**Why it's fine:** All packages set `"sideEffects": false` and bunup produces code-split entry points. When an end user bundles an app using `@outfitter/logging`, their bundler tree-shakes the barrel down to only the functions actually used — the `node:fs` code never ships.

**When to revisit:** Once Bun supports workspace subpath resolution, narrow the imports to subpath exports for faster dev-time module loading.

## Error Taxonomy

Ten error categories cover all failure modes:

| Category     | Exit | HTTP | When to Use                               |
| ------------ | ---- | ---- | ----------------------------------------- |
| `validation` | 1    | 400  | Invalid input, schema failures            |
| `not_found`  | 2    | 404  | Resource doesn't exist                    |
| `conflict`   | 3    | 409  | Resource already exists, version mismatch |
| `permission` | 4    | 403  | Forbidden action                          |
| `timeout`    | 5    | 504  | Operation took too long                   |
| `rate_limit` | 6    | 429  | Too many requests                         |
| `network`    | 7    | 502  | Connection failures                       |
| `internal`   | 8    | 500  | Unexpected errors, bugs                   |
| `auth`       | 9    | 401  | Authentication required                   |
| `cancelled`  | 130  | 499  | User interrupted (Ctrl+C)                 |

Exit code 130 follows Unix convention (128 + SIGINT).

## Boundary Conventions

Clear boundaries between `apps/` and `packages/` keep the codebase modular and prevent tangled dependencies.

### `packages/*` are library/runtime surfaces

- Export importable APIs.
- Avoid process entrypoint concerns (`process.argv`, `process.exit`, shebang scripts) unless shipping an explicit package bin.
- Do not require root scripts to execute `packages/*/src/*` directly.

### `apps/*` are runnable command hosts

- Own user-facing command orchestration.
- Wire package APIs into coherent command surfaces.
- Host canonical command entrypoints.

### Root scripts call canonical surfaces

From the monorepo root, call app entrypoints (for monorepo workflows) or package bins (for standalone package workflows). Do not call package source files directly.

### Command Model

User-facing verbs we standardize around:

| Verb    | Purpose                                         | Status      |
| ------- | ----------------------------------------------- | ----------- |
| `init`  | Create or bootstrap a project                   | Implemented |
| `setup` | Opinionated setup wrapper for common defaults   | Planned     |
| `add`   | Add capabilities or tooling blocks              | Implemented |
| `check` | Validate project health and policy conformance  | Implemented |
| `fix`   | Apply safe automated fixes for checkable issues | Planned     |

Repository maintenance operations are namespaced under `outfitter repo check|sync|export <subject>`. Current subjects: `docs`, `exports`, `readme`, `registry`, `changeset`, `tree`, `boundary-invocations`.

### CI and Hook Enforcement

`verify:ci` enforces boundary and command policy through `check-exports`, `check-readme-imports`, `check-clean-tree`, and `check-boundary-invocations`. Pre-push runs the same sequence through `bunx @outfitter/tooling pre-push`.

## Related Documentation

- [Getting Started](./getting-started.md) — Build your first project
- [Patterns](./reference/patterns.md) — Common conventions and idioms
- [Migration](./migration.md) — Upgrading and adoption guide
