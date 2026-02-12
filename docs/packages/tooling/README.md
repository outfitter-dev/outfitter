# @outfitter/tooling

Dev tooling configuration presets and CLI for Outfitter projects.

## Features

- **Configuration Presets**: Biome, TypeScript, Lefthook, and markdownlint configs
- **CLI Commands**: Initialize configs, upgrade Bun, TDD-aware pre-push hooks
- **Registry System**: Composable config blocks for scaffolding

## Installation

```bash
bun add -D @outfitter/tooling
```

Peer dependencies (optional):
- `ultracite` — Biome wrapper for formatting/linting
- `lefthook` — Git hooks
- `markdownlint-cli2` — Markdown linting

## CLI Commands

### `tooling init`

Initialize tooling configuration in the current project. Copies preset configs for Biome, TypeScript, Lefthook, and markdownlint.

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

## Configuration Presets

### Biome

Extends our Biome config in your `biome.json`:

```json
{
  "extends": ["@outfitter/tooling/biome.json"]
}
```

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
- `biome` — Biome/Ultracite configuration
- `lefthook` — Git hooks configuration
- `markdownlint` — Markdown linting configuration
- `bootstrap` — Project bootstrap script
- `scaffolding` — Full starter kit (combines all above)

## Exports

| Export | Description |
|--------|-------------|
| `./biome.json` | Biome configuration preset |
| `./tsconfig.preset.json` | TypeScript preset (general) |
| `./tsconfig.preset.bun.json` | TypeScript preset (Bun) |
| `./lefthook.yml` | Lefthook hooks configuration |
| `./.markdownlint-cli2.jsonc` | markdownlint configuration |

## Related

- [@outfitter/contracts](../contracts/README.md) — Result types and error patterns
- [@outfitter/cli](../cli/README.md) — CLI framework
- [@outfitter/kit](../kit/README.md) — Version coordination

## License

MIT
