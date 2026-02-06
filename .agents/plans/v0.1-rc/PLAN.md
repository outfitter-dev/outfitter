# v0.1-rc Plan (Phase 7 Reframe)

**Date**: 2026-01-24
**Status**: Active

## Intent
Freeze `SPEC.md` and `PLAN.md` as historical baselines, then drive a focused v0.1-rc scope that closes remaining gaps, documents intentional divergences, and validates real-world usage (fresh scaffold + Waymark migration).

## Scope
**In**
- v0.1-rc backlog and validation (scaffolds, migrations, gap closures).
- Document deltas vs spec/plan (see `DELTAS.md`) and decide keep vs align.
- Waymark migration (local) after verifying scaffolds.

**Out**
- New feature expansion beyond spec gaps (e.g., Cloudflare adapters, telemetry).
- Tooling tier packages unless required for RC (`@outfitter/scripts`, `@outfitter/actions`, `@outfitter/release`).

## Remaining Work (v0.1-rc)
[x] `@outfitter/testing`: add spec-compat APIs (createMCPTestHarness wrapper + alias), add `captureCLI`/`mockStdin`, add mock factories.
[ ] Templates: implement unified placeholder set (projectName/binName/packageName/description/author/year) with aliases; `author` can be org, `year` optional.
[ ] Templates: add missing scripts (`test:watch`, `lint:fix`) and define a standard script set.
[ ] `outfitter init`: add TTY wizard for template + naming; keep deterministic default for non-TTY.
[ ] `outfitter init`: implement hybrid install path (`--local/--workspace`) + publish `0.1.0-*` for real installs.
[ ] `@outfitter/mcp`: implement tool-search compatibility + minimal core tools (docs/config/query); explicit stdio transport for RC. Track HTTP + auto-negotiation in Linear (MONO-76, MONO-77).
[ ] `@outfitter/index`: add version headers + migration scaffold; track compactor/watcher hooks in Linear (MONO-78, MONO-79).
[ ] Consider capability manifest (CLI ↔ MCP parity) based on `../navigator/packages/core/src/capabilities/manifest.ts`.
[ ] Run scaffold smoke tests for `cli`, `mcp`, `daemon` templates and record results.
[ ] Migrate Waymark (local) to use kit packages; verify tests + dev workflow.
[ ] Decide Firewatch migration timing (optional for RC).

## Validation Checklist
- `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build` from repo root.
- `outfitter init cli|mcp|daemon` scaffolds, and generated project commands are viable (local mode + published RC mode).
- Waymark migration passes its tests and dev workflows.

## Notes
- `SPEC.md` and `PLAN.md` are frozen as of 2026-01-24.
- Phase 7 is treated as the v0.1-rc scope, not an additional phase.
