---
name: outfitter-fieldguide
version: 0.2.0
description: "Your trail map for @outfitter/* packages. Patterns, templates, and the thinking behind transport-agnostic handler systems. Use when working with @outfitter/*, Result types, Handler contract, error taxonomy, or when Result, Handler, ValidationError, NotFoundError, OutfitterError, or package names like contracts, cli, mcp, daemon, config, logging are mentioned."
---

# Outfitter Field Guide

Your trail map for building with @outfitter/* packages. This guide covers the patterns, the templates, and—just as importantly—the *why* behind it all.

## Why We Built This

We kept solving the same problems across projects: config loading, error handling, CLI output modes, MCP server boilerplate. Every tool needed the same foundation. So we extracted it.

### Agents Are the New Users

The patterns assume you're building tools that **agents will consume**—structured output, typed errors, predictable behavior. Humans benefit too; agents just make the stakes clearer.

When an AI agent calls your CLI or MCP tool, it needs:
- **Structured output** it can parse (JSON when explicitly requested)
- **Typed errors** with categories it can reason about (retry? abort? ask user?)
- **Predictable exit codes** for scripting and automation
- **Consistent behavior** across transport surfaces

The stack enforces these properties by design, not discipline.

### Errors Are Data, Not Exceptions

Traditional error handling (`throw`/`catch`) loses context, breaks type safety, and makes control flow unpredictable. We treat errors as first-class data:

```typescript
const error = NotFoundError.create("user", "user-123");
error._tag;        // "NotFoundError" — for pattern matching
error.category;    // "not_found" — maps to exit code 2, HTTP 404
error.message;     // Human-readable
error.toJSON();    // Serializes cleanly for agents
```

Ten categories cover all failure modes. Each maps to exit codes (CLI) and HTTP status (API/MCP). Agents can make retry decisions without parsing error strings.

### Tests First, Always

Tests define behavior; implementations follow. The workflow:

1. **Red**: Write a failing test that defines expected behavior
2. **Green**: Minimal code to pass
3. **Refactor**: Improve while staying green

The test proves the behavior exists. A failing test proves it doesn't—*yet*.

### One Definition, Many Derivations

Types, schemas, and contracts have exactly one source:

| Concern | Source of Truth | Derives |
|---------|-----------------|---------|
| Input validation | Zod schema | TypeScript types, JSON Schema |
| Error categories | `ErrorCategory` type | Exit codes, HTTP status |
| CLI flag names | Handler input types | MCP tool parameters |

If two things must stay in sync, one derives from the other.

### Bun-Native When Possible

Bun APIs before npm packages—faster, zero-dependency:

| Need | Use |
|------|-----|
| Hashing | `Bun.hash()` |
| Globbing | `Bun.Glob` |
| Semver | `Bun.semver` |
| Shell | `Bun.$` |
| SQLite | `bun:sqlite` |
| UUID v7 | `Bun.randomUUIDv7()` |

## The Core Idea

**Handlers are pure functions returning `Result<T, E>`.** CLI and MCP are thin adapters over the same logic. Write the handler once, expose it everywhere.

```typescript
type Handler<TInput, TOutput, TError extends OutfitterError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;
```

This buys you:
- **Testability** — Call the function directly, no transport mocking
- **Reusability** — Same handler serves CLI, MCP, HTTP
- **Type Safety** — Input, output, and error types are explicit
- **Composability** — Handlers wrap handlers

## The Package Landscape

Dependencies flow one direction: Foundation → Runtime → Tooling.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOOLING TIER                              │
│  @outfitter/testing   @outfitter/tooling                        │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                        RUNTIME TIER                              │
│  @outfitter/cli    @outfitter/mcp    @outfitter/daemon          │
│  @outfitter/config @outfitter/logging @outfitter/file-ops       │
│  @outfitter/state  @outfitter/index                             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                       FOUNDATION TIER                            │
│  @outfitter/contracts    @outfitter/types                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  META: @outfitter/kit (version coordination across all tiers) │
└─────────────────────────────────────────────────────────────────┘
```

| Package | What It Does | Reach For When... |
|---------|--------------|-------------------|
| `@outfitter/contracts` | Result types, errors, Handler contract | Always. This is the foundation. |
| `@outfitter/types` | Type utilities, collection helpers | You need type manipulation |
| `@outfitter/cli` | Commands, output modes, formatting | Building CLI applications |
| `@outfitter/mcp` | Server framework, tool registration | Building AI agent tools |
| `@outfitter/config` | XDG paths, config loading | You have configuration |
| `@outfitter/logging` | Structured logging, redaction | You need logging (you do) |
| `@outfitter/daemon` | Lifecycle, IPC, health checks | Building background services |
| `@outfitter/file-ops` | Atomic writes, locking, secure paths | File operations that matter |
| `@outfitter/state` | Pagination, cursor state | Paginated data |
| `@outfitter/index` | SQLite FTS5, WAL mode, BM25 ranking | Full-text search indexing |
| `@outfitter/testing` | Test harnesses, fixtures | Testing (always) |
| `@outfitter/tooling` | Biome, TypeScript, Lefthook presets | Project setup (dev dependency) |
| `@outfitter/kit` | Version coordination meta-package | Ensuring compatible versions |

## Trail Map: Designing a System

Five things to know when building with the Outfitter stack. For the complete design process with templates, see [guides/architecture.md](guides/architecture.md).

### 1. Know Your Terrain

Before writing code, understand:

- **Transport surfaces** — CLI, MCP, HTTP, or all three?
- **Domain operations** — What actions does the system perform?
- **Failure modes** — What can go wrong? (these map to error taxonomy)
- **External dependencies** — APIs, databases, file system?

### 2. Design the Handler Layer

For each domain operation:

1. Define input type (Zod schema)
2. Define output type
3. Identify error types (from taxonomy)
4. Write the signature: `Handler<Input, Output, Error1 | Error2>`

```typescript
const CreateUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

interface User {
  id: string;
  email: string;
  name: string;
}

const createUser: Handler<unknown, User, ValidationError | ConflictError>;
```

### 3. Map Errors to the Taxonomy

Ten categories. Memorize the exit codes—you'll use them.

| Category | Exit | HTTP | Class | When |
|----------|------|------|-------|------|
| `validation` | 1 | 400 | `ValidationError` | Bad input, schema failures |
| `not_found` | 2 | 404 | `NotFoundError` | Resource doesn't exist |
| `conflict` | 3 | 409 | `ConflictError` | Already exists, version mismatch |
| `permission` | 4 | 403 | `PermissionError` | Forbidden action |
| `timeout` | 5 | 504 | `TimeoutError` | Took too long |
| `rate_limit` | 6 | 429 | `RateLimitError` | Too many requests |
| `network` | 7 | 502 | `NetworkError` | Connection failures |
| `internal` | 8 | 500 | `InternalError` | Bugs, unexpected errors |
| `auth` | 9 | 401 | `AuthError` | Authentication required |
| `cancelled` | 130 | 499 | `CancelledError` | User hit Ctrl+C |

### 4. Pick Your Packages

Start with `@outfitter/contracts`. Always.

- Building a CLI? Add `@outfitter/cli`
- Building MCP tools? Add `@outfitter/mcp`
- Touching files? Add `@outfitter/config` (paths) + `@outfitter/file-ops` (safety)

### 5. Wire Up Context Flow

Decide:

- **Entry points** — Where does context get created?
- **What's in context** — Logger, config, signal, workspaceRoot
- **Tracing** — How does requestId flow through?

## Guides

Deeper dives into specific topics.

| Guide | What's Covered | Location |
|-------|----------------|----------|
| **Getting Started** | First handler, CLI + MCP adapters | [guides/getting-started.md](guides/getting-started.md) |
| **Architecture Design** | 5-step process, templates, constraints | [guides/architecture.md](guides/architecture.md) |

## Pattern Deep Dives

When you need the details, not just the overview.

| Pattern | What's Covered | Location |
|---------|----------------|----------|
| **Handler Contract** | Input, context, Result | [patterns/handler.md](patterns/handler.md) |
| **Error Taxonomy** | 10 categories, exit/HTTP mapping | [patterns/errors.md](patterns/errors.md) |
| **Result Utilities** | Creating, checking, transforming | [patterns/results.md](patterns/results.md) |
| **CLI Patterns** | Commands, output modes, pagination | [patterns/cli.md](patterns/cli.md) |
| **MCP Patterns** | Tools, resources, prompts | [patterns/mcp.md](patterns/mcp.md) |
| **Daemon Patterns** | Lifecycle, IPC, health checks | [patterns/daemon.md](patterns/daemon.md) |
| **File Operations** | Atomic writes, locking, paths | [patterns/file-ops.md](patterns/file-ops.md) |
| **Logging** | Structured logging, redaction | [patterns/logging.md](patterns/logging.md) |
| **Testing** | Harnesses, fixtures, mocks | [patterns/testing.md](patterns/testing.md) |
| **Converting Code** | Migrating to the stack | [patterns/conversion.md](patterns/conversion.md) |

## Templates: Just Add Code

Copy, paste, customize.

| Template | For | Location |
|----------|-----|----------|
| **Handler** | Transport-agnostic business logic | [templates/handler.md](templates/handler.md) |
| **Handler Test** | Testing handlers with Bun | [templates/handler-test.md](templates/handler-test.md) |
| **CLI Command** | Commander.js wrapper | [templates/cli-command.md](templates/cli-command.md) |
| **MCP Tool** | Zod-schema tool definition | [templates/mcp-tool.md](templates/mcp-tool.md) |
| **Daemon Service** | Background service with IPC | [templates/daemon-service.md](templates/daemon-service.md) |

## Quick Start

```bash
# Foundation first
bun add @outfitter/contracts

# Then what you need
bun add @outfitter/cli       # CLI apps
bun add @outfitter/mcp       # MCP servers
bun add @outfitter/logging   # Structured logging
bun add @outfitter/config    # XDG-compliant config
bun add @outfitter/index     # Full-text search

# Dev dependencies
bun add -D @outfitter/testing @outfitter/tooling

# Version coordination (optional)
bun add @outfitter/kit
```

New here? Start with [guides/getting-started.md](guides/getting-started.md).

## The Rules

### Do

- Use Result types, not exceptions
- Map domain errors to taxonomy categories
- Design handlers as pure functions: `(input, ctx) => Result`
- Include error types in handler signatures
- Validate at handler entry with `createValidator`
- Pass context through all handler calls
- Test handlers directly—no transport layer needed

### Don't

- Throw exceptions in handlers
- Put transport-specific logic in handlers
- Hardcode paths (use XDG via `@outfitter/config`)
- Skip error type planning
- Couple handlers to specific transports
- Use `console.log` (use `ctx.logger`)

## Troubleshooting

Something not working? Use `debug-outfitter` for systematic investigation with structured reports. Common issues:

- **Result always error** — Check for missing `await` on async handlers
- **Type narrowing broken** — Don't reassign Result variables after checking
- **MCP tool not appearing** — Register before `start()`, add `.describe()` to schema fields
- **Wrong exit code** — Use `exitWithError()`, not `process.exit()`

If the issue is in Outfitter itself, use `outfitter-feedback` to file a bug.
