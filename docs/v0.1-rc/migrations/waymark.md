# Waymark → Outfitter Migration

**Date**: 2026-01-25
**Status**: Draft (verified 2026-01-25)

## Snapshot
- **Repo**: `/Users/mg/Developer/outfitter/waymark`
- **Shape**: Monorepo (`packages/*`, `apps/*`)
- **Workspaces**: `packages/*`, `apps/*`
- **Runtime**: Bun + TypeScript (ESM)
- **Tooling**: Turbo, Biome/Ultracite, markdownlint
- **Surfaces**:
  - CLI: `wm` / `waymark` (`packages/cli/src/index.ts`)
  - MCP: `waymark-mcp` (`apps/mcp/src/index.ts`)
  - Core libs: `packages/core`, `packages/grammar`
  - Agent assets: `packages/agents` (content, not a package)

## Key Entrypoints
- **CLI**: `packages/cli/src/index.ts`
- **MCP**: `apps/mcp/src/index.ts`
- **Core**: `packages/core/src/index.ts`
- **Grammar**: `packages/grammar/src/index.ts`

## Outfitter Deltas
- **Zod drift**: core/cli use v4, but `apps/mcp` still uses v3 (`^3.23.8`) — needs upgrade.
- **Logging/UX**: pino/ora/inquirer vs Outfitter logtape + clack.
- **Adapters**: CLI/MCP use raw Commander + MCP SDK.
- **Handler contract**: no Outfitter Result/error taxonomy in core.
- **Exit codes**: Custom taxonomy (`usageError=2`, `configError=3`, `ioError=4`) differs from Outfitter's 10-category mapping.
- **Config loading**: MCP uses custom config pattern vs Outfitter `@outfitter/config`.
- **Agents assets**: `packages/agents` is not a package; decide where it belongs.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map CLI commands and MCP tools to shared handler candidates.
- Identify config/state paths and how they map to Outfitter config.
- Decide scope for `packages/agents` content.

### Phase 1 — Tooling Alignment
- Align Biome config to Outfitter defaults (tabs/double quotes).
- Normalize scripts to Outfitter baseline (build/test/typecheck/lint/format).
- Decide on test layout migration or compatibility.

### Phase 2 — Handler Contract
- Introduce `@outfitter/contracts` Result + error taxonomy.
- Wrap core operations in handlers (scan/format/lint/etc.).
- Add handler tests using `@outfitter/testing` helpers.

### Phase 3 — CLI + MCP Adapters
- Rewire CLI to `@outfitter/cli` adapters.
- Rewire MCP to `@outfitter/mcp` tool registry.
- Preserve command/tool names to avoid breaking user flows.

### Phase 4 — Verification
- Run `bun run test` + targeted CLI/MCP smoke tests.
- Validate output parity for core commands.

## Risks / Decisions
- **Zod migration**: `apps/mcp` needs v3 → v4 upgrade; core/cli already on v4.
- **Logging/UX**: replacing prompts/spinners may change UX.
- **Exit code remapping**: Current codes have different semantics than Outfitter taxonomy.
- **Agent assets**: decide if this becomes `docs/` or template content.
- **Test coverage**: Multiple packages have placeholder test scripts (`|| echo 'No tests yet'`).

## Quick Wins
- Introduce Outfitter contracts + error taxonomy in core.
- Add a capability manifest for CLI/MCP parity.
- Start replacing logging with `@outfitter/logging` in isolated modules.
