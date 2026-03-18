# {{projectName}}

{{description}}

## Installation

```bash
bun add {{packageName}}
```

## Usage

```typescript
import { createGreeting } from "{{packageName}}";

const result = await createGreeting({ name: "World" });

if (result.ok) {
  console.log(result.value);
  // => { message: "Hello, World!" }
} else {
  console.error(result.error.message);
}
```

### Exports

- `{{packageName}}` — handlers and core logic
- `{{packageName}}/types` — TypeScript type definitions

## Architecture

Handlers return `Result<T, E>` instead of throwing exceptions. See `AGENTS.md` for the handler contract and project conventions.

## Development

```bash
bun install            # Install dependencies
bun run build          # Build CJS + ESM artifacts
bun run typecheck      # Typecheck
bun run test           # Run tests
bun run verify:ci      # Full CI validation
```

## License

MIT
