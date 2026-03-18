# {{projectName}}

{{description}}

## Usage

```typescript
import { greet } from "{{packageName}}";
import { createContext } from "@outfitter/contracts";

const ctx = createContext({ cwd: process.cwd(), env: process.env });
const result = await greet({ name: "World" }, ctx);

if (result.isOk()) {
  console.log(result.value.message);
  // => "Hello, World!"
} else {
  console.error(result.error.message);
}
```

## Architecture

Handlers return `Result<T, E>` instead of throwing exceptions. See `AGENTS.md` for project conventions.

## Development

```bash
bun install            # Install dependencies
bun run dev            # Run in development
bun run build          # Build for production
bun test               # Run tests
bun run typecheck      # Type checking
bun run verify:ci      # Full CI validation
```

## License

MIT
