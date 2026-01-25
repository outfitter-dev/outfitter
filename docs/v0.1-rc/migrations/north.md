# North → Kit Migration

**Date**: 2026-01-25  
**Status**: Draft

## Snapshot
- **Repo**: `/Users/mg/Developer/outfitter/north`
- **Shape**: Monorepo (`packages/*`, `examples/*`, `harness/`)
- **Workspaces**: `packages/*`, `examples/*`
- **Runtime**: Bun + TypeScript (ESM)
- **Tooling**: Turbo, Biome (spaces), lefthook, Bun test
- **Surfaces**:
  - CLI: `north` (`packages/north/src/cli/index.ts`)
  - MCP: `north-mcp` (`packages/north/src/mcp/index.ts`)
  - Library: `packages/north/src/index.ts`

## Key Entrypoints
- **CLI**: `packages/north/src/cli/index.ts`
- **MCP**: `packages/north/src/mcp/index.ts`
- **Core library**: `packages/north/src/index.ts`
- **MCP tools**: `packages/north/src/mcp/tools/*`

## Kit Deltas
- **Native deps**: `better-sqlite3` + `@ast-grep/napi` are externalized; consider Kit `@outfitter/index` or `bun:sqlite` to reduce native coupling.
- **Adapters**: CLI/MCP use raw Commander + MCP SDK.
- **Formatting**: Biome spaces vs Kit tabs/double quotes.
- **Deps**: zod v4 + commander v12 (Kit prefers zod v4 / commander v14+).
- **Handler contract**: no Kit Result/error taxonomy in core.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map CLI commands → MCP tools → shared handler candidates.
- Identify data flow around indexing, parsing, and storage.
- Inventory config/state paths (alignment with Kit config expectations).

### Phase 1 — Tooling Alignment
- Update Biome config to Kit defaults (tabs, double quotes, 100 cols).
- Add Kit standard scripts if missing (lint:fix, test:watch, format).
- Decide on test layout migration or compatibility shim.

### Phase 2 — Handler Contract
- Introduce `@outfitter/contracts` in core logic with Result + error taxonomy.
- Wrap key operations (scan/index/check/context) as handlers.
- Add handler-level tests with Kit testing helpers.

### Phase 3 — CLI + MCP Adapters
- Move CLI wiring to `@outfitter/cli`.
- Rebuild MCP tool registry via `@outfitter/mcp` (keep tool names stable).
- Ensure tool search metadata alignment for MCP.

### Phase 4 — Verification
- Run `bun run test` + targeted CLI/MCP smoke tests.
- Confirm parity for key commands and MCP tool outputs.
- Validate build pipeline with Kit conventions.

## Risks / Decisions
- **Native deps**: decide whether to keep native SQLite/ast-grep or switch to Kit index stack.
- **Zod version**: ensure any v3 usage is upgraded to v4 for baseline parity.
- **Script parity**: avoid breaking existing automation (harness/scripts).

## Quick Wins
- Add Kit contracts + error taxonomy without changing CLI/MCP.
- Add `capability` manifest mapping for tool parity.
- Document a migration compatibility layer for `better-sqlite3` before swapping.
