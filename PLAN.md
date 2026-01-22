# Outfitter Kit — Implementation Plan

## Overview

This plan sequences the implementation of Outfitter Kit using a **hybrid harvest-then-build** approach:

1. **Harvest** behavioral tests from existing repos (waymark, firewatch)
2. **Build** fresh packages that pass those tests
3. **Migrate** existing repos to consume the kit

### Guiding Principles (Non-Negotiable)

These principles govern **every phase** of implementation. Violating them is never acceptable.

| Principle | Rule | Violation |
|-----------|------|-----------|
| **TDD** | **ALWAYS** write failing tests before implementation. Red → Green → Refactor. | Writing implementation first, then adding tests after |
| **DRY** | **NEVER** duplicate logic. Extract to shared contracts/packages when patterns emerge. | Copy-pasting code between packages or phases |
| **Modularity** | **ALWAYS** keep packages independent and composable. One responsibility per package. | Packages that depend on each other sideways or upward |

**TDD Workflow (Every Feature):**
1. **Harvest or write failing tests** — these define the contract
2. **Run tests** — watch them fail (Red)
3. **Implement minimally** — just enough to pass (Green)
4. **Refactor** — improve while tests stay green
5. **Repeat**

**The failing test IS the spec.** If you can't write the test first, you don't understand the requirement yet. Pause and clarify.

**DRY Checkpoints:**
- Phase 2 extracts contracts/types shared by cli → prevents duplication in Phase 3+
- Each Phase 3 package extracts patterns discovered in Phase 1 → prevents future copy-paste
- Before adding code, ask: "Does this pattern exist elsewhere? Should I extract it?"

**Modularity Checkpoints:**
- Each package can be published independently
- Each package has a one-sentence description
- Dependencies only flow downward (Foundation → Runtime → Tooling)

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Hybrid harvest-then-build | TDD with real-world validation |
| Granularity | Package-level | Agent-executable, not too granular |
| Validation | Tracer bullet with `@outfitter/cli` | Prove pattern before scaling |
| Harvest sources | waymark + firewatch | Most active, best-maintained |
| Binary distribution | Deferred post-v1 | Optimization, not core capability |

### Execution Model

- **Solo or agent-assisted execution** — each package is a self-contained unit
- **Parallelization**: packages within same tier can run in parallel after dependencies met
- **Harvest sources**: `~/Developer/outfitter/waymark/`, `~/Developer/outfitter/firewatch/`

### Blessed Dependencies

External packages used across the kit. Bun-native APIs are preferred; these fill gaps.

| Concern | Package | Used By | Notes |
|---------|---------|---------|-------|
| Result type | `better-result` | contracts, all handlers | TaggedError for discriminated unions |
| Schema validation | `zod` (v4) | contracts, config, mcp | Runtime validation + TS inference |
| CLI parsing | `commander` | cli | Wrapped by `@outfitter/cli` |
| **Logging** | **`logtape`** | **logging** | Lightweight structured logging, Bun-native |
| MCP protocol | `@modelcontextprotocol/sdk` | mcp | Official SDK, wrapped for transport |
| Prompts | `@clack/prompts` | cli, outfitter | Interactive prompts |
| Tree rendering | `object-treeify` | ui | Object → tree output |
| Text wrapping | `wrap-ansi` | ui | ANSI-aware wrapping |

**Bun-native replacements** (no npm package needed):
- Colors: `Bun.color()` — replaces chalk/picocolors
- Hashing: `Bun.hash()` — replaces xxhash
- Glob: `Bun.Glob` — replaces fast-glob
- SQLite: `bun:sqlite` — native FTS5 support
- Semver: `Bun.semver` — replaces semver package
- Shell: `Bun.$` — replaces execa
- String width: `Bun.stringWidth()` — replaces string-width
- Strip ANSI: `Bun.stripANSI()` — replaces strip-ansi
- UUID: `Bun.randomUUIDv7()` — replaces uuid

**Additional dependencies** (see SPEC_v2.md for complete list):
- `cli-truncate` — ANSI-aware text truncation (ui)
- `proper-lockfile` — File locking fallback for daemon (if Bun locking unavailable)

---

## Phase 0: Monorepo Foundation

**Goal**: Establish the monorepo structure and automated guardrails before any package work.

### 0.1 Repository Setup

| Task | Done Criteria |
|------|---------------|
| Create `kit` repo | Repo exists, README.md with purpose |
| Configure Bun workspaces | `bun.lock` resolves, workspaces in `packages/` and `apps/` |
| Configure Turborepo | `turbo.json` with build/test/lint tasks, caching works |
| Configure Changesets | `.changeset/` configured, `bun changeset` works |

### 0.2 Shared Configuration

| Task | Done Criteria |
|------|---------------|
| Create `tsconfig.base.json` | `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` |
| Configure Biome + Ultracite | `biome.json` at root, `bun run format` and `bun run lint` work |
| Configure Lefthook | `.lefthook.yml` configured per hooks below |

**Lefthook hooks:**

| Hook | Tasks | Scope |
|------|-------|-------|
| `pre-commit` | format check, lint, **typecheck** | Affected packages only |
| `pre-push` | full test suite, **ast-grep patterns** | Affected packages |

**ast-grep rules** (kit-specific pattern enforcement):
- Handlers must return `Result<T, E>`, not throw
- No raw `console.log` (use `@outfitter/logging`)
- No `any` type annotations
- CLI commands must call `output()` for user-facing data

### 0.3 Directory Structure

```
kit/
├── packages/           # Publishable packages
├── apps/               # Runnable CLIs / daemons
├── docs/               # System documentation
├── templates/          # Scaffolding assets
├── scripts/            # Monorepo utilities
├── turbo.json
├── biome.json
├── tsconfig.base.json
├── .lefthook.yml
├── .changeset/
└── bun.lock
```

### 0.4 CI/CD Baseline

| Task | Done Criteria |
|------|---------------|
| GitHub Actions workflow | Runs on PR: format, lint, **typecheck**, test, ast-grep |
| Circular dependency check | `madge` or equivalent blocks circular imports |
| Package export validation | Public API is intentional (no accidental exports) |
| Bundle size check | CLI entrypoints fail if exceeding threshold |
| TSDoc coverage | Minimum threshold per package enforced |

**Phase 0 complete when**: `bun install`, `bun run build`, `bun run test`, `bun run lint` all pass on empty monorepo.

---

## Phase 1: Tracer Bullet — `@outfitter/cli`

**Goal**: Validate the harvest-then-build approach with the most behavior-rich package.

### 1.1 Harvest: Identify CLI Patterns

**Source repos**: waymark, firewatch

| Surface | Harvest Target | Source Files |
|---------|----------------|--------------|
| Command structure | Commander.js setup, registration | `src/cli/index.ts`, `src/cli/commands/*.ts` |
| Output contract | `--json`, `--jsonl` handling | Look for output formatting logic |
| Input contract | Positional args, `@file` expansion | Flag parsing, stdin handling |
| Pagination | `--limit`, `--next`, cursor persistence | State file writes/reads |
| Error handling | Exit codes, error formatting | Error classes, process.exit calls |

**Deliverable**: `packages/cli/HARVEST_MAP.md` documenting patterns found.

### 1.2 Harvest: Extract Test Cases

| Test Category | Example Test Cases | Source |
|---------------|-------------------|--------|
| Output modes | `--json` produces valid JSON, `--jsonl` streams lines | waymark, firewatch |
| Error serialization | Errors include `_tag`, `category`, `message` | waymark, firewatch |
| Pagination state | `--next` continues from persisted cursor | **Spec-driven** |
| Input parsing | `@file` reads file contents, arrays parse correctly | waymark |
| Exit codes | Validation errors → exit 1, not found → exit 2 | waymark, firewatch |

> **Harvest Note**: Neither waymark nor firewatch has persisted pagination state with `--next` cursor. Firewatch uses stateless `--limit`/`--offset`. Pagination with cursor persistence must be built from SPEC_v2.md.

**Deliverable**: `packages/cli/src/__tests__/` with failing tests extracted from patterns.

### 1.3 Build: Minimal Implementation

| Component | Implementation |
|-----------|----------------|
| `createCLI()` | Factory function wrapping Commander.js |
| `command()` | Typed command builder with flag inference |
| `output()` | Mode-aware output (respects `--json`, `--tree`, etc.) |
| `exitWithError()` | Formats error and exits with correct code |
| Pagination helpers | `loadCursor()`, `saveCursor()`, `--next` flag handling |

**Shared input utilities** (DRY — commands use these, never reimplement):

| Utility | Purpose |
|---------|---------|
| `collectIds()` | Multi-ID parsing (space/comma-separated, @file, stdin) |
| `expandFileArg()` | Single @file expansion |
| `parseGlob()` | Glob expansion with workspace constraints |
| `parseKeyValue()` | Key=value pair parsing |
| `parseRange()` | Numeric/date range parsing ("1-10", "2024-01-01..2024-12-31") |
| `parseFilter()` | Filter expressions ("status:active,priority:high") |
| `parseSortSpec()` | Sort criteria ("modified:desc,title:asc") |
| `normalizeId()` | ID normalization (trim, lowercase where appropriate) |
| `confirmDestructive()` | Destructive operation confirmation (respects `--yes`) |

> **DRY Rule**: If two commands accept IDs, they MUST use `collectIds()`. No copy-paste parsing logic in individual commands.

**Done criteria**: All harvested tests pass.

### 1.4 Document: Package API

| Deliverable | Content |
|-------------|---------|
| `packages/cli/README.md` | Usage examples, API reference |
| TSDoc on exports | All public functions/types documented |
| `packages/cli/CHANGELOG.md` | Initial entry |

**Phase 1 complete when**: Tests pass, package builds, docs exist, pattern is validated.

---

## Phase 2: Foundation Tier

**Goal**: Extract stable contracts from what cli surfaced. These change rarely.

### 2.1 `@outfitter/contracts`

**Harvest scope**: Error patterns, Result usage from cli implementation.

| Component | Description |
|-----------|-------------|
| `Handler<T,O,E>` | Transport-agnostic handler type signature |
| `HandlerContext` | Context interface with signal, logger, config, requestId |
| `Logger` interface | Structured logging contract |
| `ResolvedConfig` interface | Merged config with type-safe accessor |
| `KitError` base class | Extends `TaggedError` from better-result |
| Error taxonomy | `ValidationError`, `NotFoundError`, `ConflictError`, `AuthError`, etc. |
| `ErrorCategory` type | Union of category strings |
| Exit/status code maps | `exitCodeMap`, `statusCodeMap` constants |
| `Redactor` interface | Pattern-based secret scrubbing |
| `DEFAULT_PATTERNS` | Bearer, API keys, PATs, PEM keys |
| `DEFAULT_SENSITIVE_KEYS` | password, token, apiKey, etc. |

**Shared utilities** (DRY — see SPEC_v2.md Shared Utilities section):

| Utility | Purpose | Priority |
|---------|---------|----------|
| `createValidator<T>()` | Zod-to-Result wrapper for consistent validation | P0 |
| `validateInput<T>()` | Standardized schema validation | P0 |
| `serializeError()` | JSON-safe error serialization | P0 |
| `deserializeError()` | Reconstruct typed errors from JSON | P0 |
| `toEnvelope<T>()` | Result → response envelope | P0 |
| `toHttpResponse<T>()` | Result → HTTP response with status | P0 |
| `createContext()` | Factory for HandlerContext | P1 |
| `generateRequestId()` | UUIDv7 request ID generator | P1 |
| `retry<T>()` | Exponential backoff retry | P1 |
| `withTimeout<T>()` | Operation timeout wrapper | P1 |
| `safeStringify()` | Circular-safe JSON stringify | P1 |
| `safeParse<T>()` | Validated JSON parsing | P1 |

**Adapter interfaces** (pluggable backends):

| Interface | Purpose |
|-----------|---------|
| `IndexAdapter<T>` | Pluggable search/retrieval (SQLite FTS5, Tantivy, etc.) |
| `CacheAdapter<T>` | Pluggable caching (SQLite, LRU, Redis) |
| `AuthAdapter` | Credential storage (env, keychain, file) |
| `StorageAdapter` | Blob/file storage (local, S3, R2) |

**Test targets**:
- Handler type enforces Result return (type-level test)
- HandlerContext provides all required fields
- Error serialization round-trips correctly
- Exit codes map correctly per category
- Redactor removes known secret patterns
- Adapter interfaces compile with mock implementations
- `createValidator` wraps Zod errors in ValidationError
- `retry` respects maxAttempts and backoff
- `withTimeout` returns TimeoutError on expiry
- `toEnvelope` produces consistent shape for ok/error cases

**Done criteria**: cli package can import and use these contracts.

### 2.2 `@outfitter/types`

**Harvest scope**: Branded types, common utilities from cli/contracts.

| Component | Description |
|-----------|-------------|
| Branded types | `NoteId`, `FilePath`, etc. |
| `shortId()` | 5-char hash prefix using `Bun.hash()` |
| Common type utilities | `Prettify<T>`, `DeepReadonly<T>`, etc. |

**Shared utilities** (DRY — see SPEC_v2.md Shared Utilities section):

| Utility | Purpose | Priority |
|---------|---------|----------|
| `shortId()` | 5-char hash from Bun.hash() | P0 |
| `createTypeGuard<T>()` | Factory for branded type guards | P0 |
| `assertType<T>()` | Assertion for type narrowing | P1 |
| `groupBy<T,K>()` | Group array by key function | P1 |
| `sortBy<T>()` | Multi-criteria sorting | P1 |
| `dedupe<T>()` | Remove duplicates by key | P1 |
| `chunk<T>()` | Split array into chunks | P2 |

**Test targets**:
- Branded types are assignable correctly
- `shortId()` produces consistent 5-char hashes
- Type guards narrow correctly
- `groupBy` handles empty arrays and single items
- `sortBy` respects direction and multi-criteria order
- `dedupe` preserves first occurrence

**Done criteria**: contracts and cli packages use these types.

**Phase 2 complete when**: Both packages stable, cli refactored to use them.

---

## Phase 3: Runtime Tier (Core)

**Goal**: Build the packages that power CLI and MCP runtimes.

### 3.1 `@outfitter/config`

**Harvest scope**: Config loading from waymark/firewatch.

| Component | Description |
|-----------|-------------|
| XDG path resolution | `getConfigPath()`, `getStatePath()`, etc. |
| Config loading | TOML/YAML/JSON with schema validation |
| Override precedence | env → user → project → defaults |
| Platform fallbacks | macOS `~/Library/...`, Windows `%APPDATA%` |

**Test targets**:
- XDG paths resolve correctly per platform
- Override precedence is respected
- Invalid config produces `ValidationError`

**Done criteria**:
- All test targets pass
- CLI package refactored to use `loadConfig()`
- XDG paths verified on macOS (Windows deferred to Phase 7)

### 3.2 `@outfitter/logging`

**Harvest scope**: Logging patterns, redaction integration.

| Component | Description |
|-----------|-------------|
| `createLogger()` | Factory with logtape underneath |
| Structured output | JSON logs by default |
| Redaction integration | Auto-applies `Redactor` from contracts |
| Context enrichment | Request ID, command name, transport |

**Test targets**:
- Logs are valid JSON
- Secrets are redacted (patterns from contracts)
- Context fields are present

**Done criteria**:
- All test targets pass
- CLI package uses `createLogger()` for all logging
- Logger implements `Logger` interface from contracts

### 3.3 `@outfitter/file-ops`

**Harvest scope**: Path handling, workspace detection, globbing.

| Component | Description |
|-----------|-------------|
| `findWorkspaceRoot()` | Walk up from CWD for markers |
| `secureResolvePath()` | Prevent path traversal attacks |
| Glob wrapper | `Bun.Glob` with workspace constraints |
| Lock helpers | `withExclusiveLock()`, `withSharedLock()` |

**Shared utilities** (DRY — see SPEC_v2.md Shared Utilities section):

| Utility | Purpose | Priority |
|---------|---------|----------|
| `xdgPath()` | XDG-compliant path resolution with platform fallbacks | P0 |
| `secureResolvePath()` | Prevent directory traversal attacks | P0 |
| `findWorkspaceRoot()` | Walk up to find workspace markers | P0 |
| `normalizePath()` | Normalize paths for comparison | P1 |

**Test targets**:
- Workspace detection finds correct markers
- Path traversal attempts are blocked
- Locks prevent concurrent writes
- XDG paths resolve correctly per platform (macOS/Linux)
- `normalizePath` handles trailing slashes and `.` segments

**Done criteria**:
- All test targets pass
- Workspace detection supports all marker types (git, package.json, Cargo.toml, etc.)
- Lock helpers use PID-based locking (Bun-compatible)

### 3.4 `@outfitter/state`

**Harvest scope**: Pagination state, history from cli work. **Note**: Cursor persistence is spec-driven (not found in existing repos).

| Component | Description |
|-----------|-------------|
| Pagination state | Per-command cursor persistence |
| Context scoping | `--context` for state buckets |
| Optional history | Redacted `history.jsonl` |

**Shared utilities** (DRY — see SPEC_v2.md Shared Utilities section):

| Utility | Purpose | Priority |
|---------|---------|----------|
| `paginate<T>()` | Extract page from collection with cursor | P1 |
| `encodeCursor()` | Encode pagination state as opaque string | P1 |
| `decodeCursor()` | Decode cursor to pagination state | P1 |
| `loadCursor()` | Load persisted cursor for command | P1 |
| `saveCursor()` | Persist cursor for command | P1 |

**Test targets**:
- Cursor persists across invocations
- Context scoping isolates state
- History is redacted before write
- `paginate` handles empty collections and returns correct `hasMore`
- Cursor encoding is opaque and tamper-resistant
- `decodeCursor` returns ValidationError on invalid input

**Done criteria**:
- All test targets pass
- CLI `--next` flag works with persisted cursor
- State files stored in XDG state directory

### 3.5 `@outfitter/ui`

**Harvest scope**: Output formatting patterns from cli.

| Component | Description |
|-----------|-------------|
| Tokens | `fg.success`, `icon.warning`, etc. via `Bun.color()` |
| Shapes | `Collection`, `Hierarchy`, `KeyValue`, `Resource` |
| Renderers | list, tree, table, json, jsonl |
| Mode selection | Auto from flags (`--json`, `--tree`, etc.) |

**Shared utilities** (DRY — see SPEC_v2.md Shared Utilities section):

| Utility | Purpose | Priority |
|---------|---------|----------|
| `formatRelative()` | Human-readable relative time ("2h ago") | P0 |
| `formatDuration()` | Duration formatting ("2m 5s") | P1 |
| `formatBytes()` | Byte size formatting ("1.5 KB") | P1 |
| `truncate()` | ANSI-aware string truncation (wraps cli-truncate) | P1 |
| `wrap()` | ANSI-aware text wrapping (wraps wrap-ansi) | P1 |
| `pluralize()` | Simple pluralization ("1 note" vs "5 notes") | P2 |
| `slugify()` | Convert to URL/file-safe slug | P2 |
| `parseDate()` | Natural language date parsing | P1 |
| `parseDateRange()` | Date range from search syntax | P1 |
| `timestamp()` | ISO timestamp generation | P2 |

**Test targets**:
- Tokens produce correct ANSI codes
- Shapes render correctly in each mode
- Mode selection from flags works
- `formatRelative` handles edge cases (now, yesterday, years ago)
- `truncate` preserves ANSI codes
- `parseDate` handles natural language ("last week", "yesterday")

**Done criteria**:
- All test targets pass
- CLI `output()` uses ui shapes and renderers
- All output modes work (human, json, jsonl, tree, table)

**Phase 3 complete when**: cli package refactored to use all five packages, tests pass.

---

## Phase 4: Runtime Tier (Index & MCP)

**Goal**: Build indexing primitives and MCP runtime.

### 4.1 `@outfitter/index`

**Harvest scope**: SQLite patterns from waymark (FTS5, WAL).

| Component | Description |
|-----------|-------------|
| Lock protocol | Shared/exclusive with timeout, deadlock prevention |
| WAL + compactor | Write-ahead logging, background compaction |
| File watcher | Invalidation on source changes |
| `IndexAdapter` interface | Pluggable backends (SQLite FTS5 first) |

**Test targets**:
- Concurrent reads allowed, writes exclusive
- Lock timeout produces `LockTimeoutError`
- File changes trigger invalidation callback
- FTS5 search returns ranked results

### 4.2 `@outfitter/mcp`

**Harvest scope**: MCP patterns from waymark (if exists) or spec-driven.

| Component | Description |
|-----------|-------------|
| `createMCPServer()` | Factory wrapping @modelcontextprotocol/sdk |
| `defineTool()` | Typed tool definition helper |
| Deferred loading | `defer_loading: true` for domain tools |
| Always-available tools | `query`, `docs`, `config` (landing pad) |
| CRUD helpers | `defineCrudTools()`, `defineUpsertTool()` |
| `_actions` metadata | Resource-linked tool hints |
| Transport negotiation | stdio ↔ HTTP SSE auto-detection |

**Core tools (always available):**

| Tool | Purpose |
|------|---------|
| `query` | Structured search across resources |
| `docs` | Documentation/help for the tool |
| `config` | View/modify configuration |

**Test targets**:
- Tool definitions validate against MCP schema
- Core tools (`query`, `docs`, `config`) available by default
- Deferred tools not loaded until searched
- Error responses use `KitError` serialization
- Transport negotiation selects correct mode

**Done criteria**:
- All test targets pass
- MCP server can be started with `bun run mcp`
- Core tools respond correctly

**Phase 4 complete when**: Index and MCP packages functional, integration test with real SQLite.

---

## Phase 5: Daemon Infrastructure

**Goal**: Build the daemon lifecycle package.

### 5.1 `@outfitter/daemon`

**Harvest scope**: **Spec-driven** (no daemon patterns in waymark/firewatch)

> **Note**: Neither waymark nor firewatch has daemon implementations. This package must be built from the SPEC_v2.md specification. Consider investigating navigator for daemon patterns if available.

| Component | Description |
|-----------|-------------|
| Lifecycle commands | start, stop, restart, status |
| IPC | Unix domain sockets (macOS/Linux), named pipes (Windows) |
| Health checks | `/health` endpoint |
| PID management | PID file with process check (see SPEC_v2.md locking note) |
| Graceful shutdown | SIGTERM drain, configurable timeout |
| WebSocket pub/sub | Bun native WebSocket for real-time updates |

**Implementation notes**:
- Use PID file + `process.kill(pid, 0)` for locking (Bun doesn't provide `flock()`)
- Consider `proper-lockfile` npm package for production robustness
- Test stale detection thoroughly on crash scenarios

**Test targets**:
- `daemon start` creates socket and PID file
- `daemon status` reports health correctly
- Stale socket detection works after crash
- Graceful shutdown completes in-flight requests

**Phase 5 complete when**: Daemon lifecycle works end-to-end on macOS.

---

## Phase 6: Tooling & Umbrella CLI

**Goal**: Build the `outfitter` umbrella CLI and scaffolding.

### 6.1 `outfitter` CLI

| Component | Description |
|-----------|-------------|
| `outfitter init cli` | Scaffold new CLI project |
| `outfitter init mcp` | Scaffold new MCP server |
| `outfitter init daemon` | Scaffold daemon project |
| Templates | Composition patterns, dev commands |

**Test targets**:
- `outfitter init cli --name test` creates working project
- Generated project passes lint/type/test
- Dev commands (`bun run dev`, `bun run test:watch`) work

### 6.2 `@outfitter/kit` Meta-package

| Component | Description |
|-----------|-------------|
| Version coordination | peerDependencies on blessed versions |
| No re-exports | Consumers import from actual packages |
| `VERSIONS.md` | Documents tested combination |

### 6.3 `@outfitter/testing`

| Component | Description |
|-----------|-------------|
| `createMCPTestHarness()` | Test MCP tools without transport |
| CLI test helpers | Capture stdout/stderr, exit codes |
| Mock factories | Config, logger, context mocks |

**Test targets**:
- MCP test harness invokes tools correctly
- CLI helpers capture output modes

### 6.4 Tooling Tier Packages

| Package | Description |
|---------|-------------|
| `@outfitter/scripts` | Monorepo utility scripts (build, release, etc.) |
| `@outfitter/actions` | GitHub Actions for CI/CD |
| `@outfitter/release` | Release automation (changesets integration) |

**Note**: These packages support the kit's development workflow and are lower priority than runtime packages. Can be built incrementally as needs arise.

**Phase 6 complete when**: `outfitter init` scaffolds working projects.

---

## Phase 7: Migration & Validation

**Goal**: Migrate existing repos to consume kit packages.

### 7.1 Waymark Migration

| Step | Description |
|------|-------------|
| Replace CLI primitives | Use `@outfitter/cli` |
| Replace config loading | Use `@outfitter/config` |
| Replace index code | Use `@outfitter/index` |
| Add MCP server | Use `@outfitter/mcp` |

**Done criteria**: waymark tests pass with kit packages.

### 7.2 Firewatch Migration

| Step | Description |
|------|-------------|
| Replace CLI primitives | Use `@outfitter/cli` |
| Replace daemon code | Use `@outfitter/daemon` |
| Add config standardization | Use `@outfitter/config` |

**Done criteria**: firewatch tests pass with kit packages.

### 7.3 Migration Infrastructure

Ensure upgrade paths exist from the start:

| Component | Description |
|-----------|-------------|
| Version headers | Index/cache files include `OUTFITTER_*_V1` header |
| Config migration | Detect and upgrade config file versions |
| `MigrationRegistry` | Register migration functions between versions |

**Done criteria**:
- Index files include version header
- Config loader handles missing version field (default to v1)
- Migration registry API defined (even if no migrations yet)

### 7.4 Validation

| Validation | Criteria |
|------------|----------|
| Feature parity | Migrated repos have same behavior |
| Performance | No significant regression |
| Developer experience | `bun run dev` works, tests pass |
| Migration | Config/state files upgrade cleanly |

**Phase 7 complete when**: Two repos successfully migrated with version headers in place.

---

## Dependency Graph

```
Phase 0: Monorepo Foundation
    │
    ▼
Phase 1: @outfitter/cli (tracer bullet)
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
Phase 2a: @outfitter/contracts    Phase 2b: @outfitter/types
    │                                  │
    │ ←── cli refactors to use ────────┘
    │     contracts + types
    └──────────────┬───────────────────
                   │
    ┌──────────────┼──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼              ▼
Phase 3a:    Phase 3b:      Phase 3c:     Phase 3d:      Phase 3e:
config       logging        file-ops      state          ui
    │              │              │              │              │
    │ ←── cli refactors to use all Phase 3 packages ──────────┘
    └──────────────┴──────────────┴──────────────┴──────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
            Phase 4a: index               Phase 4b: mcp
                   │                             │
                   │         ┌───────────────────┘
                   │         ▼
                   │    Phase 6.3: @outfitter/testing
                   │         │
                   └─────────┼───────────────────┘
                             │
                             ▼
                    Phase 5: daemon (spec-driven)
                             │
                             ▼
                    Phase 6: outfitter CLI + tooling
                             │
                             ▼
                    Phase 7: migration + validation
```

**Note**: Arrows indicating "refactors" mean the cli package is updated to use the newly built packages. This validates the contracts work before other packages depend on them.

---

## Execution Notes

### Graphite Stack Strategy

Phase 1 established a Graphite stacked PR workflow for TDD-based package implementation. This pattern should be replicated for subsequent phases.

**Branch Naming Convention:**

| Phase | Branch Pattern | Purpose |
|-------|----------------|---------|
| RED | `<package>/<feature>-tests` | Failing tests that define the contract |
| GREEN | `<package>/<feature>-impl` | Implementation that makes tests pass |
| DOCS | `<package>/docs` | README, CHANGELOG, TSDoc |

**Phase 1 Stack Example:**

```
main
└── cli/scaffold          # Package structure, tsconfig, dependencies
    └── cli/harvest-map   # HARVEST_MAP.md documenting patterns found
        └── cli/output-tests   # RED: 38 failing output tests
            └── cli/output-impl    # GREEN: output.ts implementation
                └── cli/input-tests    # RED: 74 failing input tests
                    └── cli/input-impl     # GREEN: input.ts implementation
                        └── cli/pagination-tests  # RED: 22 failing pagination tests
                            └── cli/pagination-impl   # GREEN: pagination.ts implementation
                                └── cli/docs          # README.md, CHANGELOG.md
```

**Subagent Orchestration:**

| Phase | Agent | Purpose |
|-------|-------|---------|
| Planning | `Plan` | Research codebase, design test strategy, estimate scope |
| Harvest/Research | `analyst` | Create HARVEST_MAP.md, analyze patterns |
| RED (tests) | `senior-dev` | Write failing tests that define the contract |
| GREEN (impl) | `senior-dev` | Implement code to pass tests |
| Docs | `analyst` | Generate README.md, CHANGELOG.md |
| Review | `ranger` | Code review before merge (if needed) |

**Workflow Commands:**

```bash
# Create branch with staged changes
gt create 'cli/feature-tests' -am "test(cli): add feature tests"

# Amend current branch (within same branch)
gt modify -acm "test(cli): add edge case tests"

# Submit full stack
gt submit --stack --no-interactive

# Navigate stack
gt up / gt down / gt top / gt bottom
```

**TodoWrite Integration:**

Track agent delegations explicitly for context compaction resilience:

```
- [x] [analyst] cli/harvest-map - PR #3
- [x] [senior-dev] cli/output-tests - PR #4
- [x] [senior-dev] cli/output-impl - PR #5
- [ ] [ranger] Review full stack before merge
```

Include agent IDs for resumable sessions when iterating on complex implementations.

---

### Parallelization Opportunities

- **Phase 2a + 2b**: contracts and types can develop in parallel
- **Phase 3a-3e**: All five packages can develop in parallel after Phase 2
- **Phase 4a + 4b**: index and mcp can develop in parallel

### Agent Delegation

Each package is a self-contained unit suitable for agent delegation:

```
[senior-dev] Implement @outfitter/config
[ranger] Review @outfitter/config for security
[tester] Validate @outfitter/config end-to-end
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Harvest yields unexpected complexity | Time-box harvest phase (2 days for rich harvest, 3-4 days for spec-driven) |
| Foundation tier churn | Freeze contracts/types API before Phase 3 |
| Platform differences | Test on macOS first, Windows deferred |
| MCP spec changes | Pin @modelcontextprotocol/sdk version |
| Bun API instability | Pin Bun version in engines, document fallback packages |
| No daemon patterns to harvest | Allocate extra time for spec-driven Phase 5 |
| Pagination cursor not in existing repos | Build from spec, don't expect harvest help |

---

## Success Criteria

The kit is complete when:

1. **All packages published** to npm under `@outfitter/*`
2. **Two repos migrated** (waymark, firewatch) with tests passing
3. **`outfitter init`** scaffolds working projects
4. **Documentation complete** with examples and API reference
5. **CI/CD green** with full test coverage

---

## Open Questions (Deferred)

- Exact naming for cache/index CLI commands
- Multi-platform binary distribution strategy
- Cloudflare adapter scope
- Metrics/telemetry baseline
- Bulk operation patterns for MCP
