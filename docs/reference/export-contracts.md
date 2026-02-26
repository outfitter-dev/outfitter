# Export Contracts

Every `@outfitter/*` package defines its public API through `package.json#exports`. Bunup auto-generates this field from source files during build. Without constraints, any new `.ts` file in `src/` silently becomes public API.

This document covers the tooling that keeps export surfaces intentional.

## How It Works

The pipeline has five components:

1. **bunup** builds from source and auto-generates `package.json#exports`
2. **`exports.exclude`** in `bunup.config.ts` constrains what bunup publishes
3. **`outfitter repo check exports`** validates that source files and `package.json` are in sync
4. **`outfitter repo check readme`** validates that README examples reference real exports
5. **`outfitter repo check boundary-invocations`** validates root/apps scripts do not execute
   `packages/*/src/*` directly

### Export Exclusions

Each workspace entry in `bunup.config.ts` can declare patterns to exclude from the public surface:

```typescript
{
  name: "@outfitter/contracts",
  root: "packages/contracts",
  config: {
    exports: {
      exclude: ["./internal/*"],
    },
  },
}
```

Common exclusion patterns:

| Pattern        | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `./internal/*` | Internal utilities (types, contracts, outfitter CLI) |
| `./cli/*`      | CLI-only entrypoints not meant for library consumers |
| `./version`    | Auto-generated version modules                       |

## Verification Flow

CI now runs an explicit build step followed by `verify:ci`:

```
build -> verify:ci (outfitter check --ci)
```

`outfitter check --ci` orchestrates typecheck, lint/format checks, docs sentinel/link checks, export/readme/boundary checks, working-tree cleanliness, schema drift, and tests.

The CI test phase uses `bun run test:ci` (via `check --ci`) with explicit concurrency guardrails and diagnostics:

- `OUTFITTER_CI_TURBO_CONCURRENCY` (default `2`) controls Turbo task parallelism.
- `OUTFITTER_CI_BUN_MAX_CONCURRENCY` (default `4`) is passed to each package test command as Bun `--max-concurrency`.
- `scripts/ci-test-runner.ts` defaults `OUTFITTER_CI_TURBO_LOG_ORDER=stream` and `OUTFITTER_CI_TURBO_OUTPUT_LOGS=full` for crash forensics when rerunning locally.
- Routine PR/release workflows pin `OUTFITTER_CI_TURBO_OUTPUT_LOGS=errors-only` to reduce log volume while preserving failure signal.
- CI diagnostics are written to `.outfitter/reports/ci/`, and failure runs upload both those files and `.turbo/runs/*.json` as workflow artifacts.

This same pipeline runs locally via pre-push hook (`outfitter check --pre-push`) and in CI. Local and CI are always in parity for day-to-day PR verification.

Tracked llms artifacts (`docs/llms.txt`, `docs/llms-full.txt`) are refreshed and validated in the stable release workflow rather than in every PR CI run.

The key sequence for export integrity:

1. `outfitter repo check exports --cwd .` validates committed `package.json#exports` matches source (pre-build)
2. `outfitter repo check readme --cwd .` validates README examples reference real exports (pre-build)
3. `build` regenerates `package.json#exports` from source
4. `outfitter repo check tree --cwd .` fails if the build changed tracked files (stale exports)
5. `outfitter repo check boundary-invocations --cwd .` enforces command boundary policy
6. Tests confirm runtime behavior matches the declared surface

## Common Workflows

### Adding a New Public Export

1. Create the source file in `src/`
2. Run `bun run build` to regenerate exports
3. Verify: `bun run apps/outfitter/src/cli.ts repo check exports --cwd .`
4. Update the package README if documenting the new subpath

### Adding an Internal Module

1. Create the source file (e.g., `src/internal/helpers.ts`)
2. Add an exclusion pattern to `bunup.config.ts` if one does not already cover it (the `./internal/*` pattern handles most cases)
3. Run `bun run build && bun run apps/outfitter/src/cli.ts repo check exports --cwd .` to confirm it stays out of the public surface

### Fixing Export Drift

`outfitter repo check exports --cwd .` reports drift when `package.json#exports` does not match what bunup would generate.

1. Run `bun run build` to regenerate exports
2. If drift persists, check `bunup.config.ts` exclusions -- a new source file may need an explicit exclude
3. If `outfitter repo check tree --cwd .` fails in CI, the committed `package.json` was stale. Rebuild and commit the result

### Fixing README Import Drift

`outfitter repo check readme --cwd .` reports invalid imports when a README references a subpath that does not exist in the corresponding `package.json#exports`.

1. Fix the README to use a correct subpath, or add the missing export
2. To exempt a code block from validation, add a comment before it:

````markdown
<!-- non-contractual -->

```typescript
import { internal } from "@outfitter/contracts/internal/helpers";
```
````

## Commands Reference

Canonical monorepo invocation uses `outfitter repo check <subject>`:

```bash
bun run apps/outfitter/src/cli.ts repo check exports --cwd .
bun run apps/outfitter/src/cli.ts repo check readme --cwd .
bun run apps/outfitter/src/cli.ts repo check tree --cwd .
bun run apps/outfitter/src/cli.ts repo check boundary-invocations --cwd .
```

Standalone package-bin invocation via `@outfitter/tooling` remains supported:

```bash
bunx @outfitter/tooling check-exports
bunx @outfitter/tooling check-readme-imports
bunx @outfitter/tooling check-clean-tree
bunx @outfitter/tooling check-boundary-invocations
```

### check-exports

Validates that each package's `package.json#exports` matches what bunup would generate from source.

```bash
# Human-readable output
bunx @outfitter/tooling check-exports

# Machine-readable JSON
bunx @outfitter/tooling check-exports --json
```

Exit codes: `0` = all in sync, `1` = drift detected.

Drift output shows three categories:

- **`+` added** -- source file exists but `package.json` is missing the export
- **`-` removed** -- `package.json` has an export with no corresponding source
- **`~` changed** -- both exist but the export value differs

### check-clean-tree

Asserts the git working tree has no modified or untracked files. Runs after build in `verify:ci` to catch uncommitted export drift.

```bash
# Check entire tree
bunx @outfitter/tooling check-clean-tree

# Check specific paths only
bunx @outfitter/tooling check-clean-tree --paths packages/cli packages/contracts
```

Exit codes: `0` = clean, `1` = dirty files found.

### check-readme-imports

Validates that import examples in README files reference actually-exported subpaths. Scans `packages/*/README.md`.

```bash
# Human-readable output
bunx @outfitter/tooling check-readme-imports

# Machine-readable JSON
bunx @outfitter/tooling check-readme-imports --json
```

Exit codes: `0` = all valid, `1` = invalid imports found.

Import examples are contractual by default. To mark a code block as non-contractual, place `<!-- non-contractual -->` on the line before the opening fence.

### check-boundary-invocations

Validates that root/app scripts do not execute `packages/*/src/*` directly.

```bash
# Canonical monorepo command
bun run apps/outfitter/src/cli.ts repo check boundary-invocations --cwd .

# Package bin alternative
bunx @outfitter/tooling check-boundary-invocations
```

Exit codes: `0` = no violations, `1` = one or more boundary violations.

When this fails, replace direct source execution with canonical command
surfaces (`outfitter repo ...` or package bins).

## Agent Guidance

Agents running check/fix loops should follow this sequence:

```
repo check exports -> build (if drift) -> repo check tree -> repo check readme
-> repo check boundary-invocations
```

- Use `--json` for machine-parseable output
- Non-zero exit codes signal failures -- do not continue past a failure
- After fixing drift, always re-run the full sequence to confirm convergence

## Related Documentation

- [Architecture](../ARCHITECTURE.md) -- Package tiers and dependency graph
- [Patterns](./patterns.md) -- Handler contract, Result types
