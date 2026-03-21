# AGENTS.md

Bun-first TypeScript monorepo. Tests before code. Result types, not exceptions.

Start here before making changes.

## Project Overview

Outfitter provides shared infrastructure for AI-agent-ready tooling: CLI, MCP servers, daemons, and indexing. The `outfitter` CLI scaffolds new projects.

**Core idea**: Handlers are pure functions returning `Result<T, E>`. CLI and MCP are thin adapters over the same logic. Write the handler once, expose it everywhere.

**Linear Team**: Stack (`OS`)

## Project Structure

- `apps/` — Runnable applications; `apps/outfitter/` is the CLI
- `packages/` — Versioned libraries (`@outfitter/*`) with source in `src/`; `packages/presets/` holds scaffold presets
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
bun run check                              # Lint + format check
bun run format:check                       # Format check only
bun run format:fix                         # Auto-fix formatting
bun run typecheck                          # TypeScript validation

# Release
bun run changeset                          # Add changeset
bun run version-packages                   # Bump versions
bun run release                            # Build + publish

# Maintenance
bun run clean                              # Clear Turbo artifacts and node_modules

# Upgrade Bun
bunx @outfitter/tooling upgrade-bun        # Upgrade to latest
bunx @outfitter/tooling upgrade-bun x.y.z  # Upgrade to specific version
```

**Bun Version:** Pinned in `.bun-version`. CI reads from this file to ensure consistency. When upgrading:

1. Run `bunx @outfitter/tooling upgrade-bun <version>`
2. Command updates `.bun-version`, `engines.bun`, `@types/bun`, installs locally, and updates `bun.lock`
3. Commit all files together

### CI Jobs

CI runs 8 jobs total: a shared build job, followed by 6 parallel jobs and a summary:

| Job               | Purpose                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `build`           | Populates Turbo remote cache                                                     |
| `lint-typecheck`  | Typecheck + oxlint + export checks                                               |
| `checks`          | 15 validation steps (block-drift, changeset, schema drift, shard coverage, etc.) |
| `test-foundation` | Tests: contracts, types, config, state, file-ops, presets                        |
| `test-runtime`    | Tests: cli, mcp, tui, logging, index, daemon, schema                             |
| `test-tooling`    | Tests: tooling, oxlint-plugin, docs, testing                                     |
| `test-app`        | Tests: outfitter, outfitter-cli-demo, reference                                  |
| `ci-summary`      | Aggregates results, fails if any job failed or was cancelled                     |

Test shards use `OUTFITTER_CI_TEST_FILTER` (comma-separated package names) and `OUTFITTER_CI_TEST_SHARD` (label) env vars. OOM retry (3 attempts, exit 137) is on test jobs only. Shard coverage is validated in the `checks` job — every testable package must appear in exactly one shard.

Local `outfitter check --ci` and `bun run verify:ci` still work unchanged for local validation. CI runs steps directly instead of through the orchestrator for per-step failure visibility.

## Architecture

### Package Tiers (dependency flow: Foundation → Runtime → Tooling)

**Foundation (Stable)** — Rarely change:

- `@outfitter/contracts` — Result/Error patterns, error taxonomy (10 categories → exit/HTTP codes)
- `@outfitter/types` — Branded types, type utilities

**Runtime (Active)** — Evolving based on usage:

- `@outfitter/cli` — Typed Commander wrapper with CommandBuilder, output envelopes, streaming, truncation, [flag conventions](./docs/cli/conventions.md)
- `@outfitter/mcp` — MCP server framework with typed tools, resources, resource templates, and action registry
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

**Subcommand grouping**: Setting `cli.group` on an action spec causes `buildCliCommands` to automatically group actions into nested subcommands. Actions sharing the same `cli.group` value (e.g. `"check"`) are collected under a parent command, with each action's `cli.command` becoming a subcommand. This is the action-registry equivalent of `commandGroup()` in the CommandBuilder pattern — you get the same `mycli check tsdoc` nesting without manually wiring parent/child commands.

**Introspection**: `outfitter schema` shows all registered actions. `outfitter schema <action-id> --output json` returns the full schema including input/output shapes.

**Surface maps**: `outfitter schema generate` writes `.outfitter/surface.json` for drift detection. `outfitter schema diff` compares committed surface map against runtime, exiting non-zero on drift. The committed source of truth is root `.outfitter/surface.json` only; do not commit `apps/outfitter/.outfitter/surface.json`. Surface map formatting is also enforced via `outfitter check surface-map-format`.

#### Adding a New CLI Command

1. Define the handler in `apps/outfitter/src/commands/<name>.ts` — pure function returning `Result<T, E>`
2. Define and export the action from the appropriate `apps/outfitter/src/actions/<domain>.ts` module using `defineAction()` with input/output Zod schemas
3. Wire the action into `apps/outfitter/src/actions.ts` so it is included in the shared `ActionRegistry`
4. Build the command with the CommandBuilder pattern (see below) — use `.input()` for Zod-driven flags, `.preset()` for flag presets, and `.destructive()` / `.readOnly()` / `.idempotent()` for safety metadata
5. Use flag presets from `@outfitter/cli/query` (`outputModePreset`, `jqPreset`, `streamPreset`) and `@outfitter/cli/flags` (`cwdPreset`, `dryRunPreset`)
6. Add tests in `apps/outfitter/src/__tests__/<name>.test.ts` — at minimum test action registration and `mapInput`
7. Run `outfitter schema generate` to update `.outfitter/surface.json`
8. Verify with `outfitter schema diff` (should report no drift after regeneration)

#### `onResult` Callback and `defaultOnResult`

When using `buildCliCommands` to wire an action registry into CLI commands, handler return values are **silently discarded** by default — only errors are thrown. This is a common footgun: the handler runs successfully but nothing is printed.

The `onResult` option lets you intercept every handler result (success or failure). The `defaultOnResult` convenience export is the "batteries included" option — it resolves the output mode from CLI flags (`--output`, `--json`, `--jsonl`) and calls `output()` automatically.

```typescript
import { buildCliCommands, defaultOnResult } from "@outfitter/cli/actions";

// Minimal — auto-outputs all handler results
const commands = buildCliCommands(registry, {
  onResult: defaultOnResult,
});
import { createContext } from "@outfitter/contracts";

// With custom context factory (recommended for real apps)
const commands = buildCliCommands(registry, {
  onResult: defaultOnResult,
  createContext: ({ action }) => {
    const requestId = generateRequestId();
    return createContext({
      cwd: process.cwd(),
      env: process.env,
      requestId,
      logger: logger.child({ action: action.id, requestId }),
    });
  },
});
```

**What `defaultOnResult` does**: On success, it calls `resolveOutputMode(flags)` to determine the format (text, JSON, JSONL) from CLI flags, then pipes the value through `output()`. On error, it throws — letting the program's error handler produce the appropriate exit code.

**Custom `onResult`**: For more control (e.g., logging, metrics, or custom formatting), pass your own callback. The `ActionResultContext` includes the action spec, args, flags, validated input, and the `Result`:

```typescript
import type { ActionResultContext } from "@outfitter/cli/actions";

async function myOnResult(ctx: ActionResultContext): Promise<void> {
  if (ctx.result.isErr()) {
    logger.error("Action failed", { action: ctx.action.id, error: ctx.result.error });
    throw ctx.result.error;
  }
  logger.info("Action succeeded", { action: ctx.action.id });
  const { mode } = resolveOutputMode(ctx.flags);
  await output(ctx.result.value, mode);
}
```

### CommandBuilder (v0.6)

The `command()` builder from `@outfitter/cli/command` is the recommended way to define CLI commands. It provides a fluent API for typed flags, input validation, context factories, hint generation, and safety metadata.

```typescript
import { command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";

command("deploy <env>")
  .description("Deploy to environment")
  .input(z.object({ env: z.string(), force: z.boolean().default(false) }))
  .context((input) => loadDeployConfig(input.env))
  .destructive(true) // auto-adds --dry-run
  .relatedTo("status", { description: "Check status" })
  .hints((result, input) => [
    { description: "View logs", command: `logs --env ${input.env}` },
  ])
  .onError((err, input) => [
    { description: "Rollback", command: `rollback --env ${input.env}` },
  ])
  .action(async ({ flags, input, ctx }) => {
    // handler body
  })
  .build();
```

**Builder methods:**

| Method                     | Purpose                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `.input(schema)`           | Zod schema for validated input; auto-derives `--flags` from schema fields                   |
| `.context(factory)`        | Async factory called after validation; result passed as `ctx` to action                     |
| `.preset(preset)`          | Attach a flag preset (`outputModePreset()`, `cwdPreset()`, `streamPreset()`, etc.)          |
| `.hints(fn)`               | Success hint function `(result, input) => CLIHint[]` for the success envelope               |
| `.onError(fn)`             | Error hint function `(error, input) => CLIHint[]` for the error envelope                    |
| `.destructive(true)`       | Auto-adds `--dry-run` flag; `runHandler({ dryRun })` generates execute-without-dry-run hint |
| `.readOnly(true)`          | Marks command as non-mutating; surfaces in command tree and MCP `readOnlyHint`              |
| `.idempotent(true)`        | Marks command as idempotent; surfaces in command tree and MCP `idempotentHint`              |
| `.relatedTo(target, opts)` | Declares relationship to another command for action graph hints                             |
| `.subcommand(builder)`     | Register a nested subcommand under this command                                             |

### Nested Commands

Use `.subcommand()` for fluent nesting or `commandGroup()` for declarative groups:

```typescript
import { command, commandGroup } from "@outfitter/cli/command";

// Fluent
program.register(
  command("entity")
    .description("Manage entities")
    .subcommand(command("add").description("Add").action(handler))
    .subcommand(command("show").description("Show").action(handler))
);

// Declarative
program.register(
  commandGroup("entity", "Manage entities", [
    command("add").description("Add").action(handler),
    command("show").description("Show").action(handler),
  ])
);
```

### Streaming

Handlers emit real-time progress via `ctx.progress` (an optional `ProgressCallback`). The CLI adapter writes events as NDJSON lines; the MCP adapter translates them to `notifications/progress`.

```typescript
const handler: Handler<Input, Output> = async (input, ctx) => {
  ctx.progress?.({
    type: "start",
    command: "process",
    ts: new Date().toISOString(),
  });
  for (let i = 0; i < items.length; i++) {
    await processItem(items[i]);
    ctx.progress?.({ type: "progress", current: i + 1, total: items.length });
  }
  return Result.ok({ processed: items.length });
};
```

- **CLI**: Add `stream: Boolean(flags.stream)` to `runHandler()`. Use `streamPreset()` from `@outfitter/cli/query` for the `--stream` flag.
- **MCP**: Automatic when client provides a `progressToken` — `ctx.progress` is injected by `createMcpProgressCallback()` from `@outfitter/mcp/progress`.
- **Types**: Import `StreamEvent`, `ProgressCallback` from `@outfitter/contracts/stream`.

### Output Envelopes and Hint Tiers

All CLI output goes through `runHandler()` from `@outfitter/cli/envelope`, which wraps results in a `CommandEnvelope`:

- **Success**: `{ ok: true, command, result, hints? }`
- **Error**: `{ ok: false, command, error: { category, message, retryable, retry_after? }, hints? }`

Error envelopes include `retryable` (derived from error category) and `retry_after` (from `RateLimitError`). Agents check these instead of maintaining category-to-retryability mappings.

**Hint tiers** (accumulated in order):

| Tier | Source         | Generator                                   | Description                         |
| ---- | -------------- | ------------------------------------------- | ----------------------------------- |
| 1    | Command tree   | `commandTreeHints()`                        | "What can I do?"                    |
| 2    | Error category | `errorRecoveryHints()`                      | Standard recovery actions           |
| 3    | Zod schema     | `schemaHintParams()`                        | Parameter shapes for agents         |
| 4    | Action graph   | `graphSuccessHints()` / `graphErrorHints()` | Related commands via `.relatedTo()` |

### Output Truncation

Array output can be truncated with pagination hints using `truncateOutput()` from `@outfitter/cli/truncation`:

```typescript
import { truncateOutput } from "@outfitter/cli/truncation";

const truncated = truncateOutput(items, {
  limit: 20,
  offset: 0,
  commandName: "list",
});
// truncated.data — sliced items
// truncated.metadata — { showing, total, truncated: true } when above limit
// truncated.hints — CLIHint[] for pagination continuation
```

When total exceeds `filePointerThreshold` (default 1000), the full result is written to a temp file and `metadata.full_output` contains the path.

### MCP Resources and Templates

`@outfitter/mcp` provides `defineResource()` and `defineResourceTemplate()` for declaring MCP resources alongside tools:

```typescript
import { defineResource, defineResourceTemplate } from "@outfitter/mcp/server";

const configResource = defineResource({
  uri: "file:///etc/app/config.json",
  name: "Application Config",
  handler: async () => ({ text: JSON.stringify(config) }),
});

const userTemplate = defineResourceTemplate({
  uriTemplate: "db:///users/{userId}",
  name: "User",
  schema: z.object({ userId: z.string() }),
  handler: async ({ userId }) => ({
    text: JSON.stringify(await getUser(userId)),
  }),
});
```

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

| Concern           | Package                     |
| ----------------- | --------------------------- |
| Result type       | `better-result`             |
| Schema validation | `zod`                       |
| CLI parsing       | `commander`                 |
| Logging           | `@logtape/logtape`          |
| MCP protocol      | `@modelcontextprotocol/sdk` |
| Prompts           | `@clack/prompts`            |

Versions are managed via Bun workspace catalogs in the root `package.json`. Check there for current pins.

## Code Style

### TypeScript

Strict mode with additional safety flags:

- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`

Keep types explicit; avoid `any`. Prefer module-local organization over central registries.

### Formatting (oxfmt)

- Use oxfmt/Ultracite for formatting and oxlint for lint checks

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

```text
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
- **pre-push**: Full repository verification via `outfitter check --pre-push`, plus block and schema drift checks
  - Block drift (`outfitter check`) fails the push if local config files diverge from the registry (see [block-drift.md](./docs/reference/block-drift.md))
  - Schema drift (`outfitter schema diff`) fails the push if `.outfitter/surface.json` is stale
  - Docs README sentinel drift (`outfitter check docs-sentinel`) fails the push if `docs/README.md` generated sections are stale
- **pre-submit (stacked branches)**: Run `bun run verify:stack` before `gt submit` or `gt stack submit` to catch schema drift before it propagates through a stack. See [Stacked PR Workflow](./docs/ci-cd/stacked-pr-workflow.md).

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
- [docs/reference/result-api.md](./docs/reference/result-api.md) — Result type API reference
- [docs/reference/result-cookbook.md](./docs/reference/result-cookbook.md) — Result pattern recipes
- [docs/reference/export-contracts.md](./docs/reference/export-contracts.md) — Package export contracts
- [docs/reference/discoverability.md](./docs/reference/discoverability.md) — CLI discoverability and self-documentation
- [docs/reference/block-drift.md](./docs/reference/block-drift.md) — Block drift detection
- [docs/reference/tui-stacks.md](./docs/reference/tui-stacks.md) — TUI rendering stack reference
- [docs/reference/outfitter-directory.md](./docs/reference/outfitter-directory.md) — `.outfitter/` directory conventions
- [docs/cli/conventions.md](./docs/cli/conventions.md) — CLI flag presets, verb conventions, queryability
- [docs/getting-started.md](./docs/getting-started.md) — Tutorials
- [docs/migration-v0.5.md](./docs/migration-v0.5.md) — v0.5 migration guide
- [docs/migration-v0.6.md](./docs/migration-v0.6.md) — v0.6 migration guide (streaming, safety, completeness)
