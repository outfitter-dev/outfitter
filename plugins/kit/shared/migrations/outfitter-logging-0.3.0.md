---
package: "@outfitter/logging"
version: 0.3.0
breaking: false
---

# @outfitter/logging → 0.3.0

## New APIs

### `resolveLogLevel()`

Resolve effective log level using shared precedence:

1. `OUTFITTER_LOG_LEVEL`
2. Explicit level argument
3. `OUTFITTER_ENV` profile defaults
4. `"info"`

```typescript
import { createLogger, resolveLogLevel } from "@outfitter/logging";

const logger = createLogger({
  name: "app",
  level: resolveLogLevel(),
});
```

### Outfitter Logger Factory Contracts

`@outfitter/logging` now exposes factory helpers aligned with the
contracts-level logger abstraction:

- `createOutfitterLoggerAdapter()`
- `createOutfitterLoggerFactory()`
- `resolveOutfitterLogLevel()`

```typescript
import { createOutfitterLoggerFactory } from "@outfitter/logging";

const factory = createOutfitterLoggerFactory();
const logger = factory.createLogger({ name: "cli" });
await factory.flush();
```

## Migration Steps

### Remove Custom Log-Level Precedence Code

**Before:**

```typescript
const level = process.env["OUTFITTER_LOG_LEVEL"] ?? options.level ?? "info";
```

**After:**

```typescript
import { resolveLogLevel } from "@outfitter/logging";

const level = resolveLogLevel(options.level);
```

### Prefer Factory Integration for Shared Runtimes

If you maintain runtime packages (CLI/MCP/service hosts), use
`createOutfitterLoggerFactory()` to provide consistent defaults and lifecycle
flush behavior.

## No Action Required

- Existing `createLogger()` usage remains compatible
- Existing sink and redaction configuration continues to work
- Message-first logging overloads remain unchanged
