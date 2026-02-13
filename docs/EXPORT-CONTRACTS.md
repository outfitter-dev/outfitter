# Export Contracts

Every `@outfitter/*` package defines its public API through `package.json#exports`. Bunup auto-generates this field from source files during build. Without constraints, any new `.ts` file in `src/` silently becomes public API.

This document covers the tooling that keeps export surfaces intentional.

## How It Works

The pipeline has four components:

1. **bunup** builds from source and auto-generates `package.json#exports`
2. **`exports.exclude`** in `bunup.config.ts` constrains what bunup publishes
3. **`check-exports`** validates that source files and `package.json` are in sync
4. **`check-readme-imports`** validates that README examples reference real exports

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

| Pattern | Purpose |
|---------|---------|
| `./internal/*` | Internal utilities (types, contracts, outfitter CLI) |
| `./cli/*` | CLI-only entrypoints not meant for library consumers |
| `./version` | Auto-generated version modules |

## Verification Flow

The `verify:ci` script runs the full pipeline:

```
typecheck -> check -> docs:check:ci -> check-exports -> check-readme-imports -> build -> check-clean-tree -> test
```

This same pipeline runs locally via pre-push hook (`bunx @outfitter/tooling pre-push`) and in CI. Local and CI are always in parity.

The key sequence for export integrity:

1. `check-exports` validates committed `package.json#exports` matches source (pre-build)
2. `check-readme-imports` validates README examples reference real exports (pre-build)
3. `build` regenerates `package.json#exports` from source
4. `check-clean-tree` fails if the build changed any tracked files (stale exports)
5. Tests confirm runtime behavior matches the declared surface

## Common Workflows

### Adding a New Public Export

1. Create the source file in `src/`
2. Run `bun run build` to regenerate exports
3. Verify: `bunx @outfitter/tooling check-exports`
4. Update the package README if documenting the new subpath

### Adding an Internal Module

1. Create the source file (e.g., `src/internal/helpers.ts`)
2. Add an exclusion pattern to `bunup.config.ts` if one does not already cover it (the `./internal/*` pattern handles most cases)
3. Run `bun run build && bunx @outfitter/tooling check-exports` to confirm it stays out of the public surface

### Fixing Export Drift

`check-exports` reports drift when `package.json#exports` does not match what bunup would generate.

1. Run `bun run build` to regenerate exports
2. If drift persists, check `bunup.config.ts` exclusions -- a new source file may need an explicit exclude
3. If `check-clean-tree` fails in CI, the committed `package.json` was stale. Rebuild and commit the result

### Fixing README Import Drift

`check-readme-imports` reports invalid imports when a README references a subpath that does not exist in the corresponding `package.json#exports`.

1. Fix the README to use a correct subpath, or add the missing export
2. To exempt a code block from validation, add a comment before it:

````markdown
<!-- non-contractual -->
```typescript
import { internal } from "@outfitter/contracts/internal/helpers";
```
````

## Commands Reference

All commands live in `@outfitter/tooling` and run from the repo root.

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

Validates that import examples in README files reference actually-exported subpaths. Scans `packages/*/README.md` and `docs/packages/*/README.md`.

```bash
# Human-readable output
bunx @outfitter/tooling check-readme-imports

# Machine-readable JSON
bunx @outfitter/tooling check-readme-imports --json
```

Exit codes: `0` = all valid, `1` = invalid imports found.

Import examples are contractual by default. To mark a code block as non-contractual, place `<!-- non-contractual -->` on the line before the opening fence.

## Agent Guidance

Agents running check/fix loops should follow this sequence:

```
check-exports -> build (if drift) -> check-clean-tree -> check-readme-imports
```

- Use `--json` for machine-parseable output
- Non-zero exit codes signal failures -- do not continue past a failure
- After fixing drift, always re-run the full sequence to confirm convergence

## Related Documentation

- [Architecture](./ARCHITECTURE.md) -- Package tiers and dependency graph
- [Patterns](./PATTERNS.md) -- Handler contract, Result types
