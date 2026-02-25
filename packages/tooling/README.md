# @outfitter/tooling

Dev tooling configuration presets and CLI for Outfitter projects.

## Features

- **Configuration Presets**: oxlint, TypeScript, Lefthook, and markdownlint configs
- **CLI Commands**: Initialize configs, upgrade Bun, TDD-aware pre-push hooks
- **Registry System**: Composable config blocks for scaffolding

## Installation

```bash
bun add -D @outfitter/tooling
```

Peer dependencies (optional):

- `ultracite` — oxlint/oxfmt wrapper for formatting/linting
- `lefthook` — Git hooks
- `markdownlint-cli2` — Markdown linting

## CLI Commands

### `tooling init`

Initialize tooling configuration in the current project. Copies preset configs for oxlint, TypeScript, Lefthook, and markdownlint.

```bash
bunx @outfitter/tooling init
```

### `tooling check [paths...]`

Run linting checks (wraps ultracite).

```bash
bunx @outfitter/tooling check
bunx @outfitter/tooling check src/
```

### `tooling fix [paths...]`

Fix linting issues (wraps ultracite).

```bash
bunx @outfitter/tooling fix
bunx @outfitter/tooling fix src/
```

### `tooling upgrade-bun [version]`

Upgrade Bun version across the project. Updates:

- `.bun-version`
- `engines.bun` in all package.json files
- `@types/bun` dependency versions (leaves "latest" alone)
- `bun.lock`

```bash
# Upgrade to latest
bunx @outfitter/tooling upgrade-bun

# Upgrade to specific version
bunx @outfitter/tooling upgrade-bun 1.4.0

# Skip installing Bun and updating lockfile
bunx @outfitter/tooling upgrade-bun 1.4.0 --no-install
```

### `tooling pre-push`

TDD-aware pre-push strict verification hook. Detects RED phase branches and skips verification by design.

RED phase branches follow these patterns:

- `*-tests` (e.g., `feature/auth-tests`)
- `*/tests` (e.g., `feature/auth/tests`)
- `*_tests` (e.g., `feature/auth_tests`)

Verification order:

1. Run `verify:ci` if present.
2. Otherwise run strict fallback: `typecheck`, `check|lint`, `build`, `test`.

```bash
# Normal usage (in lefthook.yml)
bunx @outfitter/tooling pre-push

# Force skip verification
bunx @outfitter/tooling pre-push --force
```

### `tooling check-boundary-invocations`

Validate that root/app scripts do not execute `packages/*/src/*` directly.

```bash
bunx @outfitter/tooling check-boundary-invocations
```

When this fails, replace direct source execution with canonical command surfaces
(`outfitter repo ...` in monorepo scripts, or package bins for standalone use).

### `tooling check-bunup-registry`

Validate that packages using `bunup --filter` are registered in `bunup.config.ts`.

```bash
bunx @outfitter/tooling check-bunup-registry
```

### `tooling check-changeset`

Validate that PRs touching package source include a changeset.

```bash
bunx @outfitter/tooling check-changeset

# Skip the check (e.g. for non-package changes)
bunx @outfitter/tooling check-changeset --skip
```

### `tooling check-exports`

Validate that `package.json` exports match source entry points.

```bash
bunx @outfitter/tooling check-exports

# Machine-readable output
bunx @outfitter/tooling check-exports --json
```

### `tooling check-tsdoc`

Check TSDoc coverage on exported declarations.

```bash
bunx @outfitter/tooling check-tsdoc

# Check specific packages
bunx @outfitter/tooling check-tsdoc packages/cli packages/contracts

# Strict mode with coverage threshold
bunx @outfitter/tooling check-tsdoc --strict --min-coverage 80

# JSON output
bunx @outfitter/tooling check-tsdoc --json
```

### `tooling check-clean-tree`

Assert the working tree is clean (no modified or untracked files).

```bash
bunx @outfitter/tooling check-clean-tree

# Check specific paths only
bunx @outfitter/tooling check-clean-tree --paths packages/cli packages/contracts
```

### `tooling check-readme-imports`

Validate that README import examples match package exports.

```bash
bunx @outfitter/tooling check-readme-imports

# Machine-readable output
bunx @outfitter/tooling check-readme-imports --json
```

## Configuration Presets

### TypeScript

Extends our TypeScript config in your `tsconfig.json`:

```json
{
  "extends": "@outfitter/tooling/tsconfig.preset.json"
}
```

Or for Bun-specific projects:

```json
{
  "extends": "@outfitter/tooling/tsconfig.preset.bun.json"
}
```

### Lefthook

Extends our git hooks in your `.lefthook.yml`:

```yaml
extends:
  - node_modules/@outfitter/tooling/lefthook.yml
```

Default hooks:

- **pre-commit**: Runs ultracite on staged files, typechecks
- **pre-push**: Runs TDD-aware strict verification via `tooling pre-push`

### markdownlint

Copy or reference the config:

```bash
# Copy to project
cp node_modules/@outfitter/tooling/.markdownlint-cli2.jsonc .
```

## Registry System

The tooling package includes a registry of composable config blocks for the `outfitter` CLI scaffolding system.

Available blocks:

- `claude` — Claude Code settings and hooks
- `linter` — oxlint/Ultracite configuration
- `lefthook` — Git hooks configuration
- `markdownlint` — Markdown linting configuration
- `bootstrap` — Project bootstrap script
- `scaffolding` — Full starter kit (combines all above)

## Monorepo Command Mapping

Within this monorepo, maintenance checks are routed via `outfitter repo`:

```bash
bun run apps/outfitter/src/cli.ts repo check exports --cwd .
bun run apps/outfitter/src/cli.ts repo check readme --cwd .
bun run apps/outfitter/src/cli.ts repo check registry --cwd .
bun run apps/outfitter/src/cli.ts repo check tree --cwd .
bun run apps/outfitter/src/cli.ts repo check boundary-invocations --cwd .
```

## Exports

| Export                       | Description                            |
| ---------------------------- | -------------------------------------- |
| `./registry`                 | Tooling block registry API             |
| `./tsconfig`                 | Alias for `./tsconfig.preset.json`     |
| `./tsconfig-bun`             | Alias for `./tsconfig.preset.bun.json` |
| `./tsconfig.preset.json`     | TypeScript preset (general)            |
| `./tsconfig.preset.bun.json` | TypeScript preset (Bun)                |
| `./lefthook`                 | Alias for `./lefthook.yml`             |
| `./lefthook.yml`             | Lefthook hooks configuration           |
| `./.markdownlint-cli2`       | Alias for `./.markdownlint-cli2.jsonc` |
| `./.markdownlint-cli2.jsonc` | markdownlint configuration             |

## Related

- [@outfitter/contracts](../contracts/README.md) — Result types and error patterns
- [@outfitter/cli](../cli/README.md) — CLI framework

## License

MIT
