# Waymark → Kit Migration

**Date**: 2026-01-25  
**Status**: Draft

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

## Kit Deltas
- **Zod drift**: core/cli use v4, MCP uses v3; Kit prefers v4.
- **Logging/UX**: pino/ora/inquirer vs Kit logtape + clack.
- **Adapters**: CLI/MCP use raw Commander + MCP SDK.
- **Handler contract**: no Kit Result/error taxonomy in core.
- **Agents assets**: `packages/agents` is not a package; decide where it belongs.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map CLI commands and MCP tools to shared handler candidates.
- Identify config/state paths and how they map to Kit config.
- Decide scope for `packages/agents` content.

### Phase 1 — Tooling Alignment
- Align Biome config to Kit defaults (tabs/double quotes).
- Normalize scripts to Kit baseline (build/test/typecheck/lint/format).
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
- **Zod migration**: v3 → v4 alignment requires careful schema updates.
- **Logging/UX**: replacing prompts/spinners may change UX.
- **Agent assets**: decide if this becomes `docs/` or template content.

## Quick Wins
- Introduce Kit contracts + error taxonomy in core.
- Add a capability manifest for CLI/MCP parity.
- Start replacing logging with `@outfitter/logging` in isolated modules.
