# {{projectName}}

{{description}}

## Workspace Layout

```text
{{projectName}}/
├── apps/
│   ├── cli/    # CLI surface
│   └── mcp/    # MCP server surface
└── packages/
    └── core/   # Shared handler layer
```

## Usage

### CLI

```bash
{{projectName}} greet World
```

```json
{
  "ok": true,
  "command": "greet",
  "result": { "message": "Hello, World." }
}
```

### MCP Server

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "{{projectName}}": {
      "command": "bun",
      "args": [
        "run",
        "/absolute/path/to/{{projectName}}/apps/mcp/src/server.ts"
      ]
    }
  }
}
```

## Architecture

Handlers in `packages/core` are pure functions returning `Result<T, E>`. CLI and MCP are thin adapters over the same logic. See `AGENTS.md` for the full handler contract and project conventions.

## Development

```bash
bun install            # Install dependencies for all workspace members
bun run build          # Build all packages
bun run typecheck      # Typecheck all packages
bun run test           # Run all tests
bun run verify:ci      # Full CI validation
```

## License

MIT
