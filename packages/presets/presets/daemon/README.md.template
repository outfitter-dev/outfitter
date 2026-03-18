# {{projectName}}

{{description}}

A background daemon with CLI control interface.

## Usage

```bash
# Start daemon in background
{{binName}} start

# Start daemon in foreground (for debugging)
{{binName}} start --foreground

# Check status
{{binName}} status

# Check health (returns error if daemon is down)
{{binName}} health

# Stop daemon
{{binName}} stop
```

## Endpoints

The daemon exposes a Unix socket with the following endpoints:

### GET /health

Returns daemon health information:

```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "{{version}}"
}
```

### POST /shutdown

Gracefully shuts down the daemon.

## Development

```bash
# Install dependencies
bun install

# Run from source (foreground only — background spawn requires a build)
bun run src/cli.ts start --foreground
bun run src/cli.ts status
bun run src/cli.ts stop

# Run daemon in foreground (via dev script)
bun run dev

# Build
bun run build

# Run tests
bun run test
```

## License

MIT
