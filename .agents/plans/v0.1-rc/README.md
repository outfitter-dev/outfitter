# Outfitter Kit v0.1-rc

**Date**: 2026-01-24  
**Status**: Active

## Purpose
Freeze `SPEC.md` and `PLAN.md` as historical baselines and drive a focused v0.1-rc scope that closes remaining gaps, documents intentional divergences, and validates real-world usage (fresh scaffolds + Waymark migration).

## What’s Frozen
- `SPEC.md` and `PLAN.md` are frozen as of 2026-01-24.
- Any remaining work is tracked here and in `DELTAS.md`.

## Locked Decisions (RC)
- **Testing harness**: keep server-based MCP harness; add spec-compatible wrapper + alias.
- **CLI testing**: keep `createCliHarness`; add `captureCLI` + `mockStdin`.
- **Mock factories**: implement `createTestContext`, `createTestLogger`, `createTestConfig`.
- **Templates (placeholders)**: unified schema with aliases (see below).
- **Templates (scripts)**: add missing scripts and standardize a common set.
- **Init UX**: keep `init --template` + `templates/basic`; add TTY wizard for template + naming.
- **Doctor**: keep `outfitter doctor` and document as enhancement.
- **MCP**: implement tool-search compatibility + minimal core tools (docs/config/query) with safe defaults; explicit stdio transport for RC.
- **Index**: add version headers + migration scaffold; defer compactor/watcher hooks.
- **Hybrid installs**: add `--local/--workspace` mode for local dev + publish `0.1.0-*` for real installs.

## Standard Template Placeholder Schema
Canonical keys:
- `{{projectName}}` — human-readable project name (default from folder name)
- `{{packageName}}` — `package.json` name (supports scoped)
- `{{binName}}` — CLI binary name (defaults to `projectName`)
- `{{description}}`
- `{{author}}` — person or org (from git config when available)
- `{{year}}` — optional; for LICENSE/NOTICE headers when used

Aliases for compatibility:
- `{{name}}` → `{{projectName}}`

## Standard Template Scripts
Baseline scripts (all templates):
- `dev`
- `build`
- `typecheck`
- `test`
- `test:watch`
- `lint`
- `lint:fix`
- `format`

Daemon template additionally includes:
- `dev:daemon`

## MCP v0.1-rc Scope
In:
- Tool search compatibility and description discipline
- Core tools (minimal): `docs`, `config`, `query` with safe defaults and extension points
- Explicit stdio transport

Deferred:
- HTTP transport (streaming/SSE)
- Transport auto-negotiation

## Index v0.1-rc Scope
In:
- Version headers + migration scaffolding

Deferred:
- Compactor hooks
- Watcher invalidation hooks

## Hybrid Install Strategy
- **Local dev**: `outfitter init --local/--workspace` rewrites deps for monorepo testing.
- **Published RC**: templates target `0.1.0-*` for real installs.

## Deferred Issues (Linear / MONO / Kit project)
- MONO-76: MCP: add HTTP transport (streaming)
- MONO-77: MCP: add transport auto-negotiation (stdio ↔ HTTP)
- MONO-78: Index: add compactor hooks
- MONO-79: Index: add watcher invalidation hooks

## Validation / Exit Criteria
- `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build` from repo root
- `outfitter init cli|mcp|daemon` works in both local mode and published RC mode
- Waymark migration passes tests and dev workflows
