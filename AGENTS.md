# AGENTS.md

Bun-first TypeScript monorepo. Tests before code. Result types, not exceptions.

Start here before making changes.

## Project Overview

Outfitter provides shared infrastructure for AI-agent-ready tooling: CLI, MCP servers, daemons, and indexing. The `outfitter` CLI scaffolds new projects.

**Core idea**: Handlers are pure functions returning `Result<T, E>`. CLI and MCP are thin adapters over the same logic. Write the handler once, expose it everywhere.

**Status**: v0.1.0-rc.1 (release candidate) · **Linear Team**: Stack (`OS`)

## Project Structure

- `apps/` — Runnable applications; `apps/outfitter/` is the CLI
- `packages/` — Versioned libraries (`@outfitter/*`) with source in `src/`; `packages/presets/` holds scaffold presets
- `templates/` — Legacy shared templates (canonical location: `packages/presets/presets/`)
- `docs/` — Specs and plan documents

Tests live alongside code in `src/__tests__/` with `*.test.ts` files; snapshots use `__snapshots__/` with `.snap` format.

## Commands

```bash
# Build
bun run build                              # All packages (Turbo + bunup)
bun run build --filter=@outfitter/cli      # Single package

# Test
bun run test                               # All packages
bun run test --filter=@outfitter/contracts # Single package
cd packages/contracts && bun test          # Direct invocation

# Lint/Format
bun run lint                               # Lint checks
bun run check                              # Lint + format checks
bun run format:check                       # Format checks
bun run format:fix                         # Apply formatting fixes
bun run typecheck                          # TypeScript validation

# Release
bun run changeset                          # Add changeset
bun run version-packages                   # Bump versions
bun run release                            # Build + publish

# Maintenance
bun run clean                              # Clear Turbo artifacts and node_modules

# Upgrade Bun
bunx @outfitter/tooling upgrade-bun 1.4.0  # Upgrade to specific version
bunx @outfitter/tooling upgrade-bun        # Upgrade to latest
```

**Bun Version:** Pinned in `.bun-version`. CI reads from this file to ensure consistency. When upgrading:

1. Run `bunx @outfitter/tooling upgrade-bun <version>`
2. Command updates `.bun-version`, `engines.bun`, `@types/bun`, installs locally, and updates `bun.lock`
3. Commit all files together

## Architecture

### Package Tiers (dependency flow: Foundation → Runtime → Tooling)

**Foundation (Stable)** — Rarely change:

- `@outfitter/contracts` — Result/Error patterns, error taxonomy (10 categories → exit/HTTP codes)
- `@outfitter/types` — Branded types, type utilities

**Runtime (Active)** — Evolving based on usage:

- `@outfitter/cli` — Typed Commander wrapper with output contract, terminal rendering, colors, [flag conventions](./docs/cli/conventions.md)
- `@outfitter/mcp` — MCP server framework with typed tools and action registry
- `@outfitter/config` — XDG-compliant config loading with Zod validation
- `@outfitter/logging` — Structured logging via logtape
- `@outfitter/file-ops` — Workspace detection, path security, locking
- `@outfitter/state` — Pagination state, cursor persistence
- `@outfitter/index` — SQLite FTS5 with WAL
- `@outfitter/daemon` — Daemon lifecycle, IPC, health checks
- `@outfitter/schema` — Schema introspection, surface maps, drift detection
- `@outfitter/tui` — Terminal UI rendering (tables, lists, boxes, trees, spinners, themes, prompts, streaming)

**Tooling (Early)** — APIs will change:

- `outfitter` — Umbrella CLI for scaffolding
- `@outfitter/presets` — Scaffold presets and shared dependency versions (catalog-resolved)
- `@outfitter/docs` — Docs CLI, core assembly primitives, freshness checks, and host adapter
- `@outfitter/tooling` — Dev tooling presets and CLI workflows (oxlint, typescript, lefthook, markdownlint)
- `@outfitter/testing` — Test harnesses for MCP and CLI

**Deprecated**:

- `@outfitter/agents` — Deprecated. Use `npx outfitter add scaffolding` instead

### Handler Contract

All domain logic uses transport-agnostic handlers returning `Result<T, E>`:

```typescript
type Handler<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> = (input: TInput, ctx: HandlerContext) => Promise<Result<TOutput, TError>>;
```

CLI and MCP are thin adapters over shared handlers. Handlers know nothing about output format or transport.

### Action Registry

Actions are the canonical unit of CLI and MCP functionality. Each action is defined via `defineAction()` with Zod schemas for input/output, CLI option declarations, and a handler function.

**Where actions live**: Action definitions live in `apps/outfitter/src/actions/*.ts` (grouped by domain), while `apps/outfitter/src/actions.ts` composes and exports the single `ActionRegistry`.

**What an action provides**:

| Field          | Purpose                                    |
| -------------- | ------------------------------------------ |
| `id`           | Unique identifier (e.g. `check.tsdoc`)     |
| `surfaces`     | Where the action is exposed (`cli`, `mcp`) |
| `input`        | Zod schema for validated input             |
| `output`       | Zod schema for output shape                |
| `cli.group`    | CLI group command (e.g. `check`)           |
| `cli.command`  | Subcommand name (e.g. `tsdoc`)             |
| `cli.options`  | Flag definitions                           |
| `cli.mapInput` | Maps CLI args/flags to handler input       |
| `handler`      | Pure function returning `Result<T, E>`     |

**Introspection**: `outfitter schema` shows all registered actions. `outfitter schema <action-id> --output json` returns the full schema including input/output shapes.

**Surface maps**: `outfitter schema generate` writes `.outfitter/surface.json` for drift detection. `outfitter schema diff` compares committed surface map against runtime, exiting non-zero on drift. The committed source of truth is root `.outfitter/surface.json` only; do not commit `apps/outfitter/.outfitter/surface.json`. Surface map formatting is also enforced via `outfitter check surface-map-format`.

#### Adding a New CLI Command

1. Define the handler in `apps/outfitter/src/commands/<name>.ts` — pure function returning `Result<T, E>`
2. Define and export the action from the appropriate `apps/outfitter/src/actions/<domain>.ts` module using `defineAction()` with input/output Zod schemas
3. Wire the action into `apps/outfitter/src/actions.ts` so it is included in the shared `ActionRegistry`
4. Use flag presets from `@outfitter/cli/query` (`outputModePreset`, `jqPreset`) and `@outfitter/cli/flags` (`cwdPreset`, `dryRunPreset`)
5. Add tests in `apps/outfitter/src/__tests__/<name>.test.ts` — at minimum test action registration and `mapInput`
6. Run `outfitter schema generate` to update `.outfitter/surface.json`
7. Verify with `outfitter schema diff` (should report no drift after regeneration)

### Error Taxonomy

10 error categories with mapped exit codes and HTTP status:

| Category   | Exit | HTTP |
| ---------- | ---- | ---- |
| validation | 1    | 400  |
| not_found  | 2    | 404  |
| conflict   | 3    | 409  |
| permission | 4    | 403  |
| timeout    | 5    | 504  |
| rate_limit | 6    | 429  |
| network    | 7    | 502  |
| internal   | 8    | 500  |
| auth       | 9    | 401  |
| cancelled  | 130  | 499  |

## Environment Configuration

### Profiles

Set `OUTFITTER_ENV` to configure default behavior across all packages. Defaults to `"production"` when unset or invalid.

| Setting     | `development` | `production` | `test`   |
| ----------- | ------------- | ------------ | -------- |
| logLevel    | `"debug"`     | `null`       | `null`   |
| verbose     | `true`        | `false`      | `false`  |
| errorDetail | `"full"`      | `"message"`  | `"full"` |

- `logLevel: null` means no logging by default (MCP won't forward, logging falls through to `"info"`)
- `errorDetail: "full"` includes stack traces; `"message"` shows only the error message

### Environment Variables

| Variable              | Purpose                           | Values                                        |
| --------------------- | --------------------------------- | --------------------------------------------- |
| `OUTFITTER_ENV`       | Environment profile               | `development`, `production`, `test`           |
| `OUTFITTER_LOG_LEVEL` | Override log level (all packages) | `debug`, `info`, `warning`, `error`, `silent` |
| `OUTFITTER_VERBOSE`   | Override CLI verbosity            | `0`, `1`                                      |
| `OUTFITTER_JSON`      | Force JSON output                 | `0`, `1`                                      |
| `OUTFITTER_JSONL`     | Force JSONL output                | `0`, `1`                                      |

### Precedence

Each package resolves settings with the same precedence chain (highest wins):

```
OUTFITTER_LOG_LEVEL / OUTFITTER_VERBOSE    ← env var override
          ↓
    explicit option                         ← function parameter / CLI flag
          ↓
    environment profile                     ← OUTFITTER_ENV defaults
          ↓
    package default                         ← "info" / false / null
```

## Development Principles

### Non-Negotiable

**TDD-First** — Write the test before the code. Always.

1. **Red**: Write failing test that defines behavior
2. **Green**: Minimal code to pass
3. **Refactor**: Improve while green

**Result Types** — Handlers return `Result<T, E>`, not exceptions. See [Patterns](./docs/reference/patterns.md).

### Strong Preferences

**Bun-First** — Use Bun-native APIs before npm packages:

- `Bun.hash()`, `Bun.Glob`, `Bun.semver`, `Bun.$`
- `Bun.color()`, `Bun.stringWidth()`, `Bun.stripANSI()`
- `bun:sqlite` for SQLite with FTS5
- `Bun.randomUUIDv7()` for time-sortable request IDs

### Blessed Dependencies

| Concern           | Package                                 |
| ----------------- | --------------------------------------- |
| Result type       | `better-result` (`^2.5.1`)              |
| Schema validation | `zod` (`^4.3.5`)                        |
| CLI parsing       | `commander` (`^14.0.2`)                 |
| Logging           | `@logtape/logtape` (`^2.0.0`)           |
| MCP protocol      | `@modelcontextprotocol/sdk` (`^1.12.1`) |
| Prompts           | `@clack/prompts`                        |

## Code Style

### TypeScript

Strict mode with additional safety flags:

- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`

Keep types explicit; avoid `any`. Prefer module-local organization over central registries.

### Formatting (oxfmt)

- Use oxfmt/Ultracite for formatting and oxlint for lint checks
- Prefer repo-provided scripts (`bun run check`, `bun run format:fix`) over ad hoc formatter invocations

## Testing

- Primary runner: Bun's test runner
- Test files: `src/__tests__/*.test.ts`
- Snapshots: `__snapshots__/*.snap`
- Run focused tests from a package (`bun test`) or full suite from root (`bun run test`)

### Package Deep Docs

Packages can include additional documentation in `packages/<pkg>/docs/`:

- These files are collected alongside the package README by the docs pipeline
- Discoverable via `outfitter docs list` and `outfitter docs show <id>`
- Use for guides, references, or architectural docs specific to a package
- File naming: lowercase-kebab-case (e.g., `output-modes.md`, `error-taxonomy.md`)

## Git Workflow

### Branch Naming

Short and descriptive: `feature/<area>/<slug>` or `fix/<area>/<slug>`

### Commits

Conventional Commits with scopes:

```
feat(outfitter): add action registry
fix(cli): handle missing config gracefully
```

### Pull Requests

- Include clear summary and tests run
- Document user-visible changes
- Use short-lived branches off `main`
- Open PRs early, squash-merge once checks pass

### Git Hooks (Lefthook)

- **pre-commit**: Format, lint, typecheck (affected packages)
- **pre-push**: Build + TDD-aware test suite via `bunx @outfitter/tooling pre-push`, plus schema drift check
  - Allows RED phase branches (`*-tests`, `*/tests`, `*_tests`) to skip tests
  - Use `--force` to skip tests on any branch
  - Schema drift (`outfitter schema diff`) fails the push if `.outfitter/surface.json` is stale
  - Docs README sentinel drift (`outfitter check docs-sentinel`) fails the push if `docs/README.md` generated sections are stale

### Changesets

Add a changeset when your PR includes releasable changes:

```bash
bun changeset
```

After merge, canary versions publish automatically to `@canary`. Stable releases are triggered manually via **Actions > Release > Run workflow**, which opens a release PR — merging it publishes `@latest`.

Stable release prepare also refreshes tracked llms artifacts (`docs/llms.txt`, `docs/llms-full.txt`). PR CI checks package docs freshness; llms freshness is enforced in the release workflow.

For PRs that don't need a release (docs, CI, tests), add the `release:none` label.

See [docs/RELEASES.md](./docs/RELEASES.md) for the full process.

## Key Files

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — How packages fit together
- [docs/RELEASES.md](./docs/RELEASES.md) — Changesets, canary publishing, stable release workflow
- [docs/reference/patterns.md](./docs/reference/patterns.md) — Handler contract, Result types, error taxonomy
- [docs/cli/conventions.md](./docs/cli/conventions.md) — CLI flag presets, verb conventions, queryability
- [docs/getting-started.md](./docs/getting-started.md) — Tutorials
- [docs/reference/outfitter-directory.md](./docs/reference/outfitter-directory.md) — `.outfitter/` directory conventions
