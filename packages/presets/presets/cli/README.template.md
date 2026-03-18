# {{projectName}}

{{description}}

## Installation

```bash
# Run directly
bunx {{packageName}}

# Or install globally
bun add -g {{packageName}}
```

## Usage

```bash
{{binName}} hello World
```

```json
{
  "ok": true,
  "command": "hello",
  "result": { "message": "Hello, World!" }
}
```

```bash
{{binName}} --help
```

## Architecture

Handlers are pure functions returning `Result<T, E>`. CLI commands are thin adapters. See `AGENTS.md` for the full handler contract and project conventions.

## Development

```bash
bun install            # Install dependencies
bun run dev            # Run in development
bun run build          # Build
bun run test           # Run tests
bun run verify:ci      # Full CI validation
```

## License

MIT
