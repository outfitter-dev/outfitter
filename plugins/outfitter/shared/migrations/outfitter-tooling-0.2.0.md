---
package: "@outfitter/tooling"
version: 0.2.0
breaking: false
---

# @outfitter/tooling → 0.2.0

## New (First npm Publish)

This is the first npm-published release of `@outfitter/tooling`. It provides dev tooling presets and a CLI for Outfitter projects.

### Biome Preset

Shared Biome configuration with Outfitter-specific rules:

```json
{
  "extends": ["@outfitter/tooling/biome"]
}
```

### TypeScript Presets

Strict TypeScript configurations:

```json
// tsconfig.json — strict base
{ "extends": "@outfitter/tooling/tsconfig" }

// tsconfig.json — Bun variant
{ "extends": "@outfitter/tooling/tsconfig-bun" }
```

### Lefthook Git Hooks

Pre-configured git hooks for pre-commit (format, lint, typecheck) and pre-push (build, test):

```yaml
# lefthook.yml
extends:
  - "@outfitter/tooling/lefthook"
```

### CLI Commands

```bash
# Initialize tooling in a project
bunx @outfitter/tooling init

# Check formatting and linting
bunx @outfitter/tooling check

# Auto-fix issues
bunx @outfitter/tooling fix

# Upgrade Bun version across the repo
bunx @outfitter/tooling upgrade-bun [version]

# TDD-aware pre-push hook
bunx @outfitter/tooling pre-push
```

## No Action Required

If you were previously using `@outfitter/tooling` from the monorepo workspace, no changes needed — just ensure your dependency points to `^0.2.0`.
