# Boundary and Command Conventions

Canonical conventions for command surfaces and package/app boundaries in the
Outfitter monorepo.

Use this document as the source of truth when introducing or migrating commands.

## Boundary Rules

### `packages/*` are library/runtime surfaces

- Export importable APIs.
- Avoid process entrypoint concerns (`process.argv`, `process.exit`, shebang
  scripts) unless shipping an explicit package bin.
- Do not require root scripts to execute `packages/*/src/*` directly.

### `apps/*` are runnable command hosts

- Own user-facing command orchestration.
- Wire package APIs into coherent command surfaces.
- Host canonical command entrypoints.

### Root scripts call canonical surfaces

From the monorepo root, call:

- App entrypoints (for monorepo workflows), or
- Package bins (for standalone package workflows).

Do not call package source files directly.

## Command Model

### User-facing verbs

These are the human-first verbs we standardize around for top-level workflows.

| Verb | Purpose | Status |
|------|---------|--------|
| `init` | Create or bootstrap a project | Implemented |
| `setup` | Opinionated setup wrapper for common defaults | Planned |
| `add` | Add capabilities or tooling blocks | Implemented |
| `check` | Validate project health and policy conformance | Implemented |
| `fix` | Apply safe automated fixes for checkable issues | Planned (`tooling fix` exists today) |
| `docs` | User-facing docs discovery/help | Planned (`OS-190`) |

Specialized commands such as `scaffold`, `update`, `doctor`, `migrate kit`, and
`demo` remain valid while the top-level model converges.

### Repository maintenance verbs

Repository maintenance operations are namespaced under:

```bash
outfitter repo check <subject>
outfitter repo sync <subject>
outfitter repo export <subject>
```

Current canonical subjects:

- `docs` (`check|sync|export`)
- `exports` (`check`)
- `readme` (`check`)
- `registry` (`check`)
- `changeset` (`check`)
- `tree` (`check`)
- `boundary-invocations` (`check`)

## Invocation Policy

### Approved patterns

```bash
# monorepo canonical
bun run apps/outfitter/src/cli.ts repo check readme --cwd .
bun run apps/outfitter/src/cli.ts repo check registry --cwd .
bun run apps/outfitter/src/cli.ts repo check tree --cwd .
bun run apps/outfitter/src/cli.ts repo sync docs --cwd .

# package bins (standalone)
bunx @outfitter/tooling check-exports
bunx @outfitter/docs docs sync
```

### Prohibited patterns

```bash
bun run packages/tooling/src/cli/index.ts check-readme-imports
cd packages/docs && bun src/cli.ts docs sync --cwd ../..
cd packages/docs-core && bun src/cli-sync.ts --cwd ../..
```

If you need one of these patterns for a temporary migration, add an explicit
issue and time-boxed removal plan.

## Migration Notes

### docs-core routing

- `@outfitter/docs-core` is library-only.
- Runnable docs command behavior is hosted by `@outfitter/docs`.
- Monorepo maintenance entrypoint is `outfitter repo <action> docs`.

### CLI demo ownership

- Demo command hosting moved to `apps/cli-demo`.
- `outfitter demo` remains a compatibility bridge to `outfitter-demo`.

### Tooling command shape

- Canonical monorepo checks use short subjects:
  - `repo check readme`
  - `repo check registry`
  - `repo check tree`

## CI and Hook Enforcement

`verify:ci` enforces boundary and command policy through:

- `check-exports`
- `check-readme-imports`
- `check-clean-tree`
- `check-boundary-invocations`

Pre-push runs the same sequence through `bunx @outfitter/tooling pre-push`.

### Remediation quick map

- `check-boundary-invocations` failed:
  Replace direct `packages/*/src/*` execution with `outfitter repo ...` or a
  package bin.
- `check-readme-imports` failed:
  Update imports to real exported subpaths or mark non-contractual blocks.
- `check-exports` failed:
  Rebuild exports and commit drifted `package.json#exports`.
- `check-clean-tree` failed:
  Commit generated artifacts or adjust build/check ordering if policy changed.

## `outfitter docs` Direction

Current state:

- `outfitter docs` is intentionally unused while docs maintenance flows
  remain under `outfitter repo ...`.

Intended state (`OS-190`):

- Plain `outfitter docs` becomes user-facing discovery/help.
- Repository maintenance docs operations stay under `outfitter repo ...`.
