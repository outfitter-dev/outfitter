---
name: outfitter-update
version: 2.0.0
description: "Manages @outfitter/* package updates — handles version detection, dependency bumps, mechanical codemods, and test verification. Use when updating dependencies, migrating breaking changes, or running outfitter update."
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Skill, AskUserQuestion
related-skills: outfitter-atlas, outfitter-check, outfitter-start, tdd-fieldguide
---

# Outfitter Update

Update @outfitter/* packages with structured migration — from version detection through codemod execution to test verification.

## Steps

1. **Detect** — Run `outfitter update --json` to discover installed versions and available updates.
2. **Decide** — Present findings. Choose interactive or autonomous mode based on scope.
3. **Apply** — Run `outfitter update --apply` to bump deps, install, and run mechanical codemods.
4. **Migrate** — For remaining changes not covered by codemods, apply code transforms manually using structured change metadata.
5. **Verify** — Run tests. If failures, diagnose using migration docs as context, fix, re-verify.
6. **Confirm** — Load `outfitter-check` for final compliance scan.

## Mode Selection

| Condition | Mode | Rationale |
|-----------|------|-----------|
| No breaking changes | **Auto** | Bump, install, run tests — no code changes expected |
| Breaking changes with codemods | **Autonomous** | CLI handles mechanical transforms, agent verifies |
| Breaking changes, no codemods | **Interactive** | Agent needs judgment for code migration |
| Major version jump (>2 minor) | **Interactive** | Too many changes to auto-apply safely |

## Autonomous Loop

When in autonomous mode, follow this cycle:

```
detect → apply → codemod → migrate → test → fix → repeat
                                       ↓
                                    (green) → confirm → done
```

### Step-by-step

1. Run `outfitter update --json` to get structured output
2. Parse the `packages` array for updates, check `hasBreaking`
3. Run `outfitter update --apply` (or `--apply --breaking` if breaking changes are expected)
4. CLI bumps deps, installs, discovers codemods, runs them automatically
5. Parse `codemods` summary from output — check `errors` array
6. For each `guide` in the output with `changes`:
   - Skip changes where `change.codemod` exists (already handled)
   - Apply remaining changes using the structured metadata (see Decision Framework)
7. Run `bun test` (or `bun run test` from repo root)
8. If tests fail:
   a. Read failure output
   b. Cross-reference with migration doc guidance (`outfitter update --guide`)
   c. Fix the issue
   d. Re-run tests
   e. If still failing after 3 attempts, escalate to user
9. When green: load `outfitter-check` skill for compliance verification

## CLI Reference

```bash
# Check installed versions
outfitter update

# JSON output for programmatic parsing
outfitter update --json

# Show migration instructions
outfitter update --guide
outfitter update --guide @outfitter/cli    # specific package

# Apply updates (bump deps + install + run codemods)
outfitter update --apply

# Apply including breaking changes
outfitter update --apply --breaking

# Apply without running codemods
outfitter update --apply --no-codemods

# Monorepo workspace scanning
outfitter update --workspace
outfitter update --workspace --apply
```

### JSON Output Shape

```typescript
interface UpdateResult {
  packages: PackageVersionInfo[];
  total: number;
  updatesAvailable: number;
  hasBreaking: boolean;
  applied: boolean;
  appliedPackages: string[];
  skippedBreaking: string[];
  guides?: MigrationGuide[];
  codemods?: CodemodSummary;
}
```

See `references/structured-changes.md` for full type definitions and parsing examples.

## Decision Framework

### By Change Type

| `change.type` | Agent Action |
|---------------|-------------|
| `moved` | Update import paths: `from` → `to` |
| `renamed` | Find-and-replace: `from` → `to` in imports and usages |
| `removed` | Find usages of `from`, replace with alternative from `detail` |
| `signature-changed` | Update call sites per `detail` description |
| `deprecated` | Optional: migrate now or add TODO for later |
| `added` | No action needed — informational |

### By Update Type

| Update Type | Action |
|-------------|--------|
| **Patch** (0.1.0 → 0.1.1) | Bump, test — no code changes expected |
| **Minor** (0.1.0 → 0.2.0) | Review migration doc for new APIs, adopt if beneficial |
| **Breaking** (flagged) | Follow migration guide, apply codemods, update code, test |

## Dependency Order

When updating multiple packages, follow the tier order:

1. **Foundation**: contracts, types
2. **Runtime**: cli, mcp, config, logging, file-ops, state, index, daemon, schema, tui, testing
3. **Tooling**: outfitter (umbrella CLI)

Update lower tiers first — runtime packages depend on foundation changes.

## Migration Docs

Migration guides are at `${CLAUDE_PLUGIN_ROOT}/shared/migrations/` with naming:

```
outfitter-<package>-<version>.md
```

Each doc has YAML frontmatter with structured `changes`:

```yaml
---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "cli/0.4.0-move-tui-imports.ts"
  - type: renamed
    from: "formatOutput"
    to: "renderOutput"
---
```

Changes with a `codemod` field are handled automatically by `--apply`. The remaining changes need manual migration.

## Codemods

Codemod scripts live at `${CLAUDE_PLUGIN_ROOT}/shared/codemods/` organized by package:

```
codemods/
  cli/
    0.4.0-move-tui-imports.ts
  contracts/
    adopt-result-types.ts
```

Each exports a `transform(options)` function. The CLI discovers and runs them automatically during `--apply`. Agents should not run codemods directly — let the CLI handle it.

## Error Recovery

| Failure | Recovery |
|---------|----------|
| `--apply` fails on install | Check network, verify package exists on npm |
| Codemod reports errors | Read the `errors` array, fix manually, re-run |
| Tests fail after migration | Read failure, cross-reference migration doc, fix code |
| 3+ test fix attempts fail | Escalate to user with evidence |

## Related Skills

- `outfitter-atlas` — Patterns and templates for current package versions
- `outfitter-check` — Compliance verification after updates
- `outfitter-start` — Full adoption workflow (for new or first-time setup)
- `tdd-fieldguide` — Test-driven development methodology for the verify loop
