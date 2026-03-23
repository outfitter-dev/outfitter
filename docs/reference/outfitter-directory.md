# `.outfitter/` Directory

Project-level artifacts generated and consumed by the Outfitter CLI. Lives at the repository root alongside `package.json`.

## Contents

| Path            | Purpose                                                      | Committed                |
| --------------- | ------------------------------------------------------------ | ------------------------ |
| `surface.lock`  | SHA-256 content hash of the surface map for drift detection  | Yes                      |
| `_surface.json` | Full surface map detail (used for semantic diff on mismatch) | No (gitignored)          |
| `docs-map.json` | Generated docs inventory manifest used by docs-map workflows | No (generated on demand) |
| `migration/`    | Migration audit reports and upgrade plans                    | Yes                      |
| `reports/`      | Generated analysis reports (link checks, etc.)               | No (gitignored)          |

### `surface.lock`

A single-line file containing the SHA-256 hex hash of the deterministic surface map content. This is the only committed surface artifact. The hash is computed from the surface map JSON with `generatedAt` stripped and all keys sorted, ensuring deterministic output regardless of generation time or key ordering.

When `schema diff` runs, it hashes the live runtime surface map and compares against this committed hash. If the hashes match, there is no drift. If they differ, it reads `_surface.json` (or generates a fresh map) to show a semantic diff of what changed.

### `_surface.json`

The full surface map JSON, written alongside `surface.lock` by `schema generate`. This file is gitignored and exists only for local debugging and semantic diff output. It is never committed.

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

Commit `surface.lock` and `migration/` -- these are shared artifacts that CI and teammates depend on. The `_surface.json` and `reports/` directories are gitignored since they are ephemeral and developer-local.

The `.gitignore` entries:

```
.outfitter/_surface.json
.outfitter/reports/
*/*/.outfitter/surface.json
*/*/.outfitter/_surface.json
*/*/.outfitter/surface.lock
```

CI/pre-push guard:

```bash
outfitter check surface-map --cwd .
outfitter check surface-map-format --cwd .
```

## When to Regenerate

| Trigger                        | Command                                      |
| ------------------------------ | -------------------------------------------- |
| Added or changed a CLI action  | `outfitter schema generate`                  |
| Pre-push hook fails with drift | `outfitter schema generate` then re-push     |
| Stale migration state          | Remove `migration/` after completing upgrade |
