# OS-74: `outfitter upgrade --apply` Implementation Stack

**Issue**: `OS-74`
**Status**: Proposed
**Last Updated**: 2026-02-10

## Why This Stack Exists

`outfitter upgrade` currently checks versions and can show migration guidance, but it does not
apply dependency updates. This creates a mismatch between what users expect from an update command
and what the command actually does.

This stack turns `outfitter upgrade` into a safe, monorepo-aware updater while preserving
read-only behavior as the default path.

## User-Facing Target

```bash
# Read-only checks (existing)
outfitter upgrade
outfitter upgrade --guide

# New behavior (to implement)
outfitter upgrade --apply
outfitter upgrade --apply --breaking
outfitter upgrade --json
outfitter upgrade --apply --json
```

## Proposed Branch Stack

1. `feature/outfitter-update/0-analysis-and-planner`
2. `feature/outfitter-update/1-apply-non-breaking`
3. `feature/outfitter-update/2-monorepo-workspace-scan`
4. `feature/outfitter-update/3-breaking-change-gates`
5. `feature/outfitter-update/4-json-migration-guidance`
6. `feature/outfitter-update/5-docs-and-e2e`

## Slice Details

### Slice 0: Analysis and Planner

- Extract update planning into an internal pure planner that classifies each candidate bump:
  - `upToDate`, `upgradableNonBreaking`, `upgradableBreaking`, `blocked`
- Keep planner output transport-agnostic and serializable.
- Tests:
  - version parsing and comparison
  - pre-1.0 breaking detection via metadata/frontmatter
  - stable ordering for deterministic output

### Slice 1: Apply Non-Breaking Updates

- Add `--apply` path for non-breaking updates only.
- Write updated dependency ranges back to `package.json`.
- Run one install at workspace root after mutations.
- Keep dry and safe defaults:
  - no mutation without explicit `--apply`
  - no breaking updates without `--breaking`
- Tests:
  - single-package apply updates deps
  - install command invocation once per run
  - no-op behavior when nothing is upgradable

### Slice 2: Monorepo Workspace Scan

- Detect workspace root and package manifests.
- Scan all relevant `package.json` files for `@outfitter/*` deps.
- Apply updates across manifests in one execution pass.
- Tests:
  - flat repo scan
  - workspaces scan
  - dedupe and path filtering behavior

### Slice 3: Breaking Change Gates

- Enforce guardrails for breaking changes.
- Block breaking updates unless `--breaking` is passed.
- Include clear per-package reasons in output.
- Tests:
  - blocked without `--breaking`
  - allowed with `--breaking`
  - mixed safe + breaking update sets

### Slice 4: JSON + Migration Guidance

- Extend JSON output to include machine-readable migration metadata.
- Include per-package migration hints and doc references in JSON mode.
- Keep human output concise and scan-friendly.
- Tests:
  - schema snapshot for JSON output
  - guidance mapping for package/version combinations

### Slice 5: Docs and E2E

- Update `docs/MIGRATION.md` and CLI docs with exact semantics.
- Add end-to-end tests covering:
  - read-only mode
  - `--apply` non-breaking mode
  - `--apply --breaking` mode
  - monorepo apply behavior

## Guardrails

- Default remains read-only.
- Never mutate lockfiles/manifests unless `--apply` is set.
- Run installs at workspace root, not per package.
- Keep handler-level logic in pure functions returning `Result<T, E>`.

## Completion Criteria

- `outfitter upgrade --apply` updates non-breaking deps in all relevant manifests.
- `outfitter upgrade --apply --breaking` includes breaking updates with guidance.
- Monorepo scan is deterministic and tested.
- JSON output includes structured migration details usable by agents.
- Docs and examples match runtime behavior.
