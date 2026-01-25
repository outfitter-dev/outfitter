# North → Outfitter Migration

**Date**: 2026-01-25
**Status**: Draft (verified 2026-01-25)

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

## Outfitter Deltas
- **Native deps**: `better-sqlite3` + `@ast-grep/napi` are externalized; consider Outfitter `@outfitter/index` or `bun:sqlite` to reduce native coupling.
- **Adapters**: CLI/MCP use raw Commander + MCP SDK.
- **Formatting**: Biome spaces vs Outfitter tabs (quotes already match — both use double quotes).
- **Commander**: v12 (Outfitter prefers v14+).
- **Handler contract**: ad-hoc `{ success: boolean }` returns instead of Outfitter Result/error taxonomy.
- **TS strict flags**: Missing `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`.
- **Prompt/spinner stack**: `chalk` + `ora` vs Outfitter `@outfitter/ui` + `@outfitter/logging`.
- **Tests**: Collocated `*.test.ts` next to source vs Outfitter `src/__tests__/` layout.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map CLI commands → MCP tools → shared handler candidates.
- Identify data flow around indexing, parsing, and storage.
- Inventory config/state paths (alignment with Outfitter config expectations).

### Phase 1 — Tooling Alignment
- Update Biome config to Outfitter defaults (tabs, double quotes, 100 cols).
- Add Outfitter standard scripts if missing (lint:fix, test:watch, format).
- Decide on test layout migration or compatibility shim.

### Phase 2 — Handler Contract
- Introduce `@outfitter/contracts` in core logic with Result + error taxonomy.
- Wrap key operations (scan/index/check/context) as handlers.
- Add handler-level tests with Outfitter testing helpers.

### Phase 3 — CLI + MCP Adapters
- Move CLI wiring to `@outfitter/cli`.
- Rebuild MCP tool registry via `@outfitter/mcp` (keep tool names stable).
- Ensure tool search metadata alignment for MCP.

### Phase 4 — Verification
- Run `bun run test` + targeted CLI/MCP smoke tests.
- Confirm parity for key commands and MCP tool outputs.
- Validate build pipeline with Outfitter conventions.

## Risks / Decisions
- **Native deps**: decide whether to keep native SQLite/ast-grep or switch to Outfitter index stack.
- **Zod version**: Already on v4 — no migration needed.
- **Script parity**: avoid breaking existing automation (harness/scripts).
- **Bun-native alternatives**: Consider `Bun.Glob` over `glob`, native APIs where available.

## Quick Wins
- Add Outfitter contracts + error taxonomy without changing CLI/MCP.
- Add `capability` manifest mapping for tool parity.
- Document a migration compatibility layer for `better-sqlite3` before swapping.
