# Outfitter Kit — SPEC.md

## Purpose

Create a **Bun-first**, **strictly typed**, **test-driven**, and **opinionated** shared infrastructure monorepo for Outfitter projects.

The kit provides reusable **libraries + runtimes** (CLI, MCP, server, daemon, indexing primitives), while allowing each project to keep its own shape and domain needs. It also ships an umbrella dev/ops/tooling CLI named **`outfitter`**.

This spec is a *living contract* that prioritizes:

* **Behavior encoded as tests** (red → green → refactor)
* **Stable contracts** over incidental implementation
* **Bun-first ergonomics** with a **Node-first launcher shim** only where required (notably `npx`)

## Key Concepts

Before diving into the specification, understand these foundational concepts:

### MCP (Model Context Protocol)

Anthropic's open standard for AI assistants to interact with external tools and data sources. An MCP server exposes "tools" that Claude and other AI agents can discover and invoke. The kit provides infrastructure for building these servers with minimal boilerplate.

### Result<T, E> Pattern

A type representing either success (T) or error (E), avoiding exceptions. The kit uses the `better-result` library for this pattern. Handlers return Results; transport layers (CLI, MCP) handle unwrapping and formatting. This enables explicit error handling and composition without try/catch proliferation.

### Temperature Model

Packages are classified by change frequency:

* **Cold**: Stable APIs, changes rarely, high backward compatibility bar (e.g., `@outfitter/contracts`, `@outfitter/types`)
* **Warm**: Active development, may evolve as ergonomics improve (e.g., runtime packages)
* **Hot**: Rapid iteration, experimental features, expect changes (e.g., leaf applications)
* **Lukewarm**: Moderate churn, focused on workflow stability (e.g., tooling packages)

### Bun-first

Designing primarily for Bun runtime while maintaining Node compatibility where needed. Native Bun APIs are preferred over npm packages when available—they're faster, have zero dependencies, and align with the kit's philosophy. See the [dependency decision checklist](#dependency-decision-checklist) for the evaluation process.

## Runtime Requirements

| Runtime | Version | Notes |
|---------|---------|-------|
| Bun | ^1.3.6 | Required. All features depend on Bun runtime. |
| Node | Not supported | Bun-only kit. No Node compatibility layer. |

**Version enforcement:**

```typescript
const BUN_MIN_VERSION = "1.3.6";

if (typeof Bun === "undefined") {
  console.error("Outfitter Kit requires Bun runtime. Install from https://bun.sh");
  process.exit(1);
}

if (Bun.semver.order(Bun.version, BUN_MIN_VERSION) < 0) {
  console.error(`Bun ${BUN_MIN_VERSION}+ required. Current: ${Bun.version}`);
  process.exit(1);
}
```

## Scope

### In scope

* A Bun-managed monorepo with Turborepo (task orchestration and caching)
* Shared packages (contracts, config, CLI runtime, MCP runtime, logging, file/index primitives, etc.)
* Dual distribution for CLIs (JS/TS runner + optional Bun binaries)
* An umbrella CLI `outfitter` for repo bootstrap, normalization, release, CI helpers
* Adapters for runtime/vendor integrations (SQLite, Cloudflare later, providers later)
* XDG-first config/state/cache conventions (following [freedesktop.org](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) standards for config/cache/state paths)

### Explicitly lower priority

* Cloudflare adapter (valuable but not v1-critical)
* Metrics/telemetry (unless "basically free")

## Principles

These principles are **non-negotiable**. They define how we build, not just what we build.

### Core Engineering Principles

* **TDD-first (Red → Green → Refactor)**: Tests define behavior; implementations follow. The workflow is inviolable:
  1. **Red**: Write a failing test that defines the expected behavior. Run it. Watch it fail.
  2. **Green**: Write the minimal code to make the test pass. No more.
  3. **Refactor**: Improve the code while keeping tests green.

  **NEVER** write implementation before writing the test. **NEVER** merge code without tests that prove behavior. A passing test proves behavior exists. A failing test proves it doesn't—*yet*. When in doubt, write the test first. If you can't write the test, you don't understand the requirement.

* **DRY at every layer**: No copy-paste. If logic appears twice, extract it. If a pattern repeats across packages, promote it to shared infrastructure. **BUT**: the wrong abstraction is worse than duplication. When uncertain, tolerate duplication until the pattern clarifies—then extract. *"Duplication is far cheaper than the wrong abstraction."* (Sandi Metz)

* **Modular by design**: Packages are independently publishable, composable units with explicit boundaries. Each package has a single responsibility. Dependencies flow downward through the tier hierarchy—**NEVER** sideways within a tier, **NEVER** upward. If you can't explain what a package does in one sentence, it's doing too much.

### Technical Principles

* **Strict TypeScript**: `strict: true`, no implicit `any`, type-level APIs are intentional.
* **Import hygiene**: Avoid accidental dependency bleed; runtimes must not depend on each other.
* **Bun-first**: Use Bun-native capabilities where it improves simplicity and performance.
* **Bun before npm**: Before adding a dependency or building a utility, check if Bun provides it natively. If so, use the Bun version until you hit real limitations—and even then, consider what could be done to stay on the Bun path. External packages are a last resort, not a first instinct.
* **Compatibility is earned**: Node/Workers compatibility only where it materially matters.
* **Shared domain handlers**: CLI and MCP are thin adapters over transport-agnostic domain logic. Handlers return `Result<T, E>`, know nothing about output format or transport, and are tested once. CLI and MCP don't have to be 1:1, but they must rhyme.

### Single Source of Truth

Types, schemas, and contracts should have exactly one definition:

| Concern | Source of Truth | Derived From |
|---------|-----------------|--------------|
| Input validation | Zod schema | TypeScript types, JSON Schema |
| Error categories | `ErrorCategory` type | Exit codes, HTTP status codes |
| CLI flag names | Handler input types | MCP tool parameter names |
| Output shapes | `Shape` definitions | All renderers |

**Rule**: If two things must stay in sync, one MUST derive from the other.

### Handler Contract

Handlers are the unit of domain logic. They receive typed input, return Results, and know nothing about transport or output format.

**TDD-first: Write the test before the handler.**

```typescript
// handlers/notes.test.ts — WRITE THIS FIRST
import { describe, test, expect } from "bun:test";
import { getNote } from "./notes";
import { createTestContext } from "@outfitter/testing";

describe("getNote", () => {
  test("returns note when found", async () => {
    const ctx = createTestContext();
    const result = await getNote({ id: "existing-id" }, ctx);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toMatchObject({
      id: "existing-id",
      title: expect.any(String),
    });
  });

  test("returns NotFoundError when note does not exist", async () => {
    const ctx = createTestContext();
    const result = await getNote({ id: "nonexistent" }, ctx);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()._tag).toBe("NotFoundError");
  });
});
```

**Then implement the handler to make tests pass:**

```typescript
import type { Result } from "better-result";

/**
 * Handler — transport-agnostic domain logic unit.
 *
 * @typeParam TInput - Validated input parameters
 * @typeParam TOutput - Success return type
 * @typeParam TError - Error type (must extend KitError)
 *
 * @example
 * ```typescript
 * const getNote: Handler<{ id: string }, Note, NotFoundError> = async (input, ctx) => {
 *   const note = await ctx.db.notes.find(input.id);
 *   if (!note) return Result.err(new NotFoundError("note", input.id));
 *   return Result.ok(note);
 * };
 * ```
 */
type Handler<TInput, TOutput, TError extends KitError = KitError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;

/**
 * Context passed to every handler invocation.
 *
 * Provides access to cross-cutting concerns without polluting handler signatures.
 */
interface HandlerContext {
  /** Abort signal for cancellation propagation */
  signal?: AbortSignal;

  /** Structured logger with automatic context enrichment */
  logger: Logger;

  /** Resolved configuration for the current invocation */
  config: ResolvedConfig;

  /** Request ID for tracing (auto-generated if not provided) */
  requestId: string;
}

/**
 * Logger — structured logging interface used throughout the kit.
 *
 * Implementations are provided by @outfitter/logging (logtape wrapper).
 */
interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

/**
 * ResolvedConfig — fully merged configuration for the current invocation.
 *
 * Produced by @outfitter/config after merging env → user → project → defaults.
 */
interface ResolvedConfig {
  /** Tool name (e.g., "waymark", "firewatch") */
  toolName: string;

  /** Config file path (if found) */
  configPath?: string;

  /** XDG-compliant paths for this tool */
  paths: {
    config: string;
    data: string;
    cache: string;
    state: string;
    runtime: string;
  };

  /** Raw merged config object */
  raw: Record<string, unknown>;

  /** Type-safe accessor with schema validation */
  get<T>(key: string, schema: ZodType<T>): T;
}
```

**Handler rules:**

1. **Always return Result** — never throw exceptions
2. **Pure domain logic** — no awareness of CLI flags, MCP protocol, or output format
3. **Typed errors** — use specific error types, not generic Error
4. **Context via HandlerContext** — don't reach for globals
5. **Tested once** — adapters are thin, handlers get the tests

## Automated guardrails

The kit enforces standards through automated tooling, not discipline alone. This is critical for agent-assisted development where drift accumulates quickly.

### Static analysis

* **Strict TypeScript** — `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`. No escape hatches.
* **Biome + Ultracite** — Formatting and linting with zero-config defaults. Ultracite is an opinionated Biome configuration preset. Run on save, enforced in CI.
* **ast-grep** — AST-based structural code search/transform for kit-specific pattern enforcement:
  * Handlers must return `Result<T, E>`, not throw
  * No raw `console.log` (use `@outfitter/logging`)
  * No `any` type annotations
  * CLI commands must call `output()` for all user-facing data

### Git hooks (lefthook — fast, cross-platform Git hooks manager)

* **pre-commit**: Format check, lint, type-check affected packages
* **pre-push**: Full test suite for affected packages, ast-grep pattern validation

### CI gates

* All of the above, plus:
* Circular dependency detection (madge — JS/TS dependency graph analyzer — or similar)
* Package export validation (ensure public API is intentional)
* Bundle size checks for CLI entrypoints (fail if exceeds threshold)

### Documentation enforcement

* **TSDoc/JSDoc required** for all exported functions, types, and classes
* Doc coverage checked in CI (minimum threshold per package)
* Examples in docstrings are tested via `bun test --preload` extraction

### Pattern: fail early, fail loud

Guardrails should block bad code from landing, not catch it in review. If a pattern is important enough to document, it's important enough to automate.

## Blessed dependencies

These are the canonical choices for common infrastructure. Packages must use these unless there's explicit, documented rationale for divergence.

### Dependency decision checklist

Before adding any dependency or writing a utility function, run through this:

1. **Does Bun provide this natively?** Check [bun.sh/docs](https://bun.sh/docs) — Bun has built-ins for hashing, globbing, semver, YAML, TOML, colors, shell, SQLite, and much more.
2. **If yes, use Bun's version.** Even if it's slightly less ergonomic than an npm package.
3. **If you hit limitations**, first ask: can we wrap the Bun API to get what we need? A thin wrapper is better than a new dependency.
4. **If you truly need an external package**, check the blessed list below. If it's not listed, document the rationale.
5. **If the package duplicates Bun functionality**, it's almost certainly wrong. Push back.

### Bun-native utilities (first-class)

Prefer Bun built-ins over external packages. They're faster, have zero deps, and align with Bun-first philosophy.

| Capability | Bun API | Replaces |
|------------|---------|----------|
| Colors | `Bun.color()` | chalk, picocolors, ansis (for color conversion + ANSI output) |
| String width | `Bun.stringWidth()` | string-width (6,756x faster) |
| Strip ANSI | `Bun.stripANSI()` | strip-ansi (6-57x faster) |
| Hashing | `Bun.hash()`, `Bun.CryptoHasher` | crypto, xxhash, murmurhash |
| Glob | `Bun.Glob` | fast-glob, globby |
| Semver | `Bun.semver` | semver |
| YAML | `Bun.YAML` | js-yaml, yaml |
| TOML | Native imports | toml, @iarna/toml |
| Spawn | `Bun.spawn()`, `Bun.spawnSync()` | execa, child_process |
| Shell | `Bun.$` (shell tagged template) | execa, shelljs |
| Secrets | `Bun.secrets` | dotenv (for sensitive values) |
| Sleep | `Bun.sleep()`, `Bun.sleepSync()` | delay, sleep-promise |
| UUID | `Bun.randomUUIDv7()` | uuid (v7 is sortable!) |
| Deep equals | `Bun.deepEquals()` | deep-equal, lodash.isequal |
| Compression | `Bun.gzipSync()`, `Bun.zstdCompress()` | zlib, pako |
| Which | `Bun.which()` | which |
| Inspect/table | `Bun.inspect()`, `Bun.inspect.table()` | util.inspect, console.table |
| Console control | `Bun.stdin`, process.stdin modes | readline (for raw input) |
| Watch mode | `--watch`, `--hot` flags | nodemon, chokidar (for process restart) |
| SQL databases | `Bun.SQL` | postgres, mysql2 (unified client for PostgreSQL/MySQL) |
| S3 storage | `Bun.S3Client` | @aws-sdk/client-s3 (S3-compatible storage) |
| Redis | `Bun.RedisClient` | ioredis, redis (when distributed cache needed) |

> **⚠️ Bun API Stability Note**
>
> The following APIs are documented in Bun but may be **experimental or evolving**. Verify availability and stability before depending on them in production:
>
> - `Bun.SQL` — PostgreSQL/MySQL client (verify release status)
> - `Bun.S3Client` — S3-compatible storage (may require specific Bun versions)
> - `Bun.secrets` — Sensitive value handling (verify implementation)
> - `Bun.RedisClient` — Redis client (check if shipped)
>
> **Strategy**: Pin Bun version in `package.json` engines field. If an API isn't available, fall back to blessed npm packages (postgres, @aws-sdk/client-s3, ioredis). Check `bun --version` and [bun.sh/docs](https://bun.sh/docs) for current status.

### Bun.SQL — Unified Database Client

`Bun.SQL` provides a unified interface for PostgreSQL and MySQL with the same API as `bun:sqlite`. Use it when you need a relational database beyond SQLite.

```typescript
import { SQL } from "bun";

// PostgreSQL
const pg = new SQL("postgres://user:pass@localhost:5432/mydb");

// MySQL
const mysql = new SQL("mysql://user:pass@localhost:3306/mydb");

// Tagged template queries (SQL injection safe)
const userId = "123";
const user = await pg.query`SELECT * FROM users WHERE id = ${userId}`;

// Typed results
interface User {
  id: string;
  name: string;
  email: string;
}

const users = await pg.query<User>`SELECT * FROM users LIMIT 10`;

// Transactions
await pg.transaction(async (tx) => {
  await tx.query`INSERT INTO users (name) VALUES (${"Alice"})`;
  await tx.query`INSERT INTO audit_log (action) VALUES (${"user_created"})`;
});

// Connection pooling (automatic)
// Bun.SQL maintains a connection pool per database URL
```

**When to use which:**

| Database | Use Case |
|----------|----------|
| `bun:sqlite` | Local indexes, caches, single-user state |
| `Bun.SQL` (PostgreSQL) | Multi-user data, complex queries, JSONB |
| `Bun.SQL` (MySQL) | Legacy integration, specific MySQL features |

### Bun.S3Client — S3-Compatible Storage

Native S3 client for artifact storage, backups, and blob storage. Works with AWS S3, Cloudflare R2, MinIO, and other S3-compatible services.

```typescript
const s3 = new Bun.S3Client({
  bucket: "outfitter-artifacts",
  // Credentials from environment or explicit
  accessKeyId: Bun.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: Bun.env.AWS_SECRET_ACCESS_KEY,
  region: "us-east-1",
  // Or for R2/MinIO:
  endpoint: "https://account.r2.cloudflarestorage.com",
});

// Write file
await s3.write("indexes/waymark/main.db", await Bun.file("./index.db").arrayBuffer());

// Read file
const data = await s3.file("indexes/waymark/main.db").arrayBuffer();

// Stream large files
const stream = s3.file("backups/large-file.tar.gz").stream();

// List files
const files = await s3.list({ prefix: "indexes/" });

// Delete
await s3.delete("indexes/old-index.db");

// Presigned URLs (for temporary access)
const url = await s3.presign("artifacts/report.pdf", {
  expiresIn: 3600, // 1 hour
});
```

**Use cases in the kit:**

| Use Case | Pattern |
|----------|---------|
| Index snapshots | Backup/restore index.db to S3 |
| Artifact storage | Store build outputs, reports |
| Distributed cache | Share cache across instances |
| User uploads | Store user-provided files |

### Watch and hot reload

Bun's built-in watch capabilities are first-class for CLI tools and daemons.

**`--watch` mode:** Restarts the process when imported files change.

```bash
# Development: restart CLI on source changes
bun --watch run src/cli.ts

# Daemon development: auto-restart on code changes
bun --watch run src/daemon.ts
```

**`--hot` mode:** Hot-reloads modules without full restart (preserves state).

```bash
# Hot reload for long-running processes
bun --hot run src/server.ts
```

**Programmatic file watching** via `Bun.FileWatcher` for index invalidation:

```typescript
import { watch } from "fs";

// Watch for changes to trigger index rebuild
const watcher = watch(notesDir, { recursive: true }, (event, filename) => {
  if (filename?.endsWith(".md")) {
    indexer.invalidate(filename);
  }
});

// Or use Bun's native file watching in serve
Bun.serve({
  development: true,  // Enables watch mode
  // ...
});
```

**CLI integration:** Tools should support a `--watch` flag for development workflows:

```typescript
// waymark --watch starts in watch mode
export const watch = command("--watch")
  .description("Watch for changes and rebuild index")
  .action(async () => {
    // Initial build
    await buildIndex();
    
    // Watch for changes
    const watcher = watch(config.notesDir, { recursive: true }, async (event, filename) => {
      if (shouldReindex(filename)) {
        await incrementalReindex(filename);
      }
    });
  });
```

**Daemon hot reload:** Daemons can leverage `--hot` to update handlers without dropping connections:

```typescript
// With --hot, this module can be updated without restart
export default {
  async handleQuery(input: QueryInput) {
    // Handler logic - edits here apply immediately
  }
};
```

### Short hash IDs

For human-friendly references (e.g., `@e1b2c` instead of full UUIDs), use `Bun.hash()`:

```typescript
import { shortId } from "@outfitter/types";

// Generate a 5-char hash prefix from any string/object
const ref = shortId(someUUID);  // => "e1b2c"
const display = `@${ref}`;      // => "@e1b2c"

// Implementation uses Bun.hash internally
function shortId(input: string, length = 5): string {
  const hash = Bun.hash(input).toString(16);
  return hash.slice(0, length);
}
```

This pattern is useful for `get`, `update`, `delete` commands where full IDs are unwieldy.

### External packages (when Bun doesn't cover it)

| Concern | Library | Rationale |
|---------|---------|-----------|
| Schema validation | **Zod v4** | Best TS inference, broad ecosystem, v4 performance improvements |
| Result type | **better-result** | Lightweight, generator composition, TaggedError for discriminated unions |
| CLI parsing | **Commander.js** | Most widely used, stable ecosystem; `@outfitter/cli` wraps with typed helpers |
| Logging | **logtape** | Lightweight structured logging, good Bun support |
| MCP protocol | **@modelcontextprotocol/sdk** | Official SDK; `@outfitter/mcp` wraps for transport abstraction |
| SQLite | **bun:sqlite** | Native Bun, FTS5 (Full-Text Search) support built-in |
| Prompts | **@clack/prompts** | Pretty by default; `@clack/core` for customization |
| Trees | **object-treeify** | Object → tree rendering |
| Wrap text | **wrap-ansi** | ANSI-aware wrapping (uses Bun.stringWidth internally in our wrapper) |
| Truncate | **cli-truncate** | ANSI-aware truncation |
| Update notifier | **update-notifier** | First-class "new version available" prompts |

### Color strategy

`Bun.color()` handles color conversion and ANSI output with auto-detection (16/256/16m colors). For ergonomic chained styling in the semantic token layer:

```typescript
// @outfitter/ui builds tokens on Bun.color()
const tokens = {
  fg: {
    success: (text: string) => `${Bun.color("green", "ansi")}${text}\x1b[0m`,
    danger: (text: string) => `${Bun.color("red", "ansi")}${text}\x1b[0m`,
    // ...
  }
};
```

If chained styling becomes complex, `ansis` can layer on top—but start with Bun-native.

### Environment and secrets

```typescript
// Standard env vars
const apiUrl = Bun.env.API_URL;

// Secrets (redacted from logs, inspect, etc.)
const apiKey = Bun.secrets.API_KEY;  // Never appears in stack traces
```

### Upgrade paths

| Built-in | When to upgrade | Upgrade to |
|----------|-----------------|------------|
| `Bun.YAML` | Need schema validation, custom tags | `yaml` package |
| Native TOML imports | Need runtime parsing, writing | `@iarna/toml` |
| `bun:sqlite` | Need cross-platform abstraction | TanStack DB adapter |
| `Bun.color()` | Need complex chained styles | `ansis` |

### Progressive UI additions

These are "reach for when needed" — not in the default bundle but blessed when the need arises:

| Need | Library | Notes |
|------|---------|-------|
| Spinners | `ora` | The standard; uses `cli-spinners` for frames |
| Task lists | `listr2` | Multi-step with live status |
| Progress bars | `cli-progress` | Long operations |
| Tables | `cli-table3` | Unicode tables (or `Bun.inspect.table()` for simple cases) |
| Boxes/callouts | `boxen` | Highlighted messages; `cli-boxes` for presets |
| Symbols | `log-symbols`, `figures` | ✓ ✗ ⚠ with fallbacks |
| Live updates | `log-update` | Rewrite last line |
| Links | `terminal-link` | Clickable URLs |
| Open browser/app | `open` | Cross-platform (or `Bun.openInEditor()` for files) |
| Help formatting | `cliui` | Multi-column help/option lists |
| Config discovery | `cosmiconfig` | Find config files; may be used internally by `@outfitter/config` |
| Full TUI | `@opentui/core` | TypeScript TUI library from SST; supports React/Solid/Vue reconcilers |

### Supply chain note

Pin versions, use lockfiles, enable provenance/trusted publishing, run audits. A 2025 npm incident hit several CLI formatting packages. Doesn't mean avoid them—means be careful.

### Future considerations

* **TanStack DB adapter** — potential abstraction layer if SQLite needs to be swappable
* **Effect** — watching for potential future adoption if complexity warrants; not v1
* **Custom themes** — `Bun.color()` supports full CSS color parsing; theme files could define palettes

## Monorepo model

### Tooling

* Bun workspaces as the package manager
* Turborepo for task graph + caching
* Changesets for versioning + publishing (generates changelogs from PR-level change descriptions)
* Biome for formatting; additional linting is optional but must be consistent

### Top-level layout

* `packages/` — publishable packages
* `apps/` — runnable CLIs / daemons (thin wrappers around packages)
* `docs/` — system docs + extracted behavior notes
* `templates/` — scaffolding / bootstrap assets (consumed by `outfitter`)

## Package taxonomy

Packages are organized by **responsibility** and **change-temperature**.

### Foundation tier (cold)

Changes rarely; highly stable APIs.

* `@outfitter/contracts` — Result/Error patterns (via better-result), error serialization, error categories, TaggedError base classes
* `@outfitter/types` — branded types + common type utilities

#### Error Taxonomy

The kit uses a structured error hierarchy for consistent handling across CLI, MCP, and HTTP transports.

```typescript
/**
 * Error category — exhaustive, mutually exclusive classification.
 *
 * Used for:
 * - Exit code mapping (CLI)
 * - HTTP status code mapping (HTTP/MCP)
 * - Error grouping in logs and metrics
 * - Client retry decisions (transient vs permanent)
 */
type ErrorCategory =
  | "validation"    // Input validation failures (400)
  | "not_found"     // Resource doesn't exist (404)
  | "conflict"      // State conflict, concurrent modification (409)
  | "permission"    // Authorization denied (403)
  | "timeout"       // Operation exceeded time limit (408)
  | "rate_limit"    // Too many requests (429)
  | "network"       // Network/transport failures (502/503)
  | "internal"      // Unexpected internal errors (500)
  | "auth"          // Authentication failed (401)
  | "cancelled";    // User/signal cancellation (499)

/**
 * Base error interface for all kit errors.
 *
 * Errors are data, not exceptions. They serialize cleanly to JSON,
 * carry context for debugging, and map to appropriate exit/status codes.
 */
interface KitError {
  /** Discriminant for pattern matching (e.g., "NotFoundError", "ValidationError") */
  readonly _tag: string;

  /** Category for exit code / HTTP status mapping */
  readonly category: ErrorCategory;

  /** Human-readable error message */
  readonly message: string;

  /** Original error if this wraps another */
  readonly cause?: Error;

  /** Structured context for debugging (logged, not shown to users) */
  readonly context?: Record<string, unknown>;

  /** Serialize for JSON output / MCP responses */
  toJSON(): SerializedError;

  /** Map to CLI exit code */
  exitCode(): number;

  /** Map to HTTP status code */
  statusCode(): number;
}

interface SerializedError {
  _tag: string;
  category: ErrorCategory;
  message: string;
  context?: Record<string, unknown>;
}
```

**Category → Exit Code mapping:**

| Category | Exit Code | HTTP Status | Retryable |
|----------|-----------|-------------|-----------|
| `validation` | 1 | 400 | No |
| `not_found` | 2 | 404 | No |
| `conflict` | 3 | 409 | Maybe |
| `permission` | 4 | 403 | No |
| `timeout` | 5 | 408 | Yes |
| `rate_limit` | 6 | 429 | Yes |
| `network` | 7 | 502 | Yes |
| `internal` | 8 | 500 | Maybe |
| `cancelled` | 130 | 499 | No |
| `auth` | 9 | 401 | No |

**Code maps for error category → exit/status:**

```typescript
/**
 * Maps error category to CLI exit code.
 * Non-zero exit indicates error; specific values for script automation.
 */
const exitCodeMap: Record<ErrorCategory, number> = {
  validation: 1,
  not_found: 2,
  conflict: 3,
  permission: 4,
  timeout: 5,
  rate_limit: 6,
  network: 7,
  internal: 8,
  auth: 9,
  cancelled: 130,  // Convention: 128 + signal number (SIGINT = 2)
} as const;

/**
 * Maps error category to HTTP status code.
 * Used by MCP servers and API responses.
 */
const statusCodeMap: Record<ErrorCategory, number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  permission: 403,
  timeout: 408,
  rate_limit: 429,
  network: 502,
  internal: 500,
  auth: 401,
  cancelled: 499,  // Client closed request (nginx convention)
} as const;
```

**Concrete error classes:**

```typescript
import { TaggedError } from "better-result";

/**
 * Base class for all kit errors. Extends TaggedError for discriminated unions.
 */
abstract class BaseKitError extends TaggedError implements KitError {
  abstract readonly category: ErrorCategory;

  constructor(
    message: string,
    readonly context?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
  }

  toJSON(): SerializedError {
    return {
      _tag: this._tag,
      category: this.category,
      message: this.message,
      context: this.context,
    };
  }

  exitCode(): number {
    return exitCodeMap[this.category];
  }

  statusCode(): number {
    return statusCodeMap[this.category];
  }
}

/** Input validation failed */
class ValidationError extends BaseKitError {
  readonly _tag = "ValidationError";
  readonly category = "validation" as const;

  constructor(
    message: string,
    readonly field?: string,
    readonly expected?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, field, expected });
  }
}

/** Requested resource not found */
class NotFoundError extends BaseKitError {
  readonly _tag = "NotFoundError";
  readonly category = "not_found" as const;

  constructor(
    readonly resourceType: string,
    readonly resourceId: string,
    context?: Record<string, unknown>
  ) {
    super(`${resourceType} not found: ${resourceId}`, { ...context, resourceType, resourceId });
  }
}

/** State conflict (optimistic locking, concurrent modification) */
class ConflictError extends BaseKitError {
  readonly _tag = "ConflictError";
  readonly category = "conflict" as const;
}

/** Authorization denied */
class PermissionError extends BaseKitError {
  readonly _tag = "PermissionError";
  readonly category = "permission" as const;
}

/** Operation timed out */
class TimeoutError extends BaseKitError {
  readonly _tag = "TimeoutError";
  readonly category = "timeout" as const;

  constructor(
    message: string,
    readonly operation: string,
    readonly durationMs: number,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, operation, durationMs });
  }
}

/** Rate limit exceeded */
class RateLimitError extends BaseKitError {
  readonly _tag = "RateLimitError";
  readonly category = "rate_limit" as const;

  constructor(
    message: string,
    readonly retryAfterMs?: number,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, retryAfterMs });
  }
}

/** Network/transport failure */
class NetworkError extends BaseKitError {
  readonly _tag = "NetworkError";
  readonly category = "network" as const;
}

/** Unexpected internal error */
class InternalError extends BaseKitError {
  readonly _tag = "InternalError";
  readonly category = "internal" as const;
}

/** Operation cancelled by user or signal */
class CancelledError extends BaseKitError {
  readonly _tag = "CancelledError";
  readonly category = "cancelled" as const;
}

/** Authentication failed (missing or invalid credentials) */
class AuthError extends BaseKitError {
  readonly _tag = "AuthError";
  readonly category = "auth" as const;

  constructor(
    message: string,
    readonly provider?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, provider });
  }
}
```

### Runtime tier (warm/hot)

Expected to evolve as ergonomics and patterns improve.

* `@outfitter/cli` — typed Commander.js wrapper enforcing CLI law, output contract, input parsing, pagination state, execution flags
* `@outfitter/ui` — semantic tokens, shapes, renderers; decouples data shape from output format
* `@outfitter/mcp` — @modelcontextprotocol/sdk wrapper, tool search support, transport abstraction, CRUD helpers
* `@outfitter/config` — XDG resolution + config loading + override rules
* `@outfitter/state` — continuation state (pagination, per-command persisted state)
* `@outfitter/index` — locking, WAL (Write-Ahead Logging), compaction primitives, file watcher for incremental updates; SQLite via bun:sqlite (TanStack DB adapter path for future)
* `@outfitter/logging` — structured logging via logtape + redaction contract
* `@outfitter/file-ops` — secure path resolution, globbing via `Bun.Glob`, workspace constraints, locks
* `@outfitter/daemon` — daemon lifecycle, IPC, health checks, PID management
* `@outfitter/testing` — test harness utilities including `createMCPTestHarness()`, CLI test helpers

### Tooling tier (lukewarm)

Lower churn; focuses on workflows.

* `@outfitter/scripts`
* `@outfitter/actions`
* `@outfitter/release`

### Leaf lane (vendor / optional)

Versioned independently; declares compatibility with core/runtime ranges.

* `@outfitter/adapters-*` — Cloudflare adapter (later), provider SDK wrappers (later)

### Package dependency graph

```
                    ┌─────────────────────────────────────┐
                    │         Foundation tier             │
                    │           (cold)                    │
                    ├─────────────────────────────────────┤
                    │  contracts  ←───────  types         │
                    │  (Result/Error)      (branded types)│
                    └──────────┬──────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   config    │     │   logging   │     │  file-ops   │
    │ (XDG, load) │     │  (logtape)  │     │(glob, locks)│
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
             ┌─────────────┐       ┌─────────────┐
             │    index    │       │    state    │
             │ (SQLite,WAL)│       │(pagination) │
             └──────┬──────┘       └──────┬──────┘
                    │                     │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │     ui      │     │    cli      │     │    mcp      │
    │  (tokens,   │◄────│ (Commander) │────►│   (SDK)     │
    │   shapes)   │     └──────┬──────┘     └──────┬──────┘
    └─────────────┘            │                   │
                               └─────────┬─────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │   daemon    │
                                  │(IPC, health)│
                                  └─────────────┘

Legend:
  ───► depends on
  ◄─── also used by
```

**Import rules:**
- Foundation tier: depends only on external packages (better-result, Zod)
- Middle tier: can depend on foundation + each other
- Runtime tier: can depend on all tiers below
- Adapters: can depend on any tier, vendored as separate packages

## Meta-package

### Name

* **`@outfitter/kit`**

### Behavior: version coordination only

`@outfitter/kit` is a **coordination package**, not a re-export surface. It serves one purpose: ensuring compatible versions across kit packages.

* **peerDependencies manifest**: declares the blessed version range for each kit package
* **No re-exports**: consumers import from actual packages (`@outfitter/cli`, not `@outfitter/kit/cli`)
* **No code**: the package contains no runtime code, only version constraints

### Why no re-exports

Re-export surfaces create maintenance burden and obscure actual dependencies. Problems with re-exports:

* Import paths lie about what you depend on
* Tree-shaking becomes harder
* The meta-package becomes a "dumping ground" over time
* Version mismatches are harder to diagnose

With Bun workspaces + lockfile, version coordination happens automatically within the monorepo. For external consumers:

* `@outfitter/kit` declares peerDependencies on blessed versions
* Package managers resolve compatible versions
* Renovate/dependabot can group kit package updates

### Usage

```json
// package.json
{
  "dependencies": {
    "@outfitter/kit": "^1.0.0",
    "@outfitter/cli": "^1.0.0",
    "@outfitter/config": "^1.0.0"
  }
}
```

```typescript
// Import from actual packages
import { command, output } from "@outfitter/cli";
import { loadConfig } from "@outfitter/config";
```

### Blessed versions documentation

Each kit release includes a `VERSIONS.md` documenting the tested combination:

```markdown
# @outfitter/kit v1.2.0 — Blessed Versions

| Package | Version | Notes |
|---------|---------|-------|
| @outfitter/contracts | 1.0.0 | Stable |
| @outfitter/types | 1.1.0 | Stable |
| @outfitter/cli | 1.2.0 | Added --table output |
| @outfitter/ui | 1.1.0 | Stable |
| ... | ... | ... |
```

## Distribution lanes

### Lane 1: Library consumption

Projects install kit packages directly and import from them. `@outfitter/kit` provides version coordination but no re-exports—imports always come from the actual package.

### Lane 2: Zero-install runner

* `bunx` is first-class.
* `npx` is supported via a **Node-first launcher shim**.

### Lane 3: Bun binaries

* Each independent CLI can optionally ship compiled binaries.
* Binaries must be slim; entrypoints must avoid pulling in unrelated dependencies.

## CLI architecture

### Two CLI worlds

* **Independent CLIs**: `waymark`, `switchback`, `north`, etc.
  * Each owns its UX/command tree.
  * Built with `@outfitter/cli` runtime.
* **Umbrella CLI**: **`outfitter`**
  * Dev/ops/tooling: scaffolding, repo normalization, release helpers, CI helpers.

### Scripts vs CLIs

Two modes. No middle ground.

| Mode | Tooling | When to use |
|------|---------|-------------|
| **Script** | `Bun.argv` | Internal tools, one-off utilities, prototypes |
| **CLI** | Commander.js + `@outfitter/cli` | Anything user-facing or with multiple commands |

#### Scripts

For internal tooling where simplicity wins:

```typescript
// scripts/check-status.ts
const args = Bun.argv.slice(2);
const format = args.includes("--json") ? "json" : "human";

const status = await checkStatus();
console.log(format === "json" ? JSON.stringify(status) : formatHuman(status));
```

No CLI law compliance. No `--help` generation. No pagination. If you need any of that, it's a CLI.

#### CLIs

For anything beyond a simple script:

```typescript
import { createCLI, command, output } from "@outfitter/cli";

const cli = createCLI({ name: "waymark", version: "1.0.0" });

cli.register(
  command("list")
    .description("List all notes")
    .option("--limit <n>", "Max results", "20")
    .option("--json", "Output as JSON")
    .option("--next", "Continue from last position")
    .action(async ({ flags }) => {
      const results = await listNotes(flags);
      output(results); // Respects --json, --tree, --table automatically
    })
);
```

Full CLI law compliance. Pagination state. Structured error output. TSDoc for all commands.

#### The decision

If you're asking "should this be a script or a CLI?" — it's probably a CLI. Scripts are for things you'd delete without guilt.

### Composition model

* **Static composition** is the blessed path.
  * Commands are imported and registered at build time.
  * No runtime scanning/discovery required in v1.

## CLI law

The kit standardizes these conventions as defaults. Tools may drift only with explicit rationale.

### Output contract

* Human-friendly output is default.
* `--json` is mandatory.
* `--jsonl` is used when output can be append-only.
* Stable error serialization is mandatory.
* Durable schemas are preferred (play well with `jq`).

#### Schema-first JSONL pattern

* For JSONL streams, an optional mode supports emitting a schema line to **stderr** (so tools/agents can learn schema once, then parse stdout).

### Input contract

* Positional args are preferred.
  * Positional parsing continues until a flag or structural rule is encountered.
* stdin/stdout/stderr are first-class.
* `@` expansion is supported.
  * `@file` for file-sourced inputs.
  * `@` prefix may also be used to disambiguate identifiers when helpful.
* Globs/selectors are first-class.
* Array parsing supports multiple encodings:
  * `--flag a b c`
  * `--flag a,b,c`
  * repeated flags (`--id a --id b`) may be supported where it improves clarity.

### Shared input utilities (DRY)

Input parsing logic lives in `@outfitter/cli`, **not** in individual commands. Commands declare what they accept; the runtime handles parsing.

```typescript
import { collectIds, expandFileArg, parseGlob } from "@outfitter/cli";

// Multi-ID collection — handles all formats uniformly
// wm show id1 id2 id3
// wm show id1,id2,id3
// wm show --ids id1 --ids id2
// wm show @ids.txt
const ids = await collectIds(args.ids, {
  allowFile: true,      // @file expansion
  allowGlob: false,     // no glob patterns for IDs
  allowStdin: true,     // - reads from stdin
});

// File argument expansion
// wm create @template.md
const content = await expandFileArg(args.content);

// Glob expansion with workspace constraints
// wm index "src/**/*.ts"
const files = await parseGlob(args.pattern, { cwd: workspaceRoot });
```

**Rule**: If two commands parse IDs the same way, they MUST use the same utility. No copy-paste parsing logic.

| Utility | Purpose | Handles |
|---------|---------|---------|
| `collectIds()` | Multi-ID positional/flag parsing | space-separated, comma-separated, repeated flags, @file, stdin |
| `expandFileArg()` | Single @file expansion | @path reads file, literal strings pass through |
| `parseGlob()` | Glob pattern expansion | Bun.Glob with workspace constraints |
| `parseKeyValue()` | Key=value pairs | `--set key=value`, `--set key=value,key2=value2` |

### Pagination contract

* `--limit` is non-negotiable where listing/querying occurs.
* Pagination state is persisted **per command**.
* `--next` continues from persisted state.
* `--reset` clears the persisted state for that command.
* A user-supplied context key scopes state buckets.
  * Preferred flag name: `--context <name>` (alternatives may exist, but `--context` is the golden path).

### Execution contract

* Defaults follow clig.dev recommendations unless there is a clear reason to diverge.
* Common flags:
  * `--dry-run`
  * `--yes` / `--no-input`
  * `--verbose` / `--quiet`
  * `--config` / `--profile`
* Exit codes are standardized and documented.

## CLI UI system

The kit provides a semantic UI layer that separates **data shape** from **rendering**. Define your output once; render as tree, list, table, or JSON with a flag or context switch.

### Philosophy

CLIs should be DRY. If you change how "success" looks, it changes everywhere. If you add a field to a resource, every view of that resource updates. The shape of your data shouldn't be coupled to how it renders.

### Three layers

```
┌─────────────────────────────────────────┐
│  Tokens (design system)                 │  fg.success, icon.warning, border.muted
├─────────────────────────────────────────┤
│  Shapes (semantic data)                 │  Collection, Hierarchy, KeyValue, Resource
├─────────────────────────────────────────┤
│  Renderers (output modes)               │  list, tree, table, json, jsonl
└─────────────────────────────────────────┘
```

### Tokens

Design tokens define the visual language. One place to change, propagates everywhere. Built on `Bun.color()` for automatic terminal capability detection.

```typescript
import { createTokens } from "@outfitter/ui";

// Tokens are built on Bun.color() with automatic ANSI mode detection
const tokens = createTokens({
  // Semantic colors (not "red" — "danger")
  fg: {
    default: null,           // terminal default
    muted: "#888888",        // dimmed/secondary
    success: "#22c55e",      // green
    warning: "#eab308",      // yellow  
    danger: "#ef4444",       // red
    info: "#3b82f6",         // blue
  },
  // Can also use CSS color names, rgb(), hsl(), etc.
});

// Usage
tokens.fg.success("Operation complete");  // => "\x1b[38;2;34;197;94mOperation complete\x1b[0m"
tokens.fg.danger("Error occurred");       // Auto-downgrades to 256/16 colors if needed
```

Standard token accessors:

```typescript
tokens.fg.default    // primary text
tokens.fg.muted      // secondary/dimmed
tokens.fg.success    // green (operations succeeded)
tokens.fg.warning    // yellow (caution)
tokens.fg.danger     // red (errors, destructive)
tokens.fg.info       // blue (informational)

// Semantic icons (with fallbacks for dumb terminals)
tokens.icon.success  // ✓
tokens.icon.error    // ✗
tokens.icon.warning  // ⚠
tokens.icon.info     // ℹ
tokens.icon.pending  // ○
tokens.icon.active   // ●

// Emphasis
tokens.emphasis.strong  // bold
tokens.emphasis.subtle  // dim
tokens.emphasis.code    // inverse or distinct
```

### Shapes

Shapes describe *what* you're outputting, not *how*. They carry semantic meaning.

```typescript
import { Shape } from "@outfitter/ui";

// A flat collection of items
const notes = Shape.collection({
  items: results,
  fields: ["id", "title", "modified"],
  primary: "title",        // emphasized in compact views
  secondary: ["modified"], // shown in detailed views
});

// A hierarchy (files, categories, org charts)
const tree = Shape.hierarchy({
  root: workspace,
  children: (node) => node.items,
  label: (node) => node.name,
  badge: (node) => node.count,  // optional suffix
});

// Key-value pairs (config, metadata, details)
const details = Shape.keyValue({
  entries: [
    { key: "Name", value: note.title },
    { key: "Created", value: note.created, format: "relative" },
    { key: "Tags", value: note.tags, format: "list" },
  ],
});

// A single resource with typed fields
const note = Shape.resource({
  type: "note",
  data: noteData,
  schema: NoteSchema,  // Zod schema for field metadata
});
```

### Renderers

Renderers turn shapes into output. The same shape can render multiple ways.

```typescript
import { render } from "@outfitter/ui";

// Render as list (default human output)
render(notes, { mode: "list" });
// ✓ Meeting notes (modified 2h ago)
// ✓ Project roadmap (modified yesterday)
// ○ Draft: Q2 planning (modified 3d ago)

// Render as tree
render(notes, { mode: "tree" });
// notes
// ├── Meeting notes
// ├── Project roadmap
// └── Draft: Q2 planning

// Render as table
render(notes, { mode: "table" });
// ┌────────────────────┬──────────────┐
// │ Title              │ Modified     │
// ├────────────────────┼──────────────┤
// │ Meeting notes      │ 2h ago       │
// └────────────────────┴──────────────┘

// Render as JSON (--json flag)
render(notes, { mode: "json" });
// [{"id": "...", "title": "Meeting notes", ...}]

// Render as JSONL (--jsonl flag, streaming)
render(notes, { mode: "jsonl" });
// {"id": "...", "title": "Meeting notes", ...}
// {"id": "...", "title": "Project roadmap", ...}
```

### CLI integration

The `@outfitter/cli` runtime handles mode selection automatically:

```typescript
import { command, output } from "@outfitter/cli";
import { Shape } from "@outfitter/ui";

export const list = command("list")
  .option("--tree", "Show as tree")
  .option("--table", "Show as table")
  .action(async ({ flags }) => {
    const results = await getNotes();
    
    const shape = Shape.collection({
      items: results,
      fields: ["id", "title", "modified"],
      primary: "title",
    });
    
    // Mode auto-selected from flags (--json, --tree, --table, etc.)
    output(shape);
  });
```

### Composition

Shapes can nest. A resource can contain a collection; a hierarchy can contain key-value details.

```typescript
const workspace = Shape.resource({
  type: "workspace",
  data: ws,
  children: {
    notes: Shape.collection({ items: ws.notes, ... }),
    config: Shape.keyValue({ entries: configEntries }),
  },
});

// Renders recursively in any mode
render(workspace, { mode: "tree" });
```

### Custom renderers

Register custom renderers for domain-specific shapes:

```typescript
import { registerRenderer } from "@outfitter/ui";

registerRenderer("diff", (shape, tokens) => {
  // Custom rendering for diff shapes
  return shape.hunks.map(hunk => 
    hunk.lines.map(line => 
      line.type === "add" ? tokens.fg.success(line.text) :
      line.type === "del" ? tokens.fg.danger(line.text) :
      tokens.fg.muted(line.text)
    ).join("\n")
  ).join("\n");
});
```

### Package structure

* `@outfitter/ui` — tokens, shapes, renderers, composition
* Integrated into `@outfitter/cli` — mode selection, flag handling
* **Bun-native foundation:**
  * Colors via `Bun.color()` (auto-detects terminal capability)
  * String width via `Bun.stringWidth()` (6,756x faster than npm alternative)
  * Strip ANSI via `Bun.stripANSI()` (6-57x faster)
  * Tables via `Bun.inspect.table()` for simple cases
* **External for complex layout:**
  * `wrap-ansi` for ANSI-aware text wrapping
  * `cli-truncate` for ANSI-aware truncation
  * `object-treeify` for tree rendering

## MCP runtime

### Philosophy

CLI and MCP interfaces serve different consumers but share domain logic. The rule: **CLI::MCP don't have to be 1:1, but they must rhyme.** A developer familiar with one should intuit the other.

### Transport-agnostic handlers

Domain logic lives in handlers that know nothing about transport. CLI and MCP are thin adapters that parse input, call the handler, and format output.

```
┌─────────────┐     ┌─────────────┐
│   CLI       │     │   MCP       │
│  (adapter)  │     │  (adapter)  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 │
         ┌───────▼───────┐
         │   Handlers    │
         │ (domain logic)│
         └───────────────┘
```

#### The handler (pure domain logic)

```typescript
// handlers/notes.ts
import { Result } from "better-result";
import { NotFoundError } from "@outfitter/contracts";

export interface Note {
  id: string;
  title: string;
  content: string;
  modified: Date;
}

/**
 * Retrieve a note by ID.
 * @param id - The note identifier
 * @returns The note if found, or NotFoundError
 */
export async function getNote(id: string): Promise<Result<Note, NotFoundError>> {
  const note = await db.notes.find(id);
  if (!note) return Result.err(new NotFoundError("note", id));
  return Result.ok(note);
}

/**
 * List notes with pagination and optional filter.
 */
export async function listNotes(options: {
  limit: number;
  cursor?: string;
  filter?: string;
}): Promise<Result<{ items: Note[]; nextCursor?: string }, DatabaseError>> {
  const results = await db.notes.query(options);
  return Result.ok(results);
}
```

#### The CLI adapter

```typescript
// cli/commands/get.ts
import { command, output, exitWithError } from "@outfitter/cli";
import { getNote } from "../../handlers/notes";

export const get = command("get <id>")
  .description("Get a note by ID")
  .action(async ({ args }) => {
    const result = await getNote(args.id);

    result.match({
      ok: (note) => output(note),  // Respects --json, --tree, --table automatically
      err: (error) => exitWithError(error),
    });
  });
```

#### The MCP adapter

```typescript
// mcp/tools/get.ts
import { defineTool } from "@outfitter/mcp";
import { getNote } from "../../handlers/notes";

export const getNoteTool = defineTool("get_note", {
  description: "Retrieve a note by ID. Returns note content, metadata, and tags.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The note ID" }
    },
    required: ["id"]
  },
  handler: async (input) => {
    const result = await getNote(input.id);

    return result.match({
      ok: (note) => ({
        content: [{ type: "text", text: JSON.stringify(note) }]
      }),
      err: (error) => ({
        content: [{ type: "text", text: JSON.stringify(error) }],
        isError: true
      }),
    });
  }
});
```

#### Benefits

* **Test once**: Handlers are pure functions with `Result` return types. Test them directly without CLI parsing or MCP protocol overhead.
* **Consistent behavior**: Same logic regardless of how it's invoked. If CLI and MCP behave differently for the same operation, you have a bug.
* **Consistent errors**: Same `@outfitter/contracts` error shape in CLI `--json` output and MCP tool response.
* **Thin adapters**: Interface code is trivial—just input parsing and output formatting.

#### Recommended directory structure

```
src/
├── handlers/           # Domain logic (transport-agnostic)
│   ├── notes.ts
│   ├── notes.test.ts   # Tests at this level
│   └── index.ts
├── cli/                # CLI adapter
│   ├── commands/
│   │   ├── get.ts
│   │   ├── list.ts
│   │   └── index.ts
│   └── index.ts
└── mcp/                # MCP adapter
    ├── tools/
    │   ├── get.ts
    │   ├── list.ts
    │   └── index.ts
    └── server.ts
```

#### Anti-patterns

**❌ Business logic in CLI commands:**
```typescript
// Bad: logic trapped in CLI layer, can't be reused by MCP
command("get").action(async ({ args }) => {
  const note = await db.notes.find(args.id);  // Logic here!
  if (!note) exitWithError("Not found");
  output(note);
});
```

**❌ Different validation between interfaces:**
```typescript
// CLI validates one way
if (!isValidId(args.id)) exitWithError("Invalid ID format");

// MCP validates differently — inconsistent behavior
if (input.id.length < 3) return { isError: true, ... };
```

**❌ Throwing exceptions from handlers:**
```typescript
// Bad: exceptions break Result composition
async function getNote(id: string): Promise<Note> {
  const note = await db.notes.find(id);
  if (!note) throw new Error("Not found");  // Don't throw!
  return note;
}
```

The rule: handlers return `Result<T, E>`, never throw. Adapters call handlers and format the result for their transport.

### Tool search compatibility

MCP servers built with `@outfitter/mcp` are designed for Claude's tool search. This means:

**Deferred loading by default.** Domain-specific tools ship with `defer_loading: true`. The runtime handles this automatically based on tool categorization.

**Always-available core tools.** These are never deferred—they're the "landing pad" for agents:

| Tool | Purpose | Notes |
|------|---------|-------|
| `query` | FTS + filtered search | Primary discovery mechanism |
| `docs` | Documentation + examples | Includes usage patterns, static examples |
| `config` | Read/write server config | Connection status, preferences |

**Discoverable domain tools.** These are deferred and found via search:

| Tool | Purpose | CLI equivalent |
|------|---------|----------------|
| `list` | Enumerate resources with pagination | `<tool> list` |
| `get` | Retrieve single resource by ID | `<tool> get <id>` |
| `create` | Create new resource | `<tool> create` |
| `update` | Modify existing resource | `<tool> update <id>` |
| `delete` | Remove resource | `<tool> delete <id>` |

### Description discipline

Tool search indexes names, descriptions, argument names, and argument descriptions. Write for discoverability:

```typescript
// Bad: vague, no semantic keywords
{
  name: "get_item",
  description: "Gets an item"
}

// Good: specific, searchable terms
{
  name: "get_note",
  description: "Retrieve a single note by ID. Returns note content, metadata, tags, and linked references."
}
```

Argument descriptions matter too:

```typescript
{
  name: "query",
  input_schema: {
    properties: {
      q: {
        type: "string",
        // This gets searched!
        description: "Search query. Supports natural language, tag:value filters, and date ranges like 'last week'"
      }
    }
  }
}
```

### The `docs` tool

Combines documentation and examples in one always-available tool:

```typescript
docs({
  section?: "overview" | "tools" | "examples" | "schemas"
})
```

Returns structured content:

```json
{
  "overview": "Waymark indexes and searches your markdown notes...",
  "tools": [
    {
      "name": "query",
      "summary": "Full-text search across all notes",
      "examples": [
        { "input": { "q": "meeting notes" }, "description": "Simple search" },
        { "input": { "q": "tag:project-x modified:>2024-01-01" }, "description": "Filtered search" }
      ]
    }
  ],
  "schemas": {
    "Note": { "type": "object", "properties": { "..." } }
  }
}
```

This gives agents a single entry point to understand the server's capabilities without loading all tool definitions.

### The `config` tool

Read and modify server configuration:

```typescript
config({
  action: "get" | "set" | "list",
  key?: string,
  value?: unknown
})
```

Always-available so agents can check connection status, adjust behavior, or read preferences without searching.

### CRUD composition

For simple domains, tools can be composed to reduce surface area:

**Option 1: Combined list+get**

```typescript
// Single tool handles both
items({
  id?: string,        // If provided, return single item (get)
  filter?: string,    // If no id, return filtered list
  limit?: number,
  cursor?: string
})
```

**Option 2: Combined create+update (upsert)**

```typescript
upsert({
  id?: string,        // If provided, update existing
  data: ItemInput     // Create new if no id
})
```

The runtime provides helpers:

```typescript
import { defineCrudTools, defineUpsertTool } from "@outfitter/mcp";

// Generates list, get, create, update, delete with standard signatures
const tools = defineCrudTools("note", {
  schema: NoteSchema,
  handlers: { list, get, create, update, delete }
});

// Or compose them
const tools = [
  defineUpsertTool("note", { schema: NoteSchema, handler: upsert }),
  // ...
];
```

### Resource-linked tool hints

When `query` (or `list`, `get`) returns resources, results can include an `_actions` array indicating which tools can operate on that resource:

```json
{
  "results": [
    {
      "id": "note-abc123",
      "title": "Q1 Planning Meeting",
      "snippet": "...discussed roadmap priorities...",
      "_actions": ["get", "update", "delete", "link", "tag"]
    }
  ],
  "nextCursor": "...",
  "_availableFilters": ["tag", "modified", "created", "linked"]
}
```

The `_actions` array is:

* **Optional**: Resources can omit it if context is obvious
* **Dynamic**: Can vary by resource state (e.g., archived notes might only have `get`, `restore`, `delete`)
* **Lightweight**: Just tool names, not full schemas (agent can consult `docs` or trigger tool search for details)

**Runtime helper:**

```typescript
import { withActions } from "@outfitter/mcp";

// Define which tools apply to which resource types
const noteActions = ["get", "update", "delete", "link", "tag"];
const archivedNoteActions = ["get", "restore", "delete"];

// In your query handler
return {
  results: notes.map(note => withActions(note, 
    note.archived ? archivedNoteActions : noteActions
  ))
};
```

Or declaratively at the resource schema level:

```typescript
import { defineResource } from "@outfitter/mcp";

const Note = defineResource("note", {
  schema: NoteSchema,
  actions: {
    default: ["get", "update", "delete", "link", "tag"],
    when: {
      archived: ["get", "restore", "delete"],
      locked: ["get"]
    }
  }
});
```

**The `_meta` pattern:** Extend beyond actions—results can carry operational hints:

```json
{
  "results": ["..."],
  "nextCursor": "xyz",
  "_meta": {
    "actions": ["get", "update", "delete"],
    "filters": ["tag", "modified", "author"],
    "sortable": ["modified", "created", "title"],
    "bulkActions": ["delete", "tag", "archive"]
  }
}
```

**Convention:**

* `_` prefix for metadata fields (won't collide with domain data)
* Always optional—tools work fine without this, but are smarter with it
* Agents can ignore if they don't need the hints

### Tool schema evolution

MCP has protocol-level versioning but no standard for tool schema versioning. The kit adopts a **schema evolution** approach (inspired by GraphQL) rather than explicit tool versions.

#### Principles

* **Additive changes are safe**: new optional parameters, new tools, new output fields
* **Breaking changes get new tools**: create `query_v2` rather than breaking `query`
* **Deprecation is explicit**: use `_meta` fields to communicate lifecycle

#### What's breaking vs non-breaking

| Change type | Breaking? | Action |
|-------------|-----------|--------|
| Add optional parameter | No | Safe to add |
| Add new output field | No | Safe to add |
| Add new tool | No | Safe to add |
| Remove parameter | **Yes** | Create new tool |
| Change parameter type | **Yes** | Create new tool |
| Add required parameter | **Yes** | Create new tool |
| Remove output field | **Yes** | Create new tool |

#### Deprecation metadata

Tools include lifecycle information in `_meta`:

```typescript
{
  name: "query",
  description: "Search notes with filters",
  inputSchema: { /* ... */ },
  _meta: {
    version: "1.2.0",
    deprecated: false,
    deprecatedReason: null,
    replacedBy: null,
    since: "2024-01-15"
  }
}
```

When deprecating:

```typescript
{
  name: "search",
  _meta: {
    version: "1.0.0",
    deprecated: true,
    deprecatedReason: "Use 'query' instead for better filter support",
    replacedBy: "query",
    removeAfter: "2025-06-01"
  }
}
```

#### Deprecation workflow

1. **Announce** (month 0): Set `deprecated: true`, add `replacedBy`, communicate in changelog
2. **Migrate** (months 1-6): Both tools available, monitor usage via logging
3. **Remove** (month 6+): Delete deprecated tool after confirming zero usage

#### Runtime helpers

```typescript
import { defineTool, deprecatedTool } from "@outfitter/mcp";

// Current tool
const query = defineTool("query", {
  version: "1.2.0",
  description: "Search notes with filters",
  // ...
});

// Deprecated tool that redirects
const search = deprecatedTool("search", {
  replacedBy: "query",
  removeAfter: "2025-06-01",
  handler: async (input) => {
    // Optionally: log deprecation warning, then delegate
    return query.handler(transformInput(input));
  }
});
```

#### Agent expectations

Agents typically re-fetch tool definitions frequently (on each session or capability check), so schema changes propagate quickly. The deprecation metadata helps agents:

* Prefer non-deprecated tools when multiple options exist
* Surface warnings to users when invoking deprecated tools
* Understand migration paths via `replacedBy`

### Input/output contract

**Inputs:**

* MCP tools accept structured JSON objects
* Field names should match CLI flag names where possible (`--limit` → `limit`)
* Arrays use native JSON arrays (no comma-parsing ambiguity)

**Outputs:**

* Always structured JSON
* Pagination uses `cursor`/`nextCursor` pattern (matches tool search conventions)
* Errors use `@outfitter/contracts` error serialization

### Transport modes

| Mode | Use case | Notes |
|------|----------|-------|
| stdio | Local tools, Claude Desktop | Default for standalone |
| HTTP SSE (Server-Sent Events) | Remote/hosted, streaming | Default when daemon is running |
| HTTP streamable | Long-running operations | Index builds, bulk ops |
| WebSocket | Real-time bidirectional | Daemon ↔ CLI live updates |

**Daemon integration:** When a daemon is running, MCP servers prefer streaming over stdio. The runtime auto-negotiates (this is the default behavior):

```typescript
import { createMCPServer } from "@outfitter/mcp";

const server = createMCPServer({
  // If daemon socket exists, use HTTP SSE; otherwise stdio
  transport: "auto",
  daemon: {
    socket: "$XDG_RUNTIME_DIR/waymark/daemon.sock"
  }
});
```

**Native WebSocket for daemon:** Bun's native WebSocket server with pub/sub is the blessed approach for real-time daemon communication.

```typescript
// Daemon server with WebSocket pub/sub
Bun.serve({
  port: 0, // Unix socket
  unix: `${XDG_RUNTIME_DIR}/waymark/daemon.sock`,

  fetch(req, server) {
    // Upgrade WebSocket connections
    if (req.headers.get("upgrade") === "websocket") {
      const upgraded = server.upgrade(req, {
        data: { subscribedTopics: new Set() },
      });
      return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
    }

    // HTTP endpoints for non-WebSocket clients
    return handleHTTP(req);
  },

  websocket: {
    open(ws) {
      // Subscribe to default topics
      ws.subscribe("index-updates");
      ws.subscribe("status");
    },

    message(ws, message) {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case "subscribe":
          ws.subscribe(msg.topic);
          break;
        case "unsubscribe":
          ws.unsubscribe(msg.topic);
          break;
        case "query":
          // Handle query and respond
          handleQuery(ws, msg);
          break;
      }
    },

    close(ws) {
      // Cleanup handled automatically
    },
  },
});

// Publish updates to all subscribers (efficient broadcast)
function notifyIndexUpdate(update: IndexUpdate) {
  server.publish("index-updates", JSON.stringify({
    type: "index-update",
    data: update,
  }));
}
```

**Benefits over ws package:**

- 7x higher throughput
- Built-in pub/sub channels (no manual subscriber tracking)
- Memory-efficient broadcasting
- Zero dependencies

### Auth in MCP context

* MCP tools inherit the same `AuthProvider` contract as CLI
* For stdio: env vars are primary
* For HTTP: bearer tokens via `Authorization` header; refresh handled by runtime
* **No secrets in tool responses**—redaction contract applies

### Logging and observability

Logging is shared across CLI and MCP via `@outfitter/logging`, built on **logtape**.

* Structured JSON logs by default
* Log level controlled via `--verbose`/`--quiet` (CLI) or config (MCP)
* Context automatically includes transport type, tool/command name, request ID
* Redaction contract ensures secrets never appear in logs
* MCP servers log tool invocations for debugging agent interactions

### Redaction Contract

Secrets must never appear in logs, errors, or output. Redaction is a contract, not best-effort.

```typescript
/**
 * Redactor — sensitive data scrubbing for logs, errors, and output.
 *
 * Applied automatically by @outfitter/logging. Manual application
 * required when building custom output or error context.
 *
 * @example
 * ```typescript
 * const redactor = createRedactor({
 *   patterns: [
 *     /Bearer [A-Za-z0-9-_]+/g,           // Auth headers
 *     /sk-[A-Za-z0-9]{48}/g,              // OpenAI keys
 *     /ghp_[A-Za-z0-9]{36}/g,             // GitHub PATs
 *     /password[:=]\s*["']?[^"'\s]+/gi,   // Password fields
 *   ],
 *   keys: ["apiKey", "secret", "token", "password", "credential"],
 *   replacement: "[REDACTED]",
 * });
 *
 * const safeLog = redactor.redact(sensitiveObject);
 * ```
 */
interface Redactor {
  /** Redact sensitive values from an object (deep) */
  redact<T>(value: T): T;

  /** Redact sensitive values from a string */
  redactString(value: string): string;

  /** Check if a key name is sensitive */
  isSensitiveKey(key: string): boolean;

  /** Add a pattern at runtime */
  addPattern(pattern: RegExp): void;

  /** Add a sensitive key at runtime */
  addSensitiveKey(key: string): void;
}

interface RedactorConfig {
  /** Regex patterns to match and redact */
  patterns: RegExp[];

  /** Object keys whose values should always be redacted */
  keys: string[];

  /** Replacement string (default: "[REDACTED]") */
  replacement?: string;

  /** Whether to redact recursively in nested objects (default: true) */
  deep?: boolean;
}

/**
 * Audit trail for redaction events.
 *
 * Enables compliance verification without exposing secrets.
 */
interface RedactionAudit {
  /** Timestamp of redaction */
  timestamp: Date;

  /** What was redacted (pattern name or key, not the value) */
  redactedBy: "pattern" | "key";

  /** Identifier of the pattern/key that matched */
  matcher: string;

  /** Location in the object path (e.g., "config.auth.apiKey") */
  path: string;
}

/** Factory function */
function createRedactor(config: RedactorConfig): Redactor;
```

**Redaction integration points:**

| Layer | Automatic | Notes |
|-------|-----------|-------|
| `@outfitter/logging` | ✓ | All log output redacted |
| `KitError.toJSON()` | ✓ | Error context redacted |
| CLI `output()` | ✓ | All user-facing output redacted |
| MCP tool responses | ✓ | Handled by `@outfitter/mcp` |
| History/state files | ✓ | `@outfitter/state` redacts before write |

**Default sensitive patterns:**

```typescript
const DEFAULT_PATTERNS = [
  /Bearer [A-Za-z0-9-_.]+/g,              // Bearer tokens
  /Basic [A-Za-z0-9+/=]+/g,               // Basic auth
  /sk-[A-Za-z0-9]{32,}/g,                 // OpenAI keys
  /ghp_[A-Za-z0-9]{36}/g,                 // GitHub PATs
  /gho_[A-Za-z0-9]{36}/g,                 // GitHub OAuth
  /github_pat_[A-Za-z0-9_]{22,}/g,        // GitHub fine-grained PATs
  /xox[baprs]-[A-Za-z0-9-]+/g,            // Slack tokens
  /AKIA[A-Z0-9]{16}/g,                    // AWS access keys
  /-----BEGIN [A-Z ]+ KEY-----/g,         // PEM keys
];

const DEFAULT_SENSITIVE_KEYS = [
  "password", "passwd", "secret", "token", "apiKey", "api_key",
  "accessToken", "access_token", "refreshToken", "refresh_token",
  "credential", "private", "privateKey", "private_key",
];
```

## Testing infrastructure

### Runner

Bun's built-in test runner is primary. No Jest/Vitest unless there's a blocking gap.

**Watch mode for development:**

```bash
# Run tests on file changes
bun test --watch

# Run specific test file with watch
bun test --watch src/cli.test.ts
```

### Patterns

* **Unit tests**: Pure function behavior, type-level contracts
* **CLI output snapshots**: Golden file comparisons for `--json` and human output
* **Integration boundaries**: Tests that touch filesystem/SQLite use temp directories with cleanup
* **Black-box CLI tests**: Spawn actual CLI process, assert on stdout/stderr/exit code

### Conventions

* Test files: `*.test.ts` colocated with source
* Fixtures: `__fixtures__/` directory when needed
* Snapshots: `__snapshots__/` with `.snap` extension (Bun-native format)

### Golden file discipline

For CLI output stability:

1. Run command with known input
2. Compare stdout against committed golden file
3. Update golden files explicitly (`bun test --update-snapshots`)

This catches unintended output regressions—critical for agent consumers.

### MCP Tool Testing Harness

Testing MCP tools requires simulating the protocol without a full server. The kit provides a test harness.

```typescript
import { describe, test, expect } from "bun:test";
import { createMCPTestHarness } from "@outfitter/testing";
import { searchTool, getNoteTool, createNoteTool } from "../mcp/tools";

const harness = createMCPTestHarness({
  tools: [searchTool, getNoteTool, createNoteTool],
  fixtures: "./fixtures/mcp/",
});

describe("MCP tools", () => {
  test("search returns results", async () => {
    const result = await harness.callTool("search", {
      query: "authentication",
      limit: 10,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().content).toHaveLength(1);
    expect(result.unwrap().content[0].type).toBe("text");

    const data = JSON.parse(result.unwrap().content[0].text);
    expect(data.items.length).toBeGreaterThan(0);
  });

  test("validation errors are properly formatted", async () => {
    const result = await harness.callTool("search", {
      query: "", // Invalid: empty query
    });

    expect(result.isOk()).toBe(true); // MCP errors are in content
    expect(result.unwrap().isError).toBe(true);

    const error = JSON.parse(result.unwrap().content[0].text);
    expect(error.category).toBe("validation");
  });

  test("not found errors use correct category", async () => {
    const result = await harness.callTool("get_note", {
      id: "nonexistent-id",
    });

    expect(result.unwrap().isError).toBe(true);

    const error = JSON.parse(result.unwrap().content[0].text);
    expect(error.category).toBe("not_found");
    expect(error._tag).toBe("NotFoundError");
  });

  test("tool descriptions are searchable", () => {
    const tools = harness.listTools();

    // Verify description discipline
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.description).not.toMatch(/^Gets?\s/i); // No vague "Gets..."
    }
  });

  test("tools have valid input schemas", () => {
    const tools = harness.listTools();

    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });
});
```

**Harness API:**

```typescript
interface MCPTestHarness {
  /**
   * Call a tool by name with input parameters.
   * Returns the MCP-formatted response (content array).
   */
  callTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<Result<MCPToolResponse, MCPError>>;

  /**
   * List all registered tools with their schemas.
   */
  listTools(): MCPToolDefinition[];

  /**
   * Simulate a tool search (for testing discoverability).
   */
  searchTools(query: string): MCPToolDefinition[];

  /**
   * Load fixture data for a test.
   */
  loadFixture<T>(name: string): T;

  /**
   * Reset harness state between tests.
   */
  reset(): void;
}

interface MCPToolResponse {
  content: Array<{ type: "text" | "image"; text?: string; data?: string }>;
  isError?: boolean;
}
```

**Fixture organization:**

```
__fixtures__/
├── mcp/
│   ├── notes.json        # Sample note data
│   ├── search-results.json
│   └── config.json       # Test configuration
└── cli/
    └── ...
```

**Testing patterns:**

| Pattern | Purpose |
|---------|---------|
| Happy path | Tool returns expected data |
| Validation errors | Invalid input → `validation` category |
| Not found | Missing resource → `not_found` category |
| Permission denied | Auth failures → `permission` category |
| Schema compliance | Input schema matches Zod schema |
| Description quality | Descriptions are searchable, specific |

## Daemon lifecycle

### Commands

Standard subcommand pattern:

```
<tool> daemon start [--foreground] [--port <port>] [--hot]
<tool> daemon stop
<tool> daemon restart
<tool> daemon status
```

**Development mode:** `--hot` enables Bun's hot module replacement for the daemon, allowing handler updates without restart or dropped connections.

### IPC

**Primary:** Unix domain sockets (UDS) on macOS/Linux, named pipes on Windows.

* Socket path: `$XDG_RUNTIME_DIR/<tool>/daemon.sock` (or platform equivalent)
* HTTP-over-UDS for request/response semantics with streaming support
* Fallback to localhost TCP if UDS unavailable (with security warning)

### Health checks

* `GET /health` returns `{ "status": "ok", "uptime": <seconds>, "version": "<version>" }`
* Daemon exposes health on same socket
* `daemon status` CLI command calls health endpoint

### PID management

PID files prevent duplicate daemons and enable clean shutdown:

* PID file: `$XDG_RUNTIME_DIR/<tool>/daemon.pid`
* On start: check if PID exists and process is alive; refuse if so
* On stop: read PID, send SIGTERM, wait with timeout, SIGKILL if needed
* On crash: stale PID detection (process doesn't exist) allows restart

### Graceful shutdown

* SIGTERM triggers graceful drain (finish in-flight, stop accepting)
* Configurable drain timeout (default 30s)
* SIGKILL as last resort

### Stale Socket Detection

Before attempting connection, clients must detect and handle stale sockets from crashed daemons.

```typescript
/**
 * Socket connection with stale detection.
 *
 * @example
 * ```typescript
 * const connection = await connectToDaemon({
 *   socketPath: `${XDG_RUNTIME_DIR}/waymark/daemon.sock`,
 *   lockPath: `${XDG_RUNTIME_DIR}/waymark/daemon.lock`,
 *   connectionTimeout: 100,
 * });
 *
 * if (connection.isErr()) {
 *   if (connection.error._tag === "StaleSocketError") {
 *     // Socket exists but daemon isn't running
 *     await cleanupStaleSocket(socketPath);
 *   }
 * }
 * ```
 */
```

**Detection protocol:**

1. Check socket file exists at `$XDG_RUNTIME_DIR/<tool>/daemon.sock`
2. Check companion lock file at `$XDG_RUNTIME_DIR/<tool>/daemon.lock`
3. Attempt exclusive lock on lock file:
   - **Lock acquired** → daemon is dead, socket is stale
   - **Lock blocked** → daemon is alive, proceed with connection
4. If stale:
   - Remove stale socket file
   - Release lock (allow restart)
   - Log warning: `"Removed stale daemon socket (PID file indicated {pid})"`

> **Implementation Note**: Bun doesn't provide `flock()` natively. Use one of:
> - **PID file approach**: Write PID to lock file, verify process exists via `process.kill(pid, 0)`
> - **Exclusive file lock**: Use `Bun.file().writer({ lock: "exclusive" })` (check Bun version)
> - **Fallback**: Use `proper-lockfile` npm package if Bun locking is unavailable

**Platform considerations:**

| Platform | Socket | Lock |
|----------|--------|------|
| macOS/Linux | Unix domain socket | PID file + process check |
| Windows | Named pipe `\\.\pipe\<tool>-daemon` | CreateMutex or PID file |

```typescript
interface DaemonConnectionOptions {
  /** Path to Unix socket or named pipe */
  socketPath: string;

  /** Path to lock file (Unix) or mutex name (Windows) */
  lockPath: string;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;

  /** Whether to auto-cleanup stale sockets */
  autoCleanup?: boolean;
}

interface DaemonConnection {
  /** Send request and await response */
  request<T>(method: string, params?: unknown): Promise<Result<T, DaemonError>>;

  /** Close connection */
  close(): Promise<void>;

  /** Connection health check */
  ping(): Promise<Result<void, DaemonError>>;
}

type DaemonError =
  | StaleSocketError      // Socket exists but daemon dead
  | ConnectionRefusedError // Daemon not running
  | ConnectionTimeoutError // Daemon unresponsive
  | ProtocolError;        // Invalid response format
```

**Lock file semantics (PID-based approach):**

```typescript
// Daemon startup - PID file approach (Bun-compatible)
async function acquireDaemonLock(lockPath: string): Promise<Result<LockHandle, LockError>> {
  const file = Bun.file(lockPath);

  // Check if lock file exists with a valid PID
  if (await file.exists()) {
    const existingPid = parseInt(await file.text(), 10);
    if (!isNaN(existingPid) && isProcessAlive(existingPid)) {
      return Result.err(new LockError("Daemon already running", { pid: existingPid }));
    }
    // Stale lock file - process no longer exists
  }

  // Write our PID atomically
  await Bun.write(lockPath, String(process.pid));

  return Result.ok({
    pid: process.pid,
    release: async () => {
      // Only remove if it's still our PID (avoid race with restart)
      const currentPid = parseInt(await Bun.file(lockPath).text(), 10);
      if (currentPid === process.pid) {
        await Bun.file(lockPath).delete();
      }
    },
  });
}

// Check if process is alive (Unix: signal 0, Windows: similar)
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = test if process exists
    return true;
  } catch {
    return false; // Process doesn't exist or no permission
  }
}

// Client check
async function isDaemonAlive(lockPath: string): Promise<boolean> {
  const file = Bun.file(lockPath);
  if (!(await file.exists())) return false;

  const pid = parseInt(await file.text(), 10);
  return !isNaN(pid) && isProcessAlive(pid);
}
```

> **Note**: This PID-based approach is less robust than `flock()` under certain race conditions. For production daemons, consider using `proper-lockfile` npm package or implementing a more sophisticated locking protocol.

## Workspace detection

### Resolution order

Walk up from CWD until one of these markers is found:

1. `.git/` directory (with `package.json` or similar at same level or below)
2. `package.json` with `workspaces` field
3. `bun.lockb` or `bun.lock`
4. `Cargo.toml` with `[workspace]`
5. `go.work`
6. Explicit marker: `.outfitter-root` (escape hatch)

### Behavior

* `@outfitter/file-ops` exposes `findWorkspaceRoot(startDir?): string | null`
* Tools should fail clearly if workspace required but not found
* `--workspace <path>` override available where relevant

## Config, state, cache, and index

### XDG-first

* XDG is the default for config/state/cache.
* Fallbacks to platform-specific locations only if required.

### XDG fallbacks by platform

| XDG variable | macOS | Windows |
|--------------|-------|---------|
| `XDG_CONFIG_HOME` | `~/Library/Application Support` | `%APPDATA%` |
| `XDG_DATA_HOME` | `~/Library/Application Support` | `%LOCALAPPDATA%` |
| `XDG_STATE_HOME` | `~/Library/Application Support` | `%LOCALAPPDATA%` |
| `XDG_CACHE_HOME` | `~/Library/Caches` | `%LOCALAPPDATA%\cache` |
| `XDG_RUNTIME_DIR` | `$TMPDIR` | `%TEMP%` |

### IPC fallbacks by platform

* Unix sockets → named pipes (`\\.\pipe\<tool>-daemon`)
* File locking: PID file + process check (cross-platform), or `proper-lockfile` npm package

### Path handling

* Always use `path.join()` / `path.resolve()`—never string concatenation
* Normalize paths before comparison
* Handle long paths on Windows (consider `\\?\` prefix for paths > 260 chars)

### Preferred file conventions

* `config.toml` preferred.
* JSONC and YAML supported.
* Common naming:
  * `<tool>config.ext`
  * `<tool>.ext`
* Dotfolders preferred when appropriate.

### Override precedence

Default override order:

* env
* user config
* project config
* defaults

Tools may invert user/project precedence only with explicit rationale.

### State directory expectations

* Continuation state (pagination) is stored in XDG state.
* Optional structured command history is stored as scrubbed `history.jsonl`.
  * History must be redaction-safe and configurable.

### Cache vs index

* The kit supports **hybrid storage**:
  * SQLite for structured caches/indexes
  * file storage for blobs
* Default terminology:
  * Use **index** when the structure represents derived knowledge with compaction/lifecycle.
  * Use **cache** for recomputable accelerants.

### Cache/index control

Standard controls should be supported where relevant:

* `--no-cache`
* `--refresh`
* `--purge-cache` or `cache clear`
* optional `--ttl`

### Concurrency discipline

* **Single-writer locks are required** for persisted caches/indexes.
* v1 supports:
  * Exclusive lock helper (`withExclusiveLock`)
  * optional WAL (Write-Ahead Logging) + compactor pipeline
  * daemonized indexer for tools that need always-on indexing

#### Index Lock Protocol

Fine-grained locking for SQLite indexes enables concurrent reads while preventing write conflicts.

```typescript
/**
 * Lock types and their semantics.
 */
type LockType = "shared" | "exclusive" | "exclusive_blocking";

interface LockOptions {
  /** Lock type */
  type: LockType;

  /** Timeout in milliseconds (0 = non-blocking) */
  timeout: number;

  /** Number of retry attempts */
  retries: number;

  /** Backoff multiplier between retries */
  backoffMs: number;
}
```

**Lock matrix:**

| Operation | Lock Type | Timeout | Retries | Notes |
|-----------|-----------|---------|---------|-------|
| Read/query | Shared | 5s | 3 | Multiple readers allowed |
| Write/update | Exclusive | 10s | 3 | Single writer, blocks readers |
| Rebuild | Exclusive | 60s | 0 | Long-running, no retry |
| Compact | Exclusive | 30s | 1 | Background maintenance |

**Lock acquisition order (deadlock prevention):**

Always acquire locks in this order to prevent deadlocks:

1. Config lock (if modifying config)
2. State lock (if modifying state)
3. Index lock

```typescript
// Correct: consistent order
await withLock(configLock, async () => {
  await withLock(indexLock, async () => {
    // Safe
  });
});

// Wrong: inverted order risks deadlock
await withLock(indexLock, async () => {
  await withLock(configLock, async () => {
    // Deadlock risk!
  });
});
```

**Lock timeout handling:**

```typescript
interface LockTimeoutError extends KitError {
  readonly _tag: "LockTimeoutError";
  readonly category: "timeout";

  /** Path to the locked resource */
  readonly resourcePath: string;

  /** PID of lock holder (if known) */
  readonly holderPid?: number;

  /** How long we waited */
  readonly waitedMs: number;
}
```

**Recovery:**

When lock acquisition fails:

1. Return `LockTimeoutError` with holder PID if determinable
2. CLI suggests: `<tool> index --force-unlock` (requires `--yes` confirmation)
3. Force unlock removes lock file after verifying holder process is dead
4. If holder process is alive, refuse force unlock (user must kill it)

```typescript
// Force unlock implementation
async function forceUnlock(lockPath: string): Promise<Result<void, LockError>> {
  const holderPid = await readLockPid(lockPath);

  if (holderPid && isProcessAlive(holderPid)) {
    return Result.err(new LockError(
      `Lock held by live process ${holderPid}. Kill it first or wait.`
    ));
  }

  await Bun.file(lockPath).unlink();
  return Result.ok(undefined);
}
```

**SQLite WAL integration:**

```typescript
// Enable WAL mode for concurrent reads
const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000"); // 5s SQLite-level timeout

// Application-level lock wraps SQLite for cross-process coordination
await withExclusiveLock(lockPath, async () => {
  db.exec("BEGIN IMMEDIATE"); // Acquire SQLite write lock
  try {
    // Mutations here
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
});
```

## Cross-package composition

### Model: Import and configure

No DI (Dependency Injection) framework. Packages export factory functions or classes; consumers wire them.

### Adapter Interfaces

Adapters implement standardized interfaces for pluggable backends. All methods return `Result` types for consistent error handling.

```typescript
import type { Result } from "better-result";

/**
 * Index adapter — pluggable search/retrieval backends.
 *
 * Implementations: SQLite FTS5, in-memory, future: Tantivy, Meilisearch
 *
 * @typeParam T - The document type being indexed
 *
 * @example
 * ```typescript
 * const sqliteIndex = new SqliteFts5Adapter<Note>({
 *   db: database,
 *   table: "notes_fts",
 *   fields: ["title", "content", "tags"],
 * });
 *
 * await sqliteIndex.index(notes);
 * const results = await sqliteIndex.search("authentication patterns");
 * ```
 */
interface IndexAdapter<T> {
  /** Add or update documents in the index */
  index(items: T[]): Promise<Result<void, IndexError>>;

  /** Full-text search with optional filters */
  search(query: string, options?: SearchOptions): Promise<Result<SearchResult<T>, IndexError>>;

  /** Remove documents by ID */
  remove(ids: string[]): Promise<Result<void, IndexError>>;

  /** Clear all indexed documents */
  clear(): Promise<Result<void, IndexError>>;

  /** Get index statistics (doc count, size, last updated) */
  stats(): Promise<Result<IndexStats, IndexError>>;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  highlight?: boolean;
  snippetLength?: number;
}

interface SearchResult<T> {
  items: Array<T & { _score?: number; _highlights?: Record<string, string> }>;
  total: number;
  hasMore: boolean;
}

interface IndexStats {
  documentCount: number;
  sizeBytes: number;
  lastUpdated: Date | null;
}

/**
 * Cache adapter — pluggable caching backends.
 *
 * Implementations: SQLite, in-memory LRU, future: Redis via Bun.RedisClient
 *
 * @typeParam T - The cached value type
 */
interface CacheAdapter<T> {
  /** Get cached value, null if not found or expired */
  get(key: string): Promise<Result<T | null, CacheError>>;

  /** Set value with optional TTL in seconds */
  set(key: string, value: T, ttlSeconds?: number): Promise<Result<void, CacheError>>;

  /** Delete cached value, returns true if existed */
  delete(key: string): Promise<Result<boolean, CacheError>>;

  /** Clear all cached values */
  clear(): Promise<Result<void, CacheError>>;

  /** Check if key exists (without retrieving value) */
  has(key: string): Promise<Result<boolean, CacheError>>;

  /** Get multiple values at once */
  getMany(keys: string[]): Promise<Result<Map<string, T>, CacheError>>;
}

/**
 * Auth adapter — pluggable credential storage.
 *
 * Implementations: Environment, OS Keychain (via Bun.secrets), file-based
 */
interface AuthAdapter {
  /** Retrieve credential by key */
  get(key: string): Promise<Result<string | null, AuthError>>;

  /** Store credential */
  set(key: string, value: string): Promise<Result<void, AuthError>>;

  /** Remove credential */
  delete(key: string): Promise<Result<boolean, AuthError>>;

  /** List available credential keys (not values) */
  list(): Promise<Result<string[], AuthError>>;
}

/**
 * Storage adapter — pluggable blob/file storage.
 *
 * Implementations: Local filesystem, S3 via Bun.S3Client, R2
 */
interface StorageAdapter {
  /** Read file contents */
  read(path: string): Promise<Result<Uint8Array, StorageError>>;

  /** Write file contents */
  write(path: string, data: Uint8Array): Promise<Result<void, StorageError>>;

  /** Delete file */
  delete(path: string): Promise<Result<boolean, StorageError>>;

  /** Check if file exists */
  exists(path: string): Promise<Result<boolean, StorageError>>;

  /** List files matching pattern */
  list(pattern: string): Promise<Result<string[], StorageError>>;

  /** Get file metadata */
  stat(path: string): Promise<Result<FileStat, StorageError>>;
}

interface FileStat {
  size: number;
  modified: Date;
  created: Date;
}
```

```typescript
import { createCLI } from "@outfitter/cli";
import { loadConfig } from "@outfitter/config";
import { createLogger } from "@outfitter/logging";

const config = await loadConfig("waymark");
const logger = createLogger({ redact: config.redactPatterns });
const cli = createCLI({ logger, config });
```

### Adapter registration

Adapters implement interfaces from `@outfitter/contracts`. Registration is explicit:

```typescript
import { SqliteAdapter } from "@outfitter/adapters-sqlite";
import { registerIndexAdapter } from "@outfitter/index";

registerIndexAdapter("sqlite", SqliteAdapter);
```

### Outfitter CLI as scaffolder

`outfitter init` generates wiring boilerplate:

```
outfitter init cli --name waymark
outfitter init mcp --name waymark-mcp
outfitter init daemon --name waymark-daemon
```

Templates include standard composition patterns. Developers customize from there.

**Development commands** generated in scaffolded projects:

```bash
# Run CLI in watch mode (auto-restart on changes)
bun run dev

# Run daemon with hot reload
bun run dev:daemon

# Run tests in watch mode
bun run test:watch
```

## Shared Utilities

This section documents shared utilities that prevent duplication across packages. These utilities embody the DRY principle—if logic appears in multiple places, it lives here instead.

### Utility Placement Rules

1. **Foundation utilities** (`@outfitter/contracts`, `@outfitter/types`) — used by all packages, change rarely
2. **Runtime utilities** — placed in the package that owns the domain (config → paths, ui → formatting, state → pagination)
3. **Cross-boundary utilities** — shared between CLI and MCP, live in the package that owns the contract

### Core Utilities

#### Validation (`@outfitter/contracts`)

```typescript
import { z } from "zod";
import type { Result } from "better-result";

/**
 * Creates a validator from a Zod schema that returns Result instead of throwing.
 *
 * @example
 * const validateNote = createValidator(NoteSchema);
 * const result = validateNote(input); // Result<Note, ValidationError>
 */
function createValidator<T>(
  schema: z.ZodType<T>
): (input: unknown) => Result<T, ValidationError>;

/**
 * Validates input and returns Result. Standardized wrapper for Zod schemas.
 */
function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): Result<T, ValidationError>;
```

#### Type Guards (`@outfitter/types`)

```typescript
/**
 * Type guard factory for branded types.
 *
 * @example
 * const isNoteId = createTypeGuard<NoteId>(v => typeof v === "string" && v.length > 0);
 * if (isNoteId(value)) { ... }
 */
function createTypeGuard<T>(
  predicate: (value: unknown) => boolean
): (value: unknown) => value is T;

/**
 * Assertion function that throws if predicate fails.
 * Use sparingly—prefer Result types for recoverable failures.
 */
function assertType<T>(
  value: unknown,
  predicate: (value: unknown) => boolean,
  message?: string
): asserts value is T;
```

#### Short IDs (`@outfitter/types`)

```typescript
/**
 * Generate a 5-character hash prefix from any string.
 * Uses Bun.hash() for speed. Useful for human-readable references.
 *
 * @example
 * const ref = shortId("550e8400-e29b-41d4-a716-446655440000"); // => "e1b2c"
 */
function shortId(input: string): string;
```

#### Resilience (`@outfitter/contracts`)

```typescript
interface RetryOptions {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs?: number;
  jitter?: boolean;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Retry an async operation with exponential backoff.
 *
 * @example
 * const result = await retry(
 *   () => fetchResource(id),
 *   { maxAttempts: 3, backoffMs: 100, maxBackoffMs: 2000 }
 * );
 */
function retry<T>(
  fn: () => Promise<Result<T, KitError>>,
  options: RetryOptions
): Promise<Result<T, KitError>>;

/**
 * Wrap an async operation with a timeout.
 * Returns TimeoutError if the operation exceeds the limit.
 */
function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<Result<T, TimeoutError>>;
```

### Date/Time Utilities (`@outfitter/ui`)

```typescript
/**
 * Format a date as human-readable relative time.
 *
 * @example
 * formatRelative(new Date(Date.now() - 7200000)); // => "2h ago"
 * formatRelative(yesterday); // => "yesterday"
 */
function formatRelative(date: Date): string;

/**
 * Parse natural language date input.
 *
 * @example
 * parseDate("last week"); // => Result<Date, ValidationError>
 * parseDate("2024-01-15"); // => Result<Date, ValidationError>
 */
function parseDate(input: string): Result<Date, ValidationError>;

/**
 * Parse date range from search syntax.
 *
 * @example
 * parseDateRange("modified:>2024-01-01"); // => Result<DateRange, ValidationError>
 */
function parseDateRange(input: string): Result<DateRange, ValidationError>;

/**
 * Generate ISO timestamp (current time if no argument).
 */
function timestamp(date?: Date): string;
```

### String Utilities (`@outfitter/ui`)

```typescript
/**
 * ANSI-aware string truncation. Wraps cli-truncate.
 */
function truncate(text: string, maxWidth: number, options?: TruncateOptions): string;

/**
 * ANSI-aware text wrapping. Wraps wrap-ansi.
 */
function wrap(text: string, columns: number, options?: WrapOptions): string;

/**
 * Convert string to URL/file-safe slug.
 */
function slugify(text: string): string;

/**
 * Simple pluralization for user-facing messages.
 *
 * @example
 * pluralize(1, "note"); // => "1 note"
 * pluralize(5, "note"); // => "5 notes"
 */
function pluralize(count: number, singular: string, plural?: string): string;

/**
 * Format byte sizes for human readability.
 *
 * @example
 * formatBytes(1536); // => "1.5 KB"
 */
function formatBytes(bytes: number): string;

/**
 * Format duration for human readability.
 *
 * @example
 * formatDuration(125000); // => "2m 5s"
 */
function formatDuration(ms: number): string;
```

### Collection Utilities (`@outfitter/types`)

```typescript
/**
 * Group array items by key function.
 *
 * @example
 * const byCategory = groupBy(items, item => item.category);
 */
function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]>;

/**
 * Sort array by key(s) with direction control.
 *
 * @example
 * const sorted = sortBy(items, [
 *   { key: "modified", direction: "desc" },
 *   { key: "title", direction: "asc" }
 * ]);
 */
function sortBy<T>(items: T[], criteria: SortCriteria<T>[]): T[];

/**
 * Remove duplicates by identity or key function.
 */
function dedupe<T>(items: T[], keyFn?: (item: T) => unknown): T[];

/**
 * Split array into chunks of specified size.
 */
function chunk<T>(items: T[], size: number): T[][];
```

### Pagination (`@outfitter/state`)

```typescript
interface PaginationInput {
  limit?: number;
  cursor?: string;
}

interface PaginationOutput<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Extract a page from a collection with cursor generation.
 *
 * @example
 * const page = paginate(items, { limit: 20, cursor: lastCursor });
 * // => { items: [...], nextCursor: "abc123", hasMore: true }
 */
function paginate<T>(
  items: T[],
  input: PaginationInput
): PaginationOutput<T>;

/**
 * Encode pagination state as opaque cursor string.
 */
function encodeCursor(data: { offset: number; timestamp?: number }): string;

/**
 * Decode cursor string back to pagination state.
 */
function decodeCursor(cursor: string): Result<{ offset: number; timestamp?: number }, ValidationError>;
```

### Path Utilities (`@outfitter/file-ops`)

```typescript
/**
 * Resolve XDG-compliant paths with platform fallbacks.
 *
 * @example
 * xdgPath("config", "waymark");
 * // macOS: ~/Library/Application Support/waymark
 * // Linux: ~/.config/waymark
 */
function xdgPath(dir: "config" | "data" | "cache" | "state" | "runtime", toolName: string): string;

/**
 * Resolve path while preventing directory traversal attacks.
 * Returns ValidationError if path escapes the base directory.
 */
function secureResolvePath(base: string, userPath: string): Result<string, ValidationError>;

/**
 * Walk up directory tree to find workspace root.
 * Checks markers in priority order: .git/, package.json, bun.lock, Cargo.toml, etc.
 */
function findWorkspaceRoot(startDir?: string): Result<string, NotFoundError>;

/**
 * Normalize path for comparison (handle trailing slashes, . segments).
 */
function normalizePath(p: string): string;
```

### CLI-Specific Utilities (`@outfitter/cli`)

Beyond the shared input utilities (`collectIds`, `expandFileArg`, `parseGlob`, `parseKeyValue`), the CLI package provides:

```typescript
/**
 * Parse range inputs (numeric or date).
 *
 * @example
 * parseRange("1-10", "number"); // => Result<{ min: 1, max: 10 }, ValidationError>
 * parseRange("2024-01-01..2024-12-31", "date"); // => Result<DateRange, ValidationError>
 */
function parseRange(
  input: string,
  type: "number" | "date"
): Result<Range, ValidationError>;

/**
 * Parse filter expressions from CLI input.
 *
 * @example
 * parseFilter("status:active,priority:high");
 * // => Result<[{ field: "status", value: "active" }, ...], ValidationError>
 */
function parseFilter(input: string): Result<FilterExpression[], ValidationError>;

/**
 * Parse sort specification from CLI input.
 *
 * @example
 * parseSortSpec("modified:desc,title:asc");
 */
function parseSortSpec(input: string): Result<SortCriteria[], ValidationError>;

/**
 * Normalize an identifier (trim, lowercase where appropriate).
 */
function normalizeId(input: string, options?: NormalizeOptions): Result<string, ValidationError>;

/**
 * Prompt for confirmation before destructive operations.
 * Respects --yes flag for non-interactive mode.
 */
function confirmDestructive(options: {
  message: string;
  bypassFlag?: boolean;
  itemCount?: number;
}): Promise<Result<boolean, CancelledError>>;
```

### Cross-Boundary Utilities (`@outfitter/contracts`)

These utilities ensure consistency between CLI and MCP transports.

#### Response Envelope

```typescript
/**
 * Standard envelope for API responses.
 * Used by both CLI JSON output and MCP tool results.
 */
interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: SerializedError;
  meta?: EnvelopeMeta;
}

interface EnvelopeMeta {
  requestId: string;
  duration?: number;
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    total?: number;
  };
}

/**
 * Convert a Result to a response envelope.
 */
function toEnvelope<T, E extends KitError>(
  result: Result<T, E>,
  meta?: Partial<EnvelopeMeta>
): Envelope<T>;

/**
 * Convert a Result to HTTP-style response (for MCP over HTTP).
 */
function toHttpResponse<T, E extends KitError>(
  result: Result<T, E>
): { status: number; body: Envelope<T> };
```

#### Error Serialization

```typescript
/**
 * Serialize a KitError to JSON-safe format.
 * Strips stack traces in production, preserves in development.
 */
function serializeError(error: KitError, options?: { includeStack?: boolean }): SerializedError;

/**
 * Deserialize error from JSON (e.g., from MCP response).
 * Returns a typed KitError subclass based on _tag.
 */
function deserializeError(data: SerializedError): KitError;
```

#### Context Factory

```typescript
/**
 * Create a HandlerContext for a new request.
 * Auto-generates requestId using Bun.randomUUIDv7().
 */
function createContext(options: {
  logger?: Logger;
  config?: ResolvedConfig;
  signal?: AbortSignal;
  requestId?: string;
}): HandlerContext;

/**
 * Generate a sortable request ID (UUIDv7).
 */
function generateRequestId(): string;
```

#### JSON Safety

```typescript
/**
 * Stringify with circular reference handling and BigInt support.
 */
function safeStringify(value: unknown, options?: { pretty?: boolean }): string;

/**
 * Parse JSON with validation and error wrapping.
 */
function safeParse<T>(
  json: string,
  schema?: z.ZodType<T>
): Result<T, ValidationError>;
```

### Utility Priority Matrix

| Priority | Utility | Package | Rationale |
|----------|---------|---------|-----------|
| **P0** | `createValidator` | contracts | Every package validates input |
| **P0** | `shortId` | types | Display pattern used everywhere |
| **P0** | `xdgPath` | file-ops | Config/state/cache paths |
| **P0** | `secureResolvePath` | file-ops | Security-critical path handling |
| **P0** | `formatRelative` | ui | Ubiquitous display pattern |
| **P0** | `toEnvelope` | contracts | CLI/MCP response consistency |
| **P0** | `serializeError` | contracts | Error handling across transports |
| **P1** | `retry` / `withTimeout` | contracts | Resilience for index/network ops |
| **P1** | `paginate` / cursor utilities | state | CLI pagination contract |
| **P1** | `groupBy` / `sortBy` / `dedupe` | types | Collection operations |
| **P1** | `parseDate` / `parseDateRange` | ui | Search functionality |
| **P1** | `createContext` | contracts | Handler invocation |
| **P2** | `slugify` | ui | Can extract when needed |
| **P2** | `pluralize` | ui | Simple, can defer |
| **P2** | `circuitBreaker` | contracts | May not need for v1 |

### DRY Enforcement

Before implementing any utility:

1. **Check if it exists** — Search this section and package exports
2. **Check Bun natives** — Many utilities are built into Bun (see Blessed dependencies)
3. **Propose extraction** — If a pattern appears twice, open an issue to extract it here

**The wrong abstraction is worse than duplication.** When uncertain, tolerate duplication until the pattern clarifies—then extract.

---

## Auth and secrets

### Baseline

* **Env-first** auth is always available.
* Secret persistence is delegated via a pluggable interface.

### AuthProvider contract

* `AuthProvider` interface supports:
  * env provider (built-in)
  * optional adapters (OS keychain, etc.) as separate packages

### Safety rules

* No secrets written to:
  * logs
  * state
  * history
* Redaction is a contract, not best-effort.

## Adapters

Adapters exist to isolate environment-specific code and dependencies.

### v1 priorities

* SQLite adapter(s) may land early (Bun-native first).
* Cloudflare adapter is explicitly lower priority.

## Discovery and harvest plan

This program begins by mining proven behavior from existing repos and encoding it into tests.

### Sources

Initial reference repos (all `outfitter-dev/*`):

* `waymark`
* `firewatch`
* `switchback`
* `monorepo`
* `north`

### Method

* Define target surfaces (CLI law, config resolution, state/pagination, logging/redaction, file/index primitives, MCP patterns).
* For each surface:
  * Identify 2–3 reference implementations.
  * Write black-box tests that encode the behavior.
  * Implement minimal code to satisfy tests.
  * Refactor with import boundaries enforced.

### Deliverables

* `HARVEST_MAP.md` mapping behaviors → source repos/paths.
* Test suites that act as the behavioral spec.

## Quality gates

* Strict TS builds for all packages.
* Tests required for all new behavior.
* Circular dependency detection and package export validation are recommended.
* Size discipline for binaries and CLI entrypoints.

## Release and versioning

### Version model

* Packages version independently by "temperature."
* `@outfitter/kit` pins a known-good set.

### Canary

* Canary releases are supported.
* `@outfitter/kit` can have a `canary` tag that pins canary versions of hot-tier packages.

## Milestones

### Milestone 0: Monorepo foundation

* Bun workspaces + Turbo wired
* Changesets configured
* Shared lint/format/test baseline
* Automated guardrails configured:
  * Biome + Ultracite for formatting/linting
  * Strict TypeScript config (shared `tsconfig.base.json`)
  * Lefthook for pre-commit/pre-push hooks
  * ast-grep rules for kit-specific patterns
  * TSDoc coverage enforcement

### Milestone 1: Foundation tier stabilization

* `@outfitter/contracts` and `@outfitter/types` stabilized
* Redaction and error serialization contracts defined and tested

### Milestone 2: CLI runtime + UI system

* `@outfitter/cli` with:
  * output modes (`--json`, `--jsonl`, `--tree`, `--table`)
  * stable errors
  * input parsing (positional + arrays + `@`)
  * pagination (`--limit`, persisted per-command, `--next`, `--context`)
* `@outfitter/ui` with:
  * semantic tokens (colors, icons, emphasis)
  * shapes (collection, hierarchy, keyValue, resource)
  * renderers (list, tree, table, json, jsonl)
  * auto mode selection from flags

### Milestone 3: Config + state

* `@outfitter/config` with XDG-first resolution + override precedence
* `@outfitter/state` with continuation state + optional `history.jsonl`

### Milestone 4: Index primitives

* `@outfitter/index` with:
  * exclusive locks
  * WAL + compactor hooks
  * file watcher integration for incremental updates
  * invalidation callbacks on source changes

### Milestone 5: MCP runtime

* `@outfitter/mcp` with:
  * tool search compatibility (deferred loading, description discipline)
  * always-available core tools (`query`, `docs`, `config`)
  * CRUD composition helpers
  * resource-linked tool hints (`_actions`, `_meta`)
  * transport auto-negotiation (stdio ↔ HTTP SSE)

### Milestone 6: Daemon infrastructure

* `@outfitter/daemon` with:
  * start/stop/restart/status lifecycle
  * UDS/named pipe IPC
  * health checks
  * PID management
  * graceful shutdown

### Milestone 7: Tooling and umbrella CLI

* `outfitter` umbrella CLI for scaffolding and repo normalization
* `outfitter init` templates for cli, mcp, daemon
* `@outfitter/kit` meta-package published (version coordination only, no re-exports)
* `VERSIONS.md` documenting blessed version combinations

## Error recovery and resilience

This section is intentionally forward-looking. Implementation is not v1-critical, but the infrastructure should be designed to support these patterns gracefully.

### Philosophy

Errors are data, not exceptions. The kit's `Result<T, E>` pattern via better-result makes errors explicit and composable. But error *handling* strategy—retry, fallback, circuit breaking—is application-level.

### Patterns to support (later)

* **Retry with backoff**: For transient failures (network, rate limits)
* **Circuit breaker**: For failing dependencies (prevent cascade)
* **Graceful degradation**: For optional features (continue without)
* **Timeout contracts**: For operations with SLAs

### Infrastructure hooks

The kit should provide extension points, not implementations:

```typescript
// Hypothetical future API
import { withRetry, withTimeout, withCircuitBreaker } from "@outfitter/resilience";

const result = await withRetry(
  () => fetchFromAPI(id),
  { maxAttempts: 3, backoff: "exponential" }
);
```

### Design constraint

Whatever resilience patterns we add must compose with `Result<T, E>`. They should not introduce exception-based control flow.

## Migration Guide

### Breaking Change Policy

The kit follows semantic versioning with explicit migration support:

| Version Type | Breaking Changes | Migration Required |
|--------------|------------------|-------------------|
| **Major** (1.0 → 2.0) | Yes | Migration guide provided |
| **Minor** (1.0 → 1.1) | No | Additive only |
| **Patch** (1.0.0 → 1.0.1) | No | Bug fixes only |

**What constitutes a breaking change:**

- Removing or renaming exported functions/types
- Changing function signatures (required params, return types)
- Changing error categories or exit codes
- Changing file/config formats without migration
- Removing CLI flags or commands

**Not breaking:**

- Adding new optional parameters
- Adding new functions/types
- Adding new CLI flags (with sensible defaults)
- Adding new error types (existing handling still works)
- Performance improvements

### Data Migration

Index and cache files include version headers for automatic migration detection.

**File format:**

```
OUTFITTER_INDEX_V1
{"version":1,"created":"2024-01-15T00:00:00Z"}
...data...
```

**Migration detection:**

```typescript
interface VersionedFile {
  /** File format version */
  version: number;

  /** When this file was created */
  created: string;

  /** Tool that created it */
  tool: string;

  /** Tool version that created it */
  toolVersion: string;
}

async function detectVersion(filePath: string): Promise<Result<number, MigrationError>> {
  const header = await Bun.file(filePath).text({ length: 100 });

  const match = header.match(/^OUTFITTER_(\w+)_V(\d+)/);
  if (!match) {
    return Result.err(new MigrationError("Unknown file format"));
  }

  return Result.ok(parseInt(match[2], 10));
}
```

**Migration protocol:**

1. Detect file version via header
2. Compare against current version
3. If version mismatch:
   a. Backup existing file to `{path}.backup.{timestamp}`
   b. Attempt automatic migration if migration path exists
   c. If no migration path: rebuild from source (for indexes)
   d. Log migration: `"Migrated {type} from v{old} to v{new}"`

```typescript
type MigrationFn<TOld, TNew> = (old: TOld) => Result<TNew, MigrationError>;

interface MigrationRegistry {
  register<TOld, TNew>(
    type: string,
    fromVersion: number,
    toVersion: number,
    migrate: MigrationFn<TOld, TNew>
  ): void;

  migrate<T>(
    type: string,
    data: unknown,
    fromVersion: number,
    toVersion: number
  ): Result<T, MigrationError>;
}

// Example migrations
migrations.register("index", 1, 2, (v1Data) => {
  // Add new required field with default
  return Result.ok({
    ...v1Data,
    newField: "default",
  });
});

migrations.register("config", 1, 2, (v1Config) => {
  // Rename field
  const { oldName, ...rest } = v1Config;
  return Result.ok({
    ...rest,
    newName: oldName,
  });
});
```

### Config Migration

Config files use explicit version field for migration detection.

```yaml
# waymark.config.yaml
version: 2
notes_dir: ~/notes
index:
  rebuild_on_start: false
```

**Migration workflow:**

```typescript
async function loadConfig(configPath: string): Promise<Result<Config, ConfigError>> {
  const raw = await Bun.file(configPath).text();
  const parsed = parseYAML(raw);

  const currentVersion = CURRENT_CONFIG_VERSION;
  const fileVersion = parsed.version ?? 1; // Default to v1 if missing

  if (fileVersion < currentVersion) {
    const migrated = await migrateConfig(parsed, fileVersion, currentVersion);
    if (migrated.isErr()) return migrated;

    // Optionally write migrated config back
    if (shouldPersistMigration) {
      await writeConfig(configPath, migrated.value);
    }

    return migrated;
  }

  if (fileVersion > currentVersion) {
    return Result.err(new ConfigError(
      `Config version ${fileVersion} is newer than supported ${currentVersion}. Update the tool.`
    ));
  }

  return validateConfig(parsed);
}
```

### CLI Migration

When CLI commands or flags change, provide deprecation warnings before removal.

```typescript
// Deprecated flag handling
const list = command("list")
  .option("--count <n>", "DEPRECATED: Use --limit instead")
  .option("--limit <n>", "Maximum results")
  .action(async ({ flags }) => {
    if (flags.count !== undefined) {
      console.warn(
        `Warning: --count is deprecated and will be removed in v2.0. Use --limit instead.`
      );
      flags.limit ??= flags.count;
    }
    // ...
  });
```

**Deprecation timeline:**

1. **v1.x**: Add deprecation warning, old behavior works
2. **v1.(x+2)**: Warning becomes more prominent
3. **v2.0**: Remove deprecated flag/command

### MCP Tool Migration

See [Tool schema evolution](#tool-schema-evolution) for MCP-specific migration patterns.

## Open questions

These items are intentionally deferred for SPEC follow-ups once we validate the harvested behaviors.

* Exact naming for cache/index commands and directories
* Multi-platform binary distribution strategy details
* Cloudflare adapter scope and packaging
* Metrics/telemetry baseline (if "free enough")
* Bulk operation patterns (batch create/update/delete via MCP)
* Resilience package scope (`@outfitter/resilience` or integrated into contracts?)

## Related documents

* **AGENT_FIRST.md** — Companion document describing the philosophy and principles behind agent-first application design. Covers why we build this way, the surfaces agents consume (CLI, MCP, HTTP, files), and the vision for Expedition (post-kit agent runtime). The Kit is the *how*; Agent-First is the *why*.
