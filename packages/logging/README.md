# @outfitter/logging

Structured logging via logtape with automatic sensitive data redaction. Provides consistent log formatting across CLI, MCP, and server contexts.

## Installation

```bash
bun add @outfitter/logging
```

## Quick Start

```typescript
import {
  createLogger,
  createConsoleSink,
  configureRedaction,
} from "@outfitter/logging";

// Configure global redaction (optional - defaults already cover common sensitive keys)
configureRedaction({
  keys: ["apiKey", "accessToken"],
  patterns: [/sk-[a-zA-Z0-9]+/g],
});

// Create a logger
const logger = createLogger({
  name: "my-service",
  level: "debug",
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});

// Log with metadata
logger.info("Request received", {
  path: "/api/users",
  apiKey: "secret-key-123", // Will be redacted to "[REDACTED]"
});
```

## Log Levels

| Level    | Priority | Use For                                    |
| -------- | -------- | ------------------------------------------ |
| `trace`  | 0        | Very detailed debugging (loops, internals) |
| `debug`  | 1        | Development debugging                      |
| `info`   | 2        | Normal operations                          |
| `warn`   | 3        | Unexpected but handled situations          |
| `error`  | 4        | Failures requiring attention               |
| `fatal`  | 5        | Unrecoverable failures                     |
| `silent` | 6        | Disable all logging                        |

Messages are filtered by minimum level. Setting `level: "warn"` filters out `trace`, `debug`, and `info`.

```typescript
const logger = createLogger({
  name: "app",
  level: "warn", // Only warn, error, fatal will be logged
  sinks: [createConsoleSink()],
});

logger.debug("Filtered out");
logger.warn("This appears");
```

### Changing Level at Runtime

```typescript
logger.setLevel("debug"); // Enable debug logging
logger.setLevel("silent"); // Disable all logging
```

## Redaction

Automatic redaction protects sensitive data from appearing in logs.

### Default Sensitive Keys

These keys are redacted by default (case-insensitive matching):

- `password`
- `secret`
- `token`
- `apikey`

### Custom Redaction Patterns

```typescript
configureRedaction({
  patterns: [
    /Bearer [a-zA-Z0-9._-]+/g, // Bearer tokens
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI keys
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub PATs
  ],
  keys: ["credentials", "privateKey"],
});
```

### Per-Logger Redaction

```typescript
const logger = createLogger({
  name: "auth",
  redaction: {
    enabled: true,
    patterns: [/custom-secret-\d+/g],
    keys: ["myCustomKey"],
    replacement: "***", // Custom replacement (default: "[REDACTED]")
  },
});
```

### Nested Object Redaction

Redaction is recursive and applies to nested objects:

```typescript
logger.info("Config loaded", {
  database: {
    host: "localhost",
    password: "super-secret", // Redacted
  },
  api: {
    url: "https://api.example.com",
    token: "jwt-token", // Redacted
  },
});
// Output: { database: { host: "localhost", password: "[REDACTED]" }, ... }
```

## Child Loggers

Create scoped loggers that inherit parent configuration and merge context:

```typescript
const parent = createLogger({
  name: "app",
  context: { service: "api" },
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});

const child = createChildLogger(parent, { handler: "getUser" });

child.info("Processing request");
// Output includes merged context: { service: "api", handler: "getUser" }
```

Child loggers:

- Inherit parent's sinks, level, and redaction config
- Merge context (child overrides parent for conflicting keys)
- Share the same `setLevel()` and `addSink()` behavior

## Formatters

### JSON Formatter

Machine-readable output for log aggregation:

```typescript
import { createJsonFormatter } from "@outfitter/logging";

const formatter = createJsonFormatter();
// Output: {"timestamp":1705936800000,"level":"info","category":"app","message":"Hello","userId":"123"}
```

### Pretty Formatter

Human-readable output with optional ANSI colors:

```typescript
import { createPrettyFormatter } from "@outfitter/logging";

const formatter = createPrettyFormatter({ colors: true, timestamp: true });
// Output: 2024-01-22T12:00:00.000Z [INFO] app: Hello {"userId":"123"}
```

## Sinks

### Console Sink

Routes logs to stdout/stderr based on level:

- `trace`, `debug`, `info` -> stdout
- `warn`, `error`, `fatal` -> stderr
 - Falls back to `console.*` when process streams are unavailable (edge/serverless)

```typescript
import { createConsoleSink } from "@outfitter/logging";

const logger = createLogger({
  name: "app",
  sinks: [createConsoleSink()],
});

// Use JSON formatting instead of the default pretty formatter
const jsonLogger = createLogger({
  name: "app",
  sinks: [createConsoleSink({ formatter: createJsonFormatter() })],
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `colors` | `boolean` | auto-detect | Enable ANSI colors |
| `formatter` | `Formatter` | `createPrettyFormatter()` | Custom log formatter |

### File Sink

Buffered writes to a file path:

```typescript
import { createFileSink, flush } from "@outfitter/logging";

const logger = createLogger({
  name: "app",
  sinks: [createFileSink({ path: "/var/log/app.log" })],
});

logger.info("Application started");

// Call flush() before exit to ensure all logs are written
await flush();
```

### Custom Sinks

Implement the `Sink` interface for custom destinations:

```typescript
import type { Sink, LogRecord, Formatter } from "@outfitter/logging";

const customSink: Sink = {
  formatter: createJsonFormatter(), // Optional
  write(record: LogRecord, formatted?: string): void {
    // Send to your destination
    sendToRemote(formatted ?? JSON.stringify(record));
  },
  async flush(): Promise<void> {
    // Optional: ensure pending writes complete
    await flushPendingWrites();
  },
};
```

### Multiple Sinks

Logs can be sent to multiple destinations:

```typescript
const logger = createLogger({
  name: "app",
  sinks: [
    createConsoleSink(),
    createFileSink({ path: "/var/log/app.log" }),
    customRemoteSink,
  ],
});
```

## Structured Metadata

### Basic Metadata

```typescript
logger.info("User logged in", {
  userId: "u123",
  email: "user@example.com",
});
```

### Error Serialization

Error objects are automatically serialized with name, message, and stack:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error("Operation failed", { error });
  // error is serialized as: { name: "Error", message: "...", stack: "..." }
}
```

### Context Inheritance

Logger context is merged with per-call metadata:

```typescript
const logger = createLogger({
  name: "api",
  context: { requestId: "abc123" },
  sinks: [createConsoleSink()],
});

logger.info("Processing", { step: 1 });
// Metadata: { requestId: "abc123", step: 1 }
```

## Flushing

Call `flush()` before process exit to ensure buffered logs are written:

```typescript
import { flush } from "@outfitter/logging";

process.on("beforeExit", async () => {
  await flush();
});

// Or before explicit exit
logger.info("Shutting down");
await flush();
process.exit(0);
```

## Environment-Aware Log Level

### `resolveLogLevel(level?)`

Resolve the log level from environment configuration. Use this instead of hardcoding levels so your app responds to `OUTFITTER_ENV` and `OUTFITTER_LOG_LEVEL` automatically.

Accepts `LogLevel` or a plain `string` — useful when forwarding CLI flags or MCP values without casting. Invalid strings are ignored and fall through to the next precedence level.

**Precedence** (highest wins):
1. `OUTFITTER_LOG_LEVEL` environment variable
2. Explicit `level` parameter
3. `OUTFITTER_ENV` profile defaults (`"debug"` in development)
4. `"info"` (default)

```typescript
import { createLogger, resolveLogLevel } from "@outfitter/logging";

const logger = createLogger({
  name: "my-app",
  level: resolveLogLevel(),
  sinks: [createConsoleSink()],
});

// With OUTFITTER_ENV=development → "debug"
// With OUTFITTER_LOG_LEVEL=error → "error" (overrides everything)
// With nothing set → "info"

// Forward a CLI string without casting
const level = flags.logLevel; // string from commander
const logger2 = createLogger({
  name: "cli",
  level: resolveLogLevel(level),
  sinks: [createConsoleSink()],
});
```

MCP-style level names are mapped automatically: `warning` to `warn`, `emergency`/`critical`/`alert` to `fatal`, `notice` to `info`.

### Edge Runtime Compatibility

`resolveLogLevel` and `createConsoleSink` are safe to use in environments where `process` is unavailable (V8 isolates, Cloudflare Workers, edge runtimes). Environment variable reads are guarded and environment profile resolution falls back gracefully to defaults.

## Logger Factory + BYO Backends

Use the Outfitter logger factory when wiring runtimes (CLI, MCP, daemons). It applies Outfitter defaults for log level resolution and redaction.

```typescript
import { createOutfitterLoggerFactory } from "@outfitter/logging";

const factory = createOutfitterLoggerFactory();
const logger = factory.createLogger({
  name: "mcp",
  context: { surface: "mcp" },
});

logger.info("Tool invoked", { tool: "search" });
await factory.flush();
```

If you need a different backend, you can use the shared contracts factory with your own adapter and still satisfy the same `Logger` interface expected by Outfitter packages.

```typescript
import {
  createLoggerFactory,
  type Logger,
  type LoggerAdapter,
} from "@outfitter/contracts";

type BackendOptions = { write: (line: string) => void };

const adapter: LoggerAdapter<BackendOptions> = {
  createLogger(config) {
    const write = config.backend?.write ?? (() => {});
    const createMethod = (level: string): Logger["info"] =>
      ((message: string) => {
        write(`[${level}] ${message}`);
      }) as Logger["info"];

    return {
      trace: createMethod("trace"),
      debug: createMethod("debug"),
      info: createMethod("info"),
      warn: createMethod("warn"),
      error: createMethod("error"),
      fatal: createMethod("fatal"),
      child: () => adapter.createLogger(config),
    };
  },
};

const customFactory = createLoggerFactory(adapter);
const customLogger = customFactory.createLogger({
  name: "custom-runtime",
  backend: { write: (line) => console.log(line) },
});

customLogger.info("Hello from custom backend");
```

## Runtime Compatibility

| Export | Node.js | Bun | Edge/V8 Isolates | Notes |
|---|---|---|---|---|
| `createLogger` | Yes | Yes | Yes | Universal |
| `createConsoleSink` | Yes | Yes | Yes | Falls back to `console.*` when `process` unavailable |
| `createFileSink` | No | Yes | No | Requires `Bun.file` / `Bun.write` |
| `createJsonFormatter` | Yes | Yes | Yes | Universal |
| `createPrettyFormatter` | Yes | Yes | Yes | Universal |
| `resolveLogLevel` | Yes | Yes | Yes | Guards `process.env` access |
| `resolveOutfitterLogLevel` | Yes | Yes | Yes | Guards `process.env` access |
| `configureRedaction` | Yes | Yes | Yes | Universal |
| `flush` | Yes | Yes | Yes | Universal |

Edge-runtime notes:
- `resolveLogLevel()` safely returns defaults when `process` is undefined
- `createConsoleSink()` auto-detects TTY via `process.stdout?.isTTY` with graceful fallback

## API Reference

### Functions

| Function                | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `createLogger`          | Create a configured logger instance                 |
| `createChildLogger`     | Create a child logger with merged context           |
| `resolveLogLevel`       | Resolve log level from env vars and profile         |
| `configureRedaction`    | Configure global redaction patterns and keys        |
| `flush`                 | Flush all pending log writes across all sinks       |
| `createJsonFormatter`   | Create a JSON formatter for structured output       |
| `createPrettyFormatter` | Create a human-readable formatter with colors       |
| `createConsoleSink`     | Create a console sink (stdout/stderr routing)       |
| `createFileSink`        | Create a file sink with buffered writes             |

### Types

| Type                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `LogLevel`               | Union of log level strings                      |
| `LogRecord`              | Structured log record with timestamp/metadata   |
| `LoggerConfig`           | Configuration options for `createLogger`        |
| `LoggerInstance`         | Logger interface with level methods             |
| `RedactionConfig`        | Per-logger redaction configuration              |
| `GlobalRedactionConfig`  | Global redaction patterns and keys              |
| `Formatter`              | Interface for log record formatting             |
| `Sink`                   | Interface for log output destinations           |
| `PrettyFormatterOptions` | Options for human-readable formatter            |
| `FileSinkOptions`        | Options for file sink configuration             |

## Upgrading

Run `outfitter update --guide` for version-specific migration instructions, or check the [migration docs](https://github.com/outfitter-dev/outfitter/tree/main/plugins/outfitter/shared/migrations) for detailed upgrade steps.

## License

MIT
