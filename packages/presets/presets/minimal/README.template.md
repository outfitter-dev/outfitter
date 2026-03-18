# {{projectName}}

{{description}}

## Usage

```typescript
import { greet } from "{{packageName}}";

const result = greet("World");

if (result.isOk()) {
  console.log(result.value.message);
  // => "Hello, World!"
}
```

## Development

```bash
bun install            # Install dependencies
bun run dev            # Run in development
bun run build          # Build
bun test               # Run tests
bun run typecheck      # Type checking
bun run verify:ci      # Full CI validation
```

## License

MIT
