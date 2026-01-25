# Agent-Guided Init + Migration (Stub)

**Date**: 2026-01-25  
**Status**: Draft (repo survey captured, needs decisions)

## Purpose
Define an agent-guided experience for:
1) **Init**: smarter scaffold + naming + defaults, driven by an agent.
2) **Migrate**: adopt Outfitter in existing repos with minimal divergence and clear checkpoints.

Tracking: `MONO-80`

## Goals
- Provide a repeatable migration flow with clear checkpoints.
- Normalize package/scripts/config alignment across repos.
- Avoid destructive changes; keep PRs small, staged, and reversible.
- Capture project-specific deltas and feed learnings back into Outfitter.

## Non-Goals (for RC)
- Full automation without human approval.
- One-click migration for every repo shape.
- Rewriting app architecture beyond Outfitter adoption.

## Agent-Guided Init (Concept)
- **Prompted flow**: template selection, package/bin names, runtime deps.
- **Intent capture**: CLI/MCP/server surfaces, transport preference, logging,
  config strategy, testing.
- **Output**: scaffolded project + a migration checklist for next steps.

### Draft Prompt Set (v0)
**Project identity**
- Project name, package name (scoped?), bin name, description
- Author (person/org), year (optional), license

**Surfaces & transport**
- CLI / MCP / daemon / server (select all that apply)
- MCP transport: stdio now; plan for HTTP/SSE later?
- API style (tRPC default; REST/OpenAPI when needed)

**Runtime + tooling**
- Bun vs Node (default Bun)
- Lint/format baseline (Biome)
- Testing (Bun test; Playwright optional)
- Config/logging defaults (Outfitter config + logtape)

**Data + storage**
- SQLite default (bun:sqlite) vs Postgres/Supabase/Neon
- Indexing needs (FTS5 / @outfitter/index)

**Publish + local dev**
- Local dev mode (`workspace:*`) vs published RC pins
- NPM scope + dist tags (rc vs latest)

**Outputs**
- Scaffolded project (templates + configs)
- Decision log (what was chosen + why)
- Follow‑up checklist (migration, parity, tests)

## Migration Skill (Concept)
### Inputs
- Repo type (single package / monorepo).
- Runtime (Bun/Node) + package manager.
- Existing CLI/MCP/server surface.
- Current scripts, config, and testing setup.

### Phases
1) **Inventory**
   - Identify packages, entrypoints, commands, and transports.
   - Record tooling: lint, format, test, build, CI.
2) **Align Tooling**
   - Standardize scripts and baseline config where feasible.
   - Add Outfitter packages with minimal surface changes.
3) **Surface Bridging**
   - Map CLI/MCP/API to Outfitter action registry + capability manifest.
   - Ensure tool search compatibility for MCP.
4) **Adopt Defaults**
   - Swap logging/config/testing helpers to Outfitter variants.
   - Add migrations/version headers where relevant (index).
5) **Verify**
   - Run test/build/typecheck.
   - Smoke test CLI/MCP behavior.

### Outputs
- Minimal set of PRs with tight scope.
- Documented deltas (kept vs aligned).
- Known follow-ups tracked as Linear issues.

## Repo Survey (Current)
| Repo | Shape | Surfaces | Notes | Migration Risks |
| --- | --- | --- | --- | --- |
| firewatch | Monorepo (`apps/*`, `packages/*`) | CLI (`fw`), MCP (`fw-mcp`) | Bun + TS, oxlint/oxfmt, tests in `apps/*/tests` | Not using Outfitter contracts/handlers, format mismatch, commander v13, plugin folder not a package |
| north | Monorepo (`packages/north`, `examples`, `harness`) | CLI (`north`), MCP (`north-mcp`), lib | Bun + TS, native deps | `better-sqlite3`/`ast-grep` coupling, tests layout, zod v4, commander v12 |
| navigator | Monorepo (`packages/*`) + extension | CLI (`nav`), MCP (`navigator-mcp`), HTTP server | Bun + TS, Biome 1.x (single quotes) | Formatting mismatch, handler contract mismatch, commander v13, prompt stack mismatch (extension out of scope) |
| waymark | Monorepo (`apps/mcp`, `packages/*`) | CLI (`wm`/`waymark`), MCP (`waymark-mcp`) | Bun + TS, Turbo, ultracite | logging/prompt stack mismatch |

### Repo Deep Dives
See detailed migration plans with phased checklists:
- [firewatch.md](migrations/firewatch.md) — verified ✓
- [north.md](migrations/north.md) — verified ✓
- [navigator.md](migrations/navigator.md) — verified ✓ (extension out of scope)
- [waymark.md](migrations/waymark.md) — verified ✓ (zod v3 in MCP needs upgrade)

## Areas of Concern (Expanded)
- workspace vs published deps (`workspace:*` in templates vs npm publish)
- CLI/MCP parity + action registry drift
- Transport choices (stdio vs HTTP)
- Existing testing harness compatibility
- Version pinning and release flow
- Formatting config mismatch (Biome tabs/double quotes vs repo defaults)
- Zod version drift (waymark `apps/mcp` still on v3; others resolved)
- Test layout mismatch (`tests/` vs `src/__tests__`)
- Native deps + bundling constraints (sqlite/ast-grep)
- Extension/front-end surfaces that don’t fit Outfitter tiering

## Open Questions
- What should be the default “agent init” prompt set?
- Which migrations are always safe vs opt-in?
- How do we record project-specific divergences in a reusable way?
- Should the migration skill live as a Outfitter CLI command, or an agent-only workflow?
