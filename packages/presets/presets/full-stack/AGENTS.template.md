# AGENTS.md

Bun-first TypeScript monorepo. Tests before code. Result types, not exceptions.

## Commands

```bash
# Root (all packages)
bun run build        # Build all packages (Bun workspaces)
bun run dev          # Dev mode for all packages
bun run test         # Test all packages
bun run typecheck    # TypeScript validation
bun run check        # Lint checks (all packages)
bun run lint:fix     # Auto-fix lint issues (all packages)
bun run format       # Auto-fix formatting (all packages)
bun run verify:ci    # Full CI validation (typecheck + check + build + test)

# Single package
bun run --filter={{packageName}}-core build
bun run --filter={{packageName}}-core test
cd packages/core && bun test
```

## Architecture

Monorepo with shared core library, CLI app, and MCP server.

### Project Structure

- `packages/core/` — Shared handlers and types (library)
- `apps/cli/` — CLI application (thin adapter over core handlers)
- `apps/mcp/` — MCP server (thin adapter over core handlers)

### Handler Contract

All domain logic lives in `packages/core/` as transport-agnostic handlers returning `Result<T, E>`:

```typescript
async function handler(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Output, ValidationError>>;
```

CLI and MCP are thin adapters over shared handlers. Write the handler once in core, expose it everywhere.

### Action Registry

Actions are defined in `packages/core/src/actions.ts` using `defineAction()` from `@outfitter/contracts`. Each action declares its input schema, surfaces (cli, mcp), and handler. CLI and MCP apps wire from the same action definitions.

### Adding a Feature

1. Define types and Zod schema in `packages/core/src/types.ts`
2. Implement handler in `packages/core/src/handlers.ts` returning `Result<T, E>`
3. Define action in `packages/core/src/actions.ts` with `defineAction()` — specify `cli` and `mcp` surface configs
4. Register action in `createRegistry()` in `packages/core/src/actions.ts`
5. Add tests in `packages/core/src/<name>.test.ts`
6. Wire CLI command in `apps/cli/src/cli.ts` from the action definition
7. Wire MCP tool in `apps/mcp/src/mcp.ts` from the action definition

## Development Principles

- **TDD-First** — Write the test before the code (Red / Green / Refactor)
- **Result Types** — Handlers return `Result<T, E>`, not exceptions
- **Bun-First** — Use Bun-native APIs before npm packages
- **Strict TypeScript** — No `any`, no `as` casts; narrow instead of assert

## Testing

- Runner: Bun test runner
- Files: `src/*.test.ts` within each package
- Run: `bun test` (per package) or `bun run test` (all packages from root)

## Troubleshooting

- **Type errors across packages**: Run `bun run typecheck` from the root. Ensure dependent packages are built first (`bun run build`).
- **Changes in core not reflected in CLI/MCP**: Rebuild core (`bun run --filter={{packageName}}-core build`) or use `bun run dev` for watch mode across all packages.
- **Workspace dependency not found**: Check that the dependency is listed with `"workspace:*"` in the consuming package's `package.json`.
- **Lint failures**: Run `bun run lint:fix` from the root to auto-fix all packages. For format issues, run `bun run format`.
- **Tests failing**: Run `bun test` in the specific package directory for better error output than `verify:ci`.
