# Firewatch → Outfitter Migration

**Date**: 2026-01-25
**Status**: Draft (verified 2026-01-25)

## Snapshot
- **Repo**: `/Users/mg/Developer/outfitter/firewatch`
- **Shape**: Monorepo (`apps/*`, `packages/*`)
- **Workspaces**: `packages/*`, `apps/*`
- **Runtime**: Bun + TypeScript (ESM)
- **Tooling**: oxlint/oxfmt, Bun test, custom verify scripts
- **Surfaces**:
  - CLI: `fw` (`apps/cli/bin/fw.ts`)
  - MCP: `fw-mcp` (`apps/mcp/bin/fw-mcp.ts`)
  - Core libs: `packages/core`, `packages/shared`
  - Plugin assets: `packages/claude-plugin/firewatch` (not a package)

## Key Entrypoints
- **CLI**: `apps/cli/bin/fw.ts` → `apps/cli/src/index.ts`
- **MCP**: `apps/mcp/bin/fw-mcp.ts` → `apps/mcp/src/index.ts`
- **Core**: `packages/core/src/index.ts`
- **Shared**: `packages/shared/src/index.ts`

## Outfitter Deltas
- **Handler contract**: core logic does not use Outfitter `Result<T,E>` + error taxonomy.
- **Adapters**: CLI/MCP use raw Commander + MCP SDK instead of `@outfitter/cli` + `@outfitter/mcp`.
- **Formatting**: oxlint/oxfmt vs Outfitter Biome conventions (tabs, double quotes).
- **Tests**: `apps/*/tests` and `packages/*/tests` (Outfitter expects `src/__tests__`).
- **Deps**: Commander `^13` (Outfitter prefers `^14`).
- **Non-package assets**: `packages/claude-plugin/firewatch` needs a clear home.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map CLI + MCP commands to core functions (identify shared handlers).
- Enumerate output shapes + error handling (baseline for parity).
- Identify plugin asset usage + distribution requirements.

### Phase 1 — Tooling Alignment
- Adopt Outfitter Biome config; remove oxlint/oxfmt or scope them to legacy.
- Normalize scripts to Outfitter baseline (build/test/typecheck/lint/format).
- Decide on test layout migration (`tests/` → `src/__tests__`).

### Phase 2 — Handler Contract
- Introduce `@outfitter/contracts` in core logic (Result + error taxonomy).
- Wrap existing core ops into transport-agnostic handlers.
- Add small adapter tests around handlers.

### Phase 3 — CLI + MCP Adapters
- Replace CLI wiring with `@outfitter/cli` adapter.
- Replace MCP wiring with `@outfitter/mcp` server + tool registry.
- Keep command/tool names stable for compatibility.

### Phase 4 — Verification
- Run full test suite + targeted CLI/MCP smoke tests.
- Validate output parity for key commands.
- Add regression tests for CLI/MCP wiring where missing.

## Risks / Decisions
- **Plugin assets**: decide if `packages/claude-plugin/firewatch` becomes `apps/` or `docs/` assets.
- **Formatting migration**: large diff risk (oxlint/oxfmt → Biome); may need a dedicated formatting PR.
- **Test layout move**: can be deferred if tooling supports current layout.
- **MCP error handling**: tools rely on thrown errors propagating up; Outfitter expects Result types.
- **Ultracite dependency**: will be removed with Biome migration.

## Verified Status (2026-01-25)
All documented claims verified accurate. Zod v4 already adopted across the repo.

## Quick Wins
- Add `@outfitter/contracts` + Result in core without changing CLI/MCP.
- Introduce a minimal action registry map for CLI/MCP parity.
- Add Outfitter-compatible scripts without altering code structure.
