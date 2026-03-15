# {{projectName}}

{{description}}

MCP (Model Context Protocol) server for integration with AI assistants.

## Claude Desktop Configuration

Add to your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "{{projectName}}": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/{{projectName}}/src/server.ts"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path to your project directory.

> **Note:** On macOS, `bun` may not be on Claude Desktop's PATH. If the server fails to start, replace `"bun"` with the full path (e.g., `"/Users/you/.bun/bin/bun"` — run `which bun` to find it).

## Available Tools

### hello

Say hello to someone.

**Parameters:**

- `name` (string, required): Name to greet

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Build
bun run build

# Run tests
bun run test
```

## License

MIT
