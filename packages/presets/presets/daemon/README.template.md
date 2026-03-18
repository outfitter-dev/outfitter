# {{projectName}}

{{description}}

A background daemon with CLI control interface.

## Usage

```bash
{{binName}} start              # Start daemon in background
{{binName}} start --foreground # Start in foreground (for debugging)
{{binName}} status             # Check status
{{binName}} health             # Check health (errors if daemon is down)
{{binName}} stop               # Stop daemon
```

Starting an already-running daemon returns a `conflict` error with a non-zero exit code.

## Endpoints

The daemon exposes a Unix socket with the following endpoints:

### GET /health

```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "{{version}}"
}
```

### POST /shutdown

Gracefully shuts down the daemon.

## Architecture

The daemon handler layer is transport-agnostic, returning `Result<T, E>`. The CLI and socket server are thin adapters. See `AGENTS.md` for the full handler contract and project conventions.

## Development

```bash
bun install            # Install dependencies
bun run dev            # Run daemon in foreground
bun run build          # Build
bun run test           # Run tests
bun run verify:ci      # Full CI validation
```

> **Note:** Background spawn requires a build. Use `--foreground` or `bun run dev` during development.

## License

MIT
