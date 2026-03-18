# AGENTS.md

Bun-first TypeScript daemon. Tests before code. Result types, not exceptions.

## Commands

```bash
bun run build        # Build CLI + daemon to dist/
bun run dev          # Watch mode (foreground)
bun run dev:daemon   # Watch mode (foreground, explicit)
bun run test         # Run tests
bun run typecheck    # TypeScript validation
bun run check        # Lint + format check
bun run lint:fix     # Auto-fix lint issues
bun run format       # Auto-fix formatting
bun run verify:ci    # Full CI validation (typecheck + check + build + test)
```

## Architecture

Background daemon with CLI control interface, built with `@outfitter/daemon` and `@outfitter/cli`.

### Project Structure

- `src/daemon.ts` — Daemon entry point (background process)
- `src/daemon-main.ts` — Daemon lifecycle and HTTP server (Unix socket)
- `src/cli.ts` — CLI control commands (start, stop, status)
- `src/index.ts` — Library re-exports

### Daemon Lifecycle

The daemon uses `createDaemon()` from `@outfitter/daemon` for lifecycle management (PID files, signal handlers, graceful shutdown) with `Bun.serve()` on a Unix socket for the HTTP API:

- **start** — Checks liveness via `isDaemonAlive()`, spawns background process (or runs in foreground with `--foreground`)
- **stop** — Checks liveness, then sends POST to `/shutdown` endpoint which triggers `daemon.stop()`
- **status** — Checks liveness via `isDaemonAlive()`, then fetches `/health` for uptime and version
- **health** — Checks liveness, then fetches `/health` endpoint directly (returns error if down)

### CLI Adapter Pattern

CLI commands use `runHandler()` from `@outfitter/cli/envelope` to wrap daemon operations. Each command's handler returns `Result<T, E>`, and `runHandler()` produces structured output envelopes with exit codes, error categories, and agent-friendly hints.

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

- **Daemon won't start**: Check for stale lock/socket files. Run `{{binName}} status` to check liveness, then `{{binName}} stop` before retrying.
- **"Address already in use" errors**: Another instance may be running. Check with `{{binName}} status` or look for leftover Unix socket files in the XDG runtime directory.
- **Background spawn fails but foreground works**: Background mode requires a built binary. Run `bun run build` first, then `{{binName}} start`.
- **Type errors after adding a dependency**: Run `bun run typecheck` to see full errors. Check that new deps are in `dependencies`, not just `devDependencies`.
- **Tests failing**: Run `bun test` directly for better error output than `verify:ci`.
