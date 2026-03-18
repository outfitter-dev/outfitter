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

## Development

```bash
# Install dependencies for all workspace members
bun install

# Build all packages
bun run build

# Typecheck all packages
bun run typecheck

# Run all tests
bun run test
```
