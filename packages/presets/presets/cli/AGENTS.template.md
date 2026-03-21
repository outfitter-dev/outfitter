# AGENTS.md

Bun-first TypeScript CLI. Tests before code. Result types, not exceptions.

## Commands

```bash
bun run build        # Build CLI + library to dist/
bun run dev          # Watch mode (auto-restart on changes)
bun run test         # Run tests
bun run typecheck    # TypeScript validation
bun run check        # Lint + format check
bun run lint:fix     # Auto-fix lint issues
bun run format       # Auto-fix formatting
bun run verify:ci    # Full CI validation (typecheck + check + build + test)
```

## Architecture

CLI application built with Commander and `@outfitter/cli`.

### Project Structure

- `src/cli.ts` — Entry point, creates and runs the program
- `src/program.ts` — Command registration and wiring
- `src/commands/` — Command handlers (pure functions returning `Result<T, E>`)
- `src/types.ts` — Zod schemas and TypeScript interfaces

### Handler Contract

All domain logic uses handlers returning `Result<T, E>`:

```typescript
function handler(
  input: Input,
  ctx: HandlerContext
): Promise<Result<Output, Error>>;
```

CLI commands are thin adapters over shared handlers. Use `runHandler()` from `@outfitter/cli/envelope` to wrap handler results in output envelopes.

### Adding a Command

1. Define types and Zod schema in `src/types.ts`
2. Create handler in `src/commands/<name>.ts` returning `Result<T, E>`
3. Wire command in `src/program.ts` using the CommandBuilder pattern
4. Add tests in `src/<name>.test.ts`

### Action Registry Alternative

For projects that use `defineAction()` with an `ActionRegistry` instead of the CommandBuilder pattern, `buildCliCommands` from `@outfitter/cli/actions` converts the registry into Commander commands. Pass `defaultOnResult` to auto-output handler results — without it, success values are silently discarded:

```typescript
import { buildCliCommands, defaultOnResult } from "@outfitter/cli/actions";

for (const command of buildCliCommands(registry, {
  onResult: defaultOnResult,
})) {
  program.register(command);
}
```

Setting `cli.group` on action specs produces automatic subcommand grouping — the action-registry equivalent of `commandGroup()`:

```typescript
defineAction({
  id: "entity.list",
  cli: { group: "entity", command: "list", description: "List entities" },
  // ...
});
// Produces: mycli entity list
```

### Nested Commands

Use `.subcommand()` for fluent nesting or `commandGroup()` for declarative groups:

```typescript
import { command, commandGroup } from "@outfitter/cli/command";

// Fluent style
program.register(
  command("entity")
    .description("Manage entities")
    .subcommand(command("add").description("Add entity").action(handler))
    .subcommand(command("show").description("Show entity").action(handler))
);

// Declarative style
program.register(
  commandGroup("entity", "Manage entities", [
    command("add").description("Add entity").action(handler),
    command("show").description("Show entity").action(handler),
  ])
);
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

## Troubleshooting

- **Type errors after adding a dependency**: Run `bun run typecheck` to see full errors. Check that new deps are in `dependencies`, not just `devDependencies`.
- **Build fails with missing exports**: Ensure new modules are re-exported from `src/index.ts` and listed in `package.json` exports map.
- **Command not showing up**: Check that the command is registered in `src/program.ts` and the handler is imported correctly.
- **Lint failures**: Run `bun run lint:fix` to auto-fix. For format issues, run `bun run format`.
- **Tests failing**: Run `bun test` directly for better error output than `verify:ci`.
