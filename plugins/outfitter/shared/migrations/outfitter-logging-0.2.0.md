---
package: "@outfitter/logging"
version: 0.2.0
breaking: false
---

# @outfitter/logging → 0.2.0

## New APIs

### Console Sink Fallback

`createConsoleSink()` provides a ready-to-use sink that routes log messages to the appropriate console method based on severity:

```typescript
import { createConsoleSink } from "@outfitter/logging";

const sink = createConsoleSink({ colors: true });

// Routing:
// fatal, error → console.error()
// warn        → console.warn()
// debug, trace → console.debug()
// info        → console.info()
```

Color support is auto-detected from `process.stdout.isTTY` if not explicitly set.

### Logger Method Overloads

Logger methods now accept both string and structured log arguments:

```typescript
// String message
logger.info("User logged in");

// Structured with context
logger.info("User logged in", { userId: "123", method: "oauth" });
```

## Migration Steps

### Remove top-level `node:*` imports

If you were importing Node.js built-in modules at the top level alongside `@outfitter/logging`, the package no longer relies on top-level `node:*` imports. This improves compatibility with edge runtimes.

**Before:**
```typescript
import { createConsoleSink } from "@outfitter/logging";
// Package internally used: import { Console } from "node:console";
```

**After:**
```typescript
import { createConsoleSink } from "@outfitter/logging";
// Package uses runtime-safe console access
```

This change is transparent — your code doesn't need modification unless you were relying on side effects from the package importing `node:*` modules.

## No Action Required

- Existing logger setup works unchanged
- Redaction patterns (`DEFAULT_PATTERNS`) unchanged
- Sensitive key detection unchanged
- LogTape integration unchanged
