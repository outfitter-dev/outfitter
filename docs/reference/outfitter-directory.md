# `.outfitter/` Directory

Project-level artifacts generated and consumed by the Outfitter CLI. Lives at the repository root alongside `package.json`.

## Contents

| Path            | Purpose                                                      | Committed                |
| --------------- | ------------------------------------------------------------ | ------------------------ |
| `surface.json`  | CLI action surface map for drift detection                   | Yes                      |
| `docs-map.json` | Generated docs inventory manifest used by docs-map workflows | No (generated on demand) |
| `migration/`    | Migration audit reports and upgrade plans                    | Yes                      |
| `reports/`      | Generated analysis reports (link checks, etc.)               | No (gitignored)          |

### `surface.json`

Snapshot of all registered CLI actions, their input/output schemas, and flag definitions. Used by `outfitter schema diff` to detect drift between the committed surface map and the live runtime.

Canonical policy: root `.outfitter/surface.json` is the only committed surface map. Do not commit `apps/outfitter/.outfitter/surface.json`.
Formatting policy: `.outfitter/surface.json` is serialized by `schema generate` (two-space JSON with trailing newline) and checked by `check-surface-map-format`. Do not run generic formatter rewrites on this file.

```bash
# Regenerate after adding or changing actions
outfitter schema generate

# Check for drift (used in pre-push hook and CI)
outfitter schema diff
```

### `docs-map.json`

Optional docs inventory produced by docs-map generation workflows. This file is
generated on demand and should not be committed unless a specific workflow
explicitly requires it.

### `migration/`

Migration state from major version upgrades. Contains an audit report and numbered plan documents. Safe to remove after a migration is complete.

### `reports/`

Transient output from analysis commands (e.g., `outfitter repo check markdown-links`). Gitignored -- regenerate locally as needed.

## Git Strategy

Commit `surface.json` and `migration/` -- these are shared artifacts that CI and teammates depend on. The `reports/` directory is gitignored since reports are ephemeral and developer-local.

The `.gitignore` entry:

```
.outfitter/reports/
apps/outfitter/.outfitter/surface.json
```

CI/pre-push guard:

```bash
bun run check-canonical-surface-map
bun run check-surface-map-format
```

## When to Regenerate

| Trigger                        | Command                                      |
| ------------------------------ | -------------------------------------------- |
| Added or changed a CLI action  | `outfitter schema generate`                  |
| Pre-push hook fails with drift | `outfitter schema generate` then re-push     |
| Stale migration state          | Remove `migration/` after completing upgrade |
