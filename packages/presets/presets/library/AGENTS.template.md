# AGENTS.md

Bun-first TypeScript library. Tests before code. Result types, not exceptions.

## Commands

```bash
bun run build        # Build library with bunup (ESM + types)
bun run dev          # Watch mode
bun run test         # Run tests
bun run typecheck    # TypeScript validation
bun run check        # Lint + format check (ultracite)
bun run lint         # Lint checks (oxlint)
bun run lint:fix     # Auto-fix lint issues
bun run format       # Auto-fix formatting (oxfmt)
bun run verify:ci    # Full CI validation (typecheck + check + build + test)
```

## Architecture

Publishable TypeScript library built with Bun and bunup.

### Project Structure

- `src/types.ts` — Zod schemas with explicit `ZodType` annotations + TypeScript interfaces
- `src/handlers.ts` — Pure handler functions returning `Result<T, E>`
- `src/index.ts` — Re-exports from types + handlers
- `src/index.test.ts` — Tests with `createContext()`, testing success + error paths

### Handler Contract

All domain logic uses transport-agnostic handlers returning `Result<T, E>`:

```typescript
async function handler(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<Output, ValidationError>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return Result.err(new ValidationError({ message: "...", field: "name" }));
  }
  // business logic
  return Result.ok(result);
}
```

### Schema Convention

Exported Zod schemas must have explicit type annotations:

```typescript
export const inputSchema: ZodType<Input> = z.object({ ... });
```

## Development Principles

- **TDD-First** — Write the test before the code (Red / Green / Refactor)
- **Result Types** — Handlers return `Result<T, E>`, not exceptions
- **Bun-First** — Use Bun-native APIs before npm packages
- **Strict TypeScript** — No `any`, no `as` casts; narrow instead of assert

## Testing

- Runner: Bun test runner
- Files: `src/*.test.ts`
- Run: `bun test` or `bun run test`
- Test handlers with `createContext()` from `@outfitter/contracts`

## Troubleshooting

- **Build fails with bunup**: Check `bunup.config.ts` for correct entry points. Ensure `src/index.ts` re-exports everything consumers need.
- **Type errors after adding a dependency**: Run `bun run typecheck` to see full errors. Check that new deps are in `dependencies`, not just `devDependencies`.
- **Consumers can't import types**: Verify the package has `"types"` in its `package.json` exports map and that bunup is generating `.d.ts` files.
- **Lint failures**: Run `bun run lint:fix` to auto-fix. For format issues, run `bun run format`.
- **Tests failing**: Run `bun test` directly for better error output than `verify:ci`.
