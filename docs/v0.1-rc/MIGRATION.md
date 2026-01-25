# Agent-Guided Init + Migration (Stub)

**Date**: 2026-01-25  
**Status**: Draft (repo survey captured, needs decisions)

## Purpose
Define an agent-guided experience for:
1) **Init**: smarter scaffold + naming + defaults, driven by an agent.
2) **Migrate**: adopt Kit in existing repos with minimal divergence and clear checkpoints.

Tracking: `MONO-80`

## Goals
- Provide a repeatable migration flow with clear checkpoints.
- Normalize package/scripts/config alignment across repos.
- Avoid destructive changes; keep PRs small, staged, and reversible.
- Capture project-specific deltas and feed learnings back into Kit.

## Non-Goals (for RC)
- Full automation without human approval.
- One-click migration for every repo shape.
- Rewriting app architecture beyond Kit adoption.

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
- Config/logging defaults (Kit config + logtape)

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
   - Add Kit packages with minimal surface changes.
3) **Surface Bridging**
   - Map CLI/MCP/API to Kit action registry + capability manifest.
   - Ensure tool search compatibility for MCP.
4) **Adopt Defaults**
   - Swap logging/config/testing helpers to Kit variants.
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
| firewatch | Monorepo (`apps/*`, `packages/*`) | CLI (`fw`), MCP (`fw-mcp`) | Bun + TS, oxlint/oxfmt, tests in `apps/*/tests` | Not using Kit contracts/handlers, format mismatch, commander v13, plugin folder not a package |
| north | Monorepo (`packages/north`, `examples`, `harness`) | CLI (`north`), MCP (`north-mcp`), lib | Bun + TS, native deps | `better-sqlite3`/`ast-grep` coupling, tests layout, zod v4, commander v12 |
| navigator | Monorepo (`packages/*`) + extension | CLI (`nav`), MCP (`navigator-mcp`), HTTP server, extension | Bun + TS, Biome (single quotes) | Formatting mismatch, handler contract mismatch, extension surface complexity |
| waymark | Monorepo (`apps/mcp`, `packages/*`) | CLI (`wm`/`waymark`), MCP (`waymark-mcp`) | Bun + TS, Turbo, ultracite | zod v4 vs v3 split, logging/prompt stack mismatch |

### Repo Deep Dives
- `docs/v0.1-rc/migrations/firewatch.md`
- `docs/v0.1-rc/migrations/north.md`
- `docs/v0.1-rc/migrations/navigator.md`
- `docs/v0.1-rc/migrations/waymark.md`

### Firewatch Notes
**Shape**: Workspaces in root (`apps/*`, `packages/*`), plus `packages/claude-plugin/firewatch` (no `package.json`).  
**Surfaces**: CLI (`fw`), MCP (`fw-mcp`), core/shared libs.  
**Concerns**:
- No Kit handler contract or error taxonomy (ad-hoc Result types).
- Oxlint/oxfmt vs Kit Biome config (format drift).
- Tests live in `apps/*/tests` and `packages/*/tests`, not `src/__tests__`.
- CLI uses `commander@^13` (Kit prefers 14+).
**Migration Checklist**:
- Introduce `@outfitter/contracts` Result + error taxonomy in core.
- Rewire CLI/MCP adapters to Kit (`@outfitter/cli`, `@outfitter/mcp`).
- Align lint/format to Kit Biome; reformat.
- Normalize test layout or adjust tooling.
- Decide where `packages/claude-plugin` lives (apps/docs/templates).

### North Notes
**Shape**: Monorepo with `packages/north`, `examples/nextjs-shadcn`, `harness`.  
**Surfaces**: CLI + MCP + library.  
**Concerns**:
- Native deps (`better-sqlite3`, `@ast-grep/napi`) complicate portability; consider Kit `@outfitter/index`/`bun:sqlite`.
- Direct use of Commander/MCP SDK; not Kit adapters.
- Biome config uses spaces; Kit requires tabs/double quotes.
- zod v4 + commander v12 mismatch.
**Migration Checklist**:
- Move handlers to Kit Result contract + errors.
- Adopt `@outfitter/cli`, `@outfitter/mcp`, `@outfitter/config`, `@outfitter/logging`.
- Normalize deps (zod v4, commander v14+).
- Align formatting + test layout.

### Navigator Notes
**Shape**: Monorepo `packages/*` (core/server/mcp/cli/extension/agents).  
**Surfaces**: CLI, MCP, HTTP server, Chrome extension.  
**Concerns**:
- Format mismatch (single quotes, semicolons as-needed).
- Tests live in `packages/*/tests`, not `src/__tests__`.
- Capability manifest exists; needs mapping to Kit action registry.
- TS strict flags differ from Kit; update required.
**Migration Checklist**:
- Preserve capability manifest or map to Kit registry.
- Port CLI/MCP to Kit adapters; keep server Hono surface.
- Align Biome config + TS strict flags.
- Decide how to treat extension within Kit (app vs separate repo).

### Waymark Notes
**Shape**: Monorepo with `apps/mcp`, `packages/{cli,core,grammar}`, `packages/agents` (content).  
**Surfaces**: CLI (`wm`/`waymark`), MCP (`waymark-mcp`).  
**Concerns**:
- Zod v4 in core/cli vs Zod v3 in MCP; Kit prefers v4.
- Logging/prompt stack uses pino/ora/inquirer; Kit uses logtape + clack.
- No Kit handler contract.
**Migration Checklist**:
- Normalize zod + adopt Kit Result contract.
- Replace logging/prompt stack with Kit packages.
- Align lint/format and tests layout.
- Decide where `packages/agents` belongs (docs/templates).

## Areas of Concern (Expanded)
- workspace vs published deps (`workspace:*` in templates vs npm publish)
- CLI/MCP parity + action registry drift
- Transport choices (stdio vs HTTP)
- Existing testing harness compatibility
- Version pinning and release flow
- Formatting config mismatch (Biome tabs/double quotes vs repo defaults)
- Zod version drift (v4 baseline vs older versions)
- Test layout mismatch (`tests/` vs `src/__tests__`)
- Native deps + bundling constraints (sqlite/ast-grep)
- Extension/front-end surfaces that don’t fit Kit tiering

## Open Questions
- What should be the default “agent init” prompt set?
- Which migrations are always safe vs opt-in?
- How do we record project-specific divergences in a reusable way?
- Should the migration skill live as a Kit CLI command, or an agent-only workflow?
