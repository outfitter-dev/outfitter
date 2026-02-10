# Logging Patterns

Deep dive into @outfitter/logging patterns. Two layers: `@outfitter/contracts/logging` defines the interfaces, `@outfitter/logging` provides the implementation.

## Creating a Logger

```typescript
import { createLogger, createConsoleSink } from "@outfitter/logging";

const logger = createLogger({
  name: "my-app",
  level: "info",
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});
```

## Log Levels

| Level | Method | Use For |
|-------|--------|---------|
| `trace` | `logger.trace()` | Very detailed debugging |
| `debug` | `logger.debug()` | Development debugging |
| `info` | `logger.info()` | Normal operations |
| `warn` | `logger.warn()` | Unexpected but handled |
| `error` | `logger.error()` | Failures requiring attention |
| `fatal` | `logger.fatal()` | Unrecoverable failures |
| `silent` | — | Disables all output (filter only) |

Level hierarchy: `trace` < `debug` < `info` < `warn` < `error` < `fatal`

Setting level to `info` hides `trace` and `debug`.

## Structured Logging

Always use metadata objects (message first, metadata second):

```typescript
// GOOD: Structured metadata
logger.info("User created", {
  userId: user.id,
  email: user.email,
  duration: performance.now() - start,
});

// BAD: String concatenation
logger.info("User " + user.name + " created in " + duration + "ms");

// BAD: Metadata first (TypeScript resolves to `never`)
logger.info({ userId: user.id }, "User created"); // compile error
```

## Child Loggers

Add context that persists across calls:

```typescript
// Method on LoggerInstance
const requestLogger = logger.child({ requestId: ctx.requestId });

// Or standalone function
import { createChildLogger } from "@outfitter/logging";

const requestLogger = createChildLogger(logger, {
  requestId: ctx.requestId,
  handler: "createUser",
});

// All logs include requestId and handler
requestLogger.info("Processing");
requestLogger.debug("Validated input");
```

## Redaction

### Enable Redaction

```typescript
const logger = createLogger({
  name: "my-app",
  level: "info",
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});

logger.info("Config", {
  apiKey: "secret-123",     // Logged as "[REDACTED]"
  password: "hunter2",      // Logged as "[REDACTED]"
  email: "user@example.com" // Not redacted
});
```

### Default Sensitive Keys

Always redacted (case-insensitive): `password`, `secret`, `token`, `apikey`

### Default Patterns

Automatically matched and redacted in string values:
- Bearer tokens (`Bearer xxx`)
- API key patterns (`api_key=xxx`, `apikey: xxx`)
- GitHub tokens (`ghp_`, `gho_`, `ghs_`, `ghr_`)
- PEM-encoded private keys

### Custom Patterns

```typescript
import { DEFAULT_PATTERNS, configureRedaction } from "@outfitter/logging";

// Per-logger
const logger = createLogger({
  name: "my-app",
  redaction: {
    enabled: true,
    patterns: [/my-custom-secret-\w+/gi],
    keys: ["privateKey", "credentials"],
    replacement: "***", // default: "[REDACTED]"
  },
});

// Global (applies to all loggers)
configureRedaction({
  patterns: [/sk-[a-zA-Z0-9]{20,}/g],
  keys: ["myCustomKey"],
});
```

### Deep Redaction

Nested values are also redacted:

```typescript
logger.info("Request", {
  headers: {
    authorization: "Bearer token",  // Redacted
  },
  body: {
    user: {
      password: "secret",  // Redacted
    },
  },
});
```

## Sinks

### Console Sink

```typescript
import { createConsoleSink } from "@outfitter/logging";

// Auto-detect TTY for colors (default)
const sink = createConsoleSink();

// Force colors off (for CI/piped output)
const plainSink = createConsoleSink({ colors: false });

// Force colors on
const colorSink = createConsoleSink({ colors: true });
```

Routes to `console.error`/`console.warn`/`console.info`/`console.debug` based on level.

### File Sink

```typescript
import { createFileSink } from "@outfitter/logging";

const fileSink = createFileSink({
  path: "/var/log/myapp/app.log",
  append: true,  // default: true (append to existing)
});

// Call flush() before exit to ensure buffered writes complete
await flush();
```

### Formatters

```typescript
import { createJsonFormatter, createPrettyFormatter } from "@outfitter/logging";

// JSON (machine-readable)
const jsonFormatter = createJsonFormatter();
// → {"timestamp":1705936800000,"level":"info","message":"Hello",...}

// Pretty (human-readable)
const prettyFormatter = createPrettyFormatter({
  colors: true,     // ANSI colors (default: false)
  timestamp: true,  // ISO 8601 timestamp (default: true)
});
// → 2024-01-22T12:00:00.000Z [INFO] my-service: Hello world

// Custom sink with formatter
const customSink: Sink = {
  formatter: jsonFormatter,
  write(record, formatted) {
    sendToService(formatted ?? jsonFormatter.format(record));
  },
  async flush() {
    await flushPendingRequests();
  },
};
```

### Multiple Sinks

```typescript
const logger = createLogger({
  name: "my-app",
  level: "debug",
  sinks: [
    createConsoleSink(),
    createFileSink({ path: "/var/log/myapp/debug.log" }),
  ],
});
```

### Runtime Sink Management

```typescript
// Add sink at runtime
logger.addSink(createFileSink({ path: "/tmp/debug.log" }));

// Change level at runtime
logger.setLevel("debug");
```

## Flushing

```typescript
import { flush } from "@outfitter/logging";

logger.info("Shutting down");
await flush(); // Flushes ALL registered sinks
process.exit(0);
```

## Logger Factory Contract

The `@outfitter/contracts/logging` module defines backend-agnostic logger interfaces:

```typescript
import {
  type Logger,
  type LoggerFactory,
  type LoggerAdapter,
  createLoggerFactory,
} from "@outfitter/contracts";

// Logger — minimal surface for handler contexts
interface Logger {
  trace(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  fatal(message: string, metadata?: LogMetadata): void;
  child(context: LogMetadata): Logger;
}

// LoggerFactory — creates loggers with configuration
interface LoggerFactory<TBackendOptions = unknown> {
  createLogger(config: LoggerFactoryConfig<TBackendOptions>): Logger;
  flush(): Promise<void>;
}

// LoggerAdapter — backend implementations provide this
interface LoggerAdapter<TBackendOptions = unknown> {
  createLogger(config: LoggerFactoryConfig<TBackendOptions>): Logger;
  flush?(): Promise<void>;
}

// Create a factory from any adapter
const factory = createLoggerFactory(myAdapter);
```

## Outfitter Logger Factory

`@outfitter/logging` provides a ready-made factory with environment defaults and redaction:

```typescript
import { createOutfitterLoggerFactory } from "@outfitter/logging";

const factory = createOutfitterLoggerFactory({
  defaults: {
    sinks: [createConsoleSink()],
    redaction: { enabled: true },
  },
});

const logger = factory.createLogger({
  name: "my-handler",
  context: { service: "api" },
});

// Clean up
await factory.flush();
```

Defaults applied by the factory:
- Log level resolved via `resolveOutfitterLogLevel()` (environment-aware)
- Redaction enabled by default
- Console sink when no explicit sinks provided

## Environment-Aware Log Level

### resolveLogLevel

Resolves log level from the environment with a precedence chain:

```typescript
import { createLogger, resolveLogLevel } from "@outfitter/logging";

const logger = createLogger({
  name: "my-app",
  level: resolveLogLevel(), // environment-aware
  sinks: [createConsoleSink()],
});
```

**Precedence (highest wins):**

1. `OUTFITTER_LOG_LEVEL` environment variable
2. Explicit `level` parameter
3. `OUTFITTER_ENV` environment profile defaults
4. `"info"` (default)

### Environment Profiles

| `OUTFITTER_ENV` | Default logLevel |
|-----------------|-----------------|
| `development` | `"debug"` |
| `production` | `null` (falls through to `"info"`) |
| `test` | `null` (falls through to `"info"`) |

### resolveOutfitterLogLevel

Same as `resolveLogLevel` but defaults to `"silent"` when the profile disables logging:

```typescript
import { resolveOutfitterLogLevel } from "@outfitter/logging";

// With OUTFITTER_ENV=production → "silent" (not "info")
// With OUTFITTER_ENV=development → "debug"
// With OUTFITTER_LOG_LEVEL=error → "error" (overrides everything)
```

Used internally by the Outfitter logger factory.

## Handler Context Integration

```typescript
import { createOutfitterLoggerFactory, createConsoleSink } from "@outfitter/logging";

const factory = createOutfitterLoggerFactory({
  defaults: { sinks: [createConsoleSink()] },
});

const logger = factory.createLogger({
  name: "my-app",
  context: { service: "api" },
});

// In handler
const myHandler: Handler<Input, Output, Error> = async (input, ctx) => {
  ctx.logger.info("Processing", { input });  // Includes requestId via context
};
```

## Best Practices

1. **Structured metadata** — Always use objects, not string concatenation
2. **Child loggers** — Add request context that persists
3. **Enable redaction** — Prevent secrets from leaking
4. **Use `resolveLogLevel()`** — Let the environment control verbosity
5. **Request IDs** — Include for tracing across handlers
6. **Flush before exit** — Call `flush()` to ensure buffered logs are written
