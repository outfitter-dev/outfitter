# Navigator → Outfitter Migration

**Date**: 2026-01-25
**Status**: Draft (verified 2026-01-25)

## Snapshot
- **Repo**: `/Users/mg/Developer/outfitter/navigator`
- **Shape**: Monorepo (`packages/*`) + extension package
- **Workspaces**: `packages/*`
- **Runtime**: Bun + TypeScript (ESM)
- **Tooling**: Biome 1.9.4 (single quotes), Bun test, Turbo-style scripts
- **Surfaces** (in scope):
  - CLI: `nav` (`packages/cli/src/index.ts`)
  - MCP: `navigator-mcp` (`packages/mcp/src/index.ts`)
  - HTTP server: `packages/server/src/index.ts`
- **Out of scope**:
  - Extension: `packages/extension` (browser surface, separate concerns)
  - Agents: `packages/agents` (content-only, no package.json)

## Key Entrypoints
- **CLI**: `packages/cli/src/index.ts`
- **MCP**: `packages/mcp/src/index.ts`
- **Server**: `packages/server/src/index.ts`
- **Core schema**: `packages/core/src/schema/*`
- **Capability manifest**: `packages/core/src/capabilities/manifest.ts`

## Outfitter Deltas
- **Formatting**: Biome 1.9.4 (single quotes, semicolons as-needed) vs Outfitter 2.x (tabs, double quotes, semicolons always).
- **Handler contract**: core + server use ad-hoc patterns, not Outfitter Result/error taxonomy.
- **Adapters**: CLI/MCP use raw Commander + MCP SDK directly.
- **Commander**: v13 (Outfitter prefers v14+).
- **Prompt/spinner stack**: `@inquirer/select` + `ora` vs Outfitter `@clack/prompts`.
- **Tests**: `packages/*/tests` vs `src/__tests__` layout.
- **TS strict flags**: Missing `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.

## Migration Plan (Phased)
### Phase 0 — Inventory
- Map commands/tools to core actions + capability manifest.
- Identify shared handler candidates across CLI/MCP/server.
- Define extension integration boundaries (in-scope vs out-of-scope).

### Phase 1 — Tooling Alignment
- Align Biome config to Outfitter conventions.
- Normalize scripts to Outfitter baseline (build/test/typecheck/lint/format).
- Decide on test layout migration or tooling compatibility.

### Phase 2 — Handler Contract
- Refactor core actions to Outfitter Result/error taxonomy.
- Introduce handler layer shared by CLI/MCP/server.
- Add handler unit tests using `@outfitter/testing`.

### Phase 3 — CLI + MCP Adapters
- Replace CLI wiring with `@outfitter/cli`.
- Replace MCP wiring with `@outfitter/mcp` tool registry.
- Preserve capability manifest as source-of-truth; map to Outfitter action registry.

### Phase 4 — Verification
- Run `bun run test` and focused CLI/MCP smoke tests.
- Validate HTTP server behavior unchanged.
- Ensure extension continues to function if out of migration scope.

## Risks / Decisions
- **Extension scope**: Decided — out of scope. Leave untouched with separate tooling/release cycle.
- **Capability manifest**: align existing manifest to Outfitter action registry or keep separate.
- **Formatting**: large diff risk (Biome 1.x → 2.x major upgrade); consider a formatting-only PR.
- **Prompt stack replacement**: UX may change when moving to `@clack/prompts`.

## Quick Wins
- Introduce Outfitter contracts layer without refactoring transports.
- Add a minimal action registry map for CLI/MCP parity.
- Document capability manifest mapping to Outfitter actions.
