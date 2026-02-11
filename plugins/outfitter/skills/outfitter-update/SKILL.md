---
name: outfitter-update
version: 1.0.1
description: "Update @outfitter/* packages to latest versions with migration guidance. Detects installed versions, surfaces breaking changes, and applies migration steps."
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Skill, AskUserQuestion
---

# Outfitter Update

Update @outfitter/* packages with migration guidance.

## Steps

1. **Detect versions** — Run `outfitter update` to check installed @outfitter/* packages against npm.
2. **Review** — Present the version table. Highlight breaking changes.
3. **Migration guide** — Run `outfitter update --guide` to surface relevant migration docs.
4. **Apply** — For each package with updates:
   a. Load `outfitter-atlas` for current patterns
   b. Follow migration doc steps (before/after code changes)
   c. Run tests after each package update
5. **Verify** — Load `outfitter-check` to confirm compliance after updates.

## CLI Reference

The `outfitter update` command handles version detection and migration doc surfacing:

```bash
# Check installed versions against npm
outfitter update

# Show migration instructions for available updates
outfitter update --guide

# JSON output for programmatic use
outfitter update --json
```

### Output

The CLI produces a version table:

```
Package                      Current    Available  Migration
──────────────────────────── ────────── ────────── ────────────────────
@outfitter/contracts         0.1.0      0.2.0      minor (no breaking)
@outfitter/cli               0.1.0      0.3.0      major (breaking)
```

## Decision Framework

| Update Type | Action |
|-------------|--------|
| **Patch** (0.1.0 → 0.1.1) | Bump version, run tests — no code changes expected |
| **Minor** (0.1.0 → 0.2.0) | Review migration doc for new APIs, apply if beneficial |
| **Major** (0.1.0 → 1.0.0) | Follow migration guide step by step, update code, run tests |
| **Breaking** (flagged) | Must follow migration doc — code changes required |

## Migration Docs

Migration guides live in `${CLAUDE_PLUGIN_ROOT}/shared/migrations/` with the naming convention:

```
outfitter-<package>-<version>.md
```

Each doc includes:
- **New APIs** — What's available after updating
- **Migration Steps** — Specific code changes with before/after examples
- **No Action Required** — Things that just work after bumping

### Dependency Order

When updating multiple packages, follow the dependency tier order:

1. **Foundation**: contracts, types
2. **Runtime**: cli, mcp, config, logging, file-ops, state, index, daemon, testing
3. **Tooling**: outfitter (umbrella CLI)

Update lower tiers first — runtime packages may depend on foundation changes.

## Update Workflow

### Single Package

```bash
# Check what's available
outfitter update

# Review migration guide
outfitter update --guide

# Bump the version
bun add @outfitter/<package>@latest

# Apply migration steps from the guide
# ... code changes ...

# Verify
bun test
```

### Multiple Packages

When several packages have updates:

1. Group by dependency tier
2. Update foundation packages first
3. Run tests after each tier
4. Apply migration steps tier by tier
5. Final verification with `outfitter-check`

## Related Skills

- `outfitter-atlas` — Patterns and templates for current versions
- `outfitter-check` — Compliance verification after updates
- `outfitter-start` — Full adoption workflow (for new or first-time setup)
