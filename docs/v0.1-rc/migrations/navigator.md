# Navigator → Kit Migration

**Date**: 2026-01-25  
**Status**: Draft

## Snapshot
- **Repo**: `/Users/mg/Developer/outfitter/navigator`
- **Shape**: Monorepo (`packages/*`) + extension package
- **Workspaces**: `packages/*`
- **Runtime**: Bun + TypeScript (ESM)
- **Tooling**: Biome (single quotes), Bun test, Turbo-style scripts
- **Surfaces**:
  - CLI: `nav` (`packages/cli/src/index.ts`)
  - MCP: `navigator-mcp` (`packages/mcp/src/index.ts`)
  - HTTP server: `packages/server/src/index.ts`
  - Extension: `packages/extension` (Vite/CRX)

## Key Entrypoints
- **CLI**: `packages/cli/src/index.ts`
- **MCP**: `packages/mcp/src/index.ts`
- **Server**: `packages/server/src/index.ts`
- **Core schema**: `packages/core/src/schema/*`
- **Capability manifest**: `packages/core/src/capabilities/manifest.ts`

## Kit Deltas
- **Formatting**: Biome single quotes / semicolons as-needed vs Kit tabs/double quotes.
- **Handler contract**: core + server aren’t aligned to Kit Result/error taxonomy.
- **Adapters**: CLI/MCP do not use Kit adapters.
- **Tests**: `packages/*/tests` vs `src/__tests__` layout.
- **Extension**: non-Kit surface that may remain outside migration scope.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map commands/tools to core actions + capability manifest.
- Identify shared handler candidates across CLI/MCP/server.
- Define extension integration boundaries (in-scope vs out-of-scope).

### Phase 1 — Tooling Alignment
- Align Biome config to Kit conventions.
- Normalize scripts to Kit baseline (build/test/typecheck/lint/format).
- Decide on test layout migration or tooling compatibility.

### Phase 2 — Handler Contract
- Refactor core actions to Kit Result/error taxonomy.
- Introduce handler layer shared by CLI/MCP/server.
- Add handler unit tests using `@outfitter/testing`.

### Phase 3 — CLI + MCP Adapters
- Replace CLI wiring with `@outfitter/cli`.
- Replace MCP wiring with `@outfitter/mcp` tool registry.
- Preserve capability manifest as source-of-truth; map to Kit action registry.

### Phase 4 — Verification
- Run `bun run test` and focused CLI/MCP smoke tests.
- Validate HTTP server behavior unchanged.
- Ensure extension continues to function if out of migration scope.

## Risks / Decisions
- **Extension scope**: keep as separate app or migrate into Kit `apps/`?
- **Capability manifest**: align existing manifest to Kit `capabilities.ts` or keep separate.
- **Formatting**: large diff risk; consider a formatting-only PR.

## Quick Wins
- Introduce Kit contracts layer without refactoring transports.
- Add a minimal action registry map for CLI/MCP parity.
- Document capability manifest mapping to Kit actions.
