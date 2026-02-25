# Bun Test Stability Record

This record tracks the stabilization work for `OS-311` and child issues `OS-312` through `OS-314`.

## Scope

Goal: reduce Bun CI crash risk by controlling test concurrency, splitting heavyweight suites, and collecting enough diagnostics to identify crash triggers.

Date revalidated: **2026-02-25**.

## What Changed

### OS-312: CI concurrency guardrails

- `outfitter check --ci` now runs tests through `bun run test:ci`.
- `scripts/ci-test-runner.ts` enforces explicit limits:
  - Turbo task-level concurrency via `--concurrency`.
  - Bun per-task file concurrency via `--max-concurrency` pass-through.
- CI/release defaults are pinned in workflow env:
  - `OUTFITTER_CI_TURBO_CONCURRENCY=2`
  - `OUTFITTER_CI_BUN_MAX_CONCURRENCY=4`
  - `OUTFITTER_CI_TURBO_LOG_ORDER=stream`
  - `OUTFITTER_CI_TURBO_OUTPUT_LOGS=full`

### OS-313: heavyweight suite sharding

- Split `apps/outfitter/src/__tests__/init.test.ts` into 5 focused files.
- Split `apps/outfitter/src/__tests__/upgrade-integration.test.ts` into 6 focused files.
- Added shared harness helpers:
  - `apps/outfitter/src/__tests__/helpers/init-test-harness.ts`
  - `apps/outfitter/src/__tests__/helpers/upgrade-integration-harness.ts`
- Added targeted scripts for isolated CI execution/sharding:
  - `bun run --filter outfitter test:init-integration`
  - `bun run --filter outfitter test:upgrade-integration`

### OS-314: diagnostics + Bun trial workflow

- `test:ci` now writes diagnostic artifacts to `.outfitter/ci/`.
- CI and release workflows upload diagnostics on failures:
  - `.outfitter/ci/**`
  - `.turbo/runs/*.json`
- Added manual Bun trial workflow:
  - `.github/workflows/bun-stability-trial.yml`

## Current Repository Baseline (2026-02-25)

- Pinned Bun version: `1.3.9` (from `.bun-version`).
- Approximate test inventory scan (excluding local worktree/cache dirs):
  - `229` `*.test.ts` files
  - `1322` `test(...)` call sites
- Largest `apps/outfitter` test file after split: `doctor.test.ts` (`20,825` bytes).
  - Previous hotspots `init.test.ts` and `upgrade-integration.test.ts` no longer exist as monolithic files.

## Local Verification Performed

- `bun test scripts/ci-test-runner.test.ts apps/outfitter/src/__tests__/check-orchestrator.test.ts`
- `bun run --filter outfitter test:init-integration`
- `bun run --filter outfitter test:upgrade-integration`

## Remaining Acceptance Work (OS-311)

The following requires CI run history and should be validated post-merge:

1. Confirm no Bun runtime crash for 20 consecutive runs on `main`.
2. Compare CI duration before/after guardrails (same workflow path, median over multiple runs).
3. Run `bun-stability-trial.yml` with candidate Bun versions and document observed failure rates.
4. Record Bun pin decision (stay on `1.3.9` vs upgrade) with rationale.

## Trial Workflow Usage

Run **Actions > Bun Stability Trial > Run workflow** and provide:

- `bun_versions`: comma-separated list (for example `1.3.9,1.3.10`).
- `iterations`: repeat count per version.
- `turbo_concurrency` and `bun_max_concurrency`: guardrail parameters.

Each matrix job uploads per-run diagnostics and a compact summary JSON under `.outfitter/ci-trial/`.
