# Patterns

Common conventions and idioms used across Outfitter packages. These patterns ensure consistency and interoperability between CLI, MCP, and API surfaces.

## Handler Contract

The handler contract is the core abstraction. Handlers are pure functions that:
- Accept typed input and context
- Return `Result<TOutput, TError>`
- Know nothing about transport (CLI flags, HTTP headers, etc.)

### Signature

```typescript
type Handler<TInput, TOutput, TError extends OutfitterError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;
```

### Example

```typescript
import { Result, NotFoundError, type Handler, type HandlerContext } from "@outfitter/contracts";

interface GetUserInput {
  id: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export const getUser: Handler<GetUserInput, User, NotFoundError> = async (input, ctx) => {
  ctx.logger.debug("Fetching user", { userId: input.id });

  const user = await db.users.findById(input.id);

  if (!user) {
    return Result.err(new NotFoundError("user", input.id));
  }

  return Result.ok(user);
};
```

### Why This Pattern?

1. **Testability** — No mocking HTTP/CLI, just call the function
2. **Reusability** — Same handler serves CLI, MCP, and HTTP
3. **Type Safety** — Input, output, and error types are explicit
4. **Composability** — Handlers can wrap other handlers

## Logging vs Output

Structured logs are for diagnostics. User-facing output belongs to the transport adapter.

| Context | Use | Why |
| --- | --- | --- |
| Handler internals | `ctx.logger` | Structured traces with redaction |
| CLI success output | `@outfitter/cli` `output()` | Respects `--json/--jsonl` modes |
| CLI errors | `exitWithError()` | Typed formatting + exit codes |
| MCP tool output | `Result.ok(data)` | Transport-agnostic responses |
| MCP diagnostics | `ctx.logger` | Structured traces for debugging |

At the boundary (CLI/MCP/HTTP), create a logger once and inject it via `createContext({ logger })`.

## Result Types

Outfitter uses `Result<T, E>` from `better-result` for explicit error handling.

### Creating Results

```typescript
import { Result } from "@outfitter/contracts";

// Success
const ok = Result.ok({ name: "Alice" });

// Failure
const err = Result.err(new NotFoundError("user", "123"));
```

### Checking Results

```typescript
if (result.isOk()) {
  console.log(result.value); // TypeScript knows this is T
} else {
  console.log(result.error); // TypeScript knows this is E
}
```

### Pattern Matching

```typescript
const message = result.match({
  ok: (user) => `Found ${user.name}`,
  err: (error) => `Error: ${error.message}`,
});
```

### Combining Results

When you have multiple operations that might fail:

```typescript
import { combine2, combine3 } from "@outfitter/contracts";

const result1 = await getUser("1");
const result2 = await getUser("2");

// Combine into tuple [User, User] or first error
const combined = combine2(result1, result2);

if (combined.isOk()) {
  const [user1, user2] = combined.value;
}
```

### Fallback Values

```typescript
import { unwrapOrElse, orElse } from "@outfitter/contracts";

// Default value on error
const user = unwrapOrElse(result, () => defaultUser);

// Try alternative on error
const finalResult = orElse(primaryResult, fallbackResult);
```

## Error Taxonomy

Ten error categories cover all failure modes. Each maps to exit codes and HTTP status. See the [full taxonomy table](./ARCHITECTURE.md#error-taxonomy) in Architecture.

### Creating Errors

```typescript
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalError,
} from "@outfitter/contracts";

// Validation error with details
new ValidationError("Invalid email format", {
  field: "email",
  value: "not-an-email",
});

// Not found with resource info
new NotFoundError("user", "user-123");

// Conflict with existing resource
new ConflictError("User already exists", {
  resourceType: "user",
  resourceId: "user-123",
});

// Internal error (wrap unexpected exceptions)
new InternalError("Database connection failed", { cause: originalError });
```

### Automatic Code Mapping

Adapters automatically map errors to appropriate codes:

```typescript
import { getExitCode, getStatusCode } from "@outfitter/contracts";

const error = new NotFoundError("user", "123");

getExitCode(error.category);   // 2
getStatusCode(error.category); // 404
```

### Pattern Matching Errors

```typescript
switch (error._tag) {
  case "ValidationError":
    return { status: 400, body: { error: error.message, details: error.details } };
  case "NotFoundError":
    return { status: 404, body: { error: `${error.resourceType} not found` } };
  case "AuthError":
    return { status: 401, body: { error: "Authentication required" } };
  default:
    return { status: 500, body: { error: "Internal error" } };
}
```

## Validation

Use Zod schemas with `createValidator` for type-safe input validation that returns Results.

### Basic Validation

```typescript
import { createValidator, validateInput } from "@outfitter/contracts";
import { z } from "zod";

const UserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

type UserInput = z.infer<typeof UserInputSchema>;

// Create a reusable validator
const validateUserInput = createValidator(UserInputSchema);

// Use it
const result = validateUserInput(rawInput);

if (result.isErr()) {
  // result.error is ValidationError with details
  console.log(result.error.details); // Zod error details
}
```

### One-Off Validation

```typescript
const result = validateInput(UserInputSchema, rawInput);
```

### In Handlers

```typescript
export const createUser: Handler<unknown, User, ValidationError | ConflictError> = async (
  rawInput,
  ctx
) => {
  // Validate first
  const inputResult = validateUserInput(rawInput);
  if (inputResult.isErr()) {
    return inputResult; // Pass through the ValidationError
  }

  const input = inputResult.value; // Now typed as UserInput

  // Proceed with validated input
  return Result.ok(await db.users.create(input));
};
```

## Context Creation

`HandlerContext` carries cross-cutting concerns through handler calls.

### Creating Context

```typescript
import { createContext, type HandlerContext } from "@outfitter/contracts";

const ctx = createContext({
  logger: myLogger,           // Optional, defaults to no-op
  config: resolvedConfig,     // Optional
  signal: controller.signal,  // Optional, for cancellation
  workspaceRoot: "/project",  // Optional
  cwd: process.cwd(),         // Optional, defaults to process.cwd()
  env: process.env,           // Optional
});
```

### Context Fields

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | Auto-generated UUIDv7 for tracing |
| `logger` | `Logger` | Structured logger instance |
| `config` | `ResolvedConfig` | Merged configuration |
| `signal` | `AbortSignal` | Cancellation signal |
| `workspaceRoot` | `string` | Project root directory |
| `cwd` | `string` | Current working directory |
| `env` | `Record<string, string>` | Environment variables |

### Request ID Tracing

The `requestId` is auto-generated using `Bun.randomUUIDv7()`, which is time-sortable:

```typescript
const ctx = createContext({});
console.log(ctx.requestId); // "018e4f3c-1a2b-7000-8000-000000000001"

// Use for logging correlation
ctx.logger.info("Processing request", { requestId: ctx.requestId });
```

### Cancellation

```typescript
const controller = new AbortController();
const ctx = createContext({ signal: controller.signal });

// In handler
if (ctx.signal?.aborted) {
  return Result.err(new CancelledError("Operation cancelled"));
}

// To cancel from outside
controller.abort();
```

## Output Modes

CLI output adapts to the environment: human-readable for terminals, JSON for pipes.

### Automatic Detection

```typescript
import { output } from "@outfitter/cli/output";

await output(data); // Human for TTY, JSON for pipes
```

### Mode Priority

1. Explicit `mode` option in `output()` call
2. `OUTFITTER_JSONL=1` environment variable
3. `OUTFITTER_JSON=1` environment variable
4. `OUTFITTER_JSON=0` or `OUTFITTER_JSONL=0` forces human mode
5. TTY detection fallback

### Forcing Modes

```typescript
// Force JSON
await output(data, { mode: "json" });

// Force human-readable
await output(data, { mode: "human" });

// JSON Lines (for streaming)
await output(data, { mode: "jsonl" });
```

### Output to stderr

```typescript
await output(errorData, { stream: process.stderr });
```

## Pagination

Pagination state persists between CLI invocations for `--next` functionality.

### State Storage

Cursor state is stored in XDG state directory:

```
$XDG_STATE_HOME/{toolName}/cursors/{command}/cursor.json
```

### Using Pagination

```typescript
import { loadCursor, saveCursor, clearCursor } from "@outfitter/cli/pagination";

const options = { command: "list", toolName: "myapp" };

// Load previous cursor
const state = loadCursor(options);

// Fetch data
const results = await listItems({ cursor: state?.cursor, limit: 20 });

// Save for next time
if (results.hasMore) {
  saveCursor(results.nextCursor, options);
}

// Reset on --reset flag
if (flags.reset) {
  clearCursor(options);
}
```

### Cursor Expiration

```typescript
const state = loadCursor({
  ...options,
  maxAgeMs: 30 * 60 * 1000, // Expire after 30 minutes
});
```

## Logging

Structured logging with automatic sensitive data redaction.

### Creating Loggers

```typescript
import { createLogger, createConsoleSink } from "@outfitter/logging";

const logger = createLogger({
  name: "my-service",
  level: "debug",
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});
```

### Log Levels

| Level | Use For |
|-------|---------|
| `trace` | Very detailed debugging |
| `debug` | Development debugging |
| `info` | Normal operations |
| `warn` | Unexpected but handled |
| `error` | Failures requiring attention |
| `fatal` | Unrecoverable failures |

### Structured Metadata

```typescript
logger.info("User created", {
  userId: user.id,
  email: user.email,
  duration: performance.now() - start,
});
```

### Child Loggers

```typescript
const requestLogger = createChildLogger(logger, {
  requestId: ctx.requestId,
  handler: "createUser",
});

requestLogger.info("Processing"); // Includes requestId and handler
```

### Redaction

Sensitive data is automatically redacted:

```typescript
logger.info("Config loaded", {
  apiKey: "secret-key-123",  // Logged as "[REDACTED]"
  database: { password: "secret" },  // Nested values also redacted
});
```

## File Safety

User-provided paths are untrusted by default. Validate them or regret it later.

### Secure Path Resolution

```typescript
import { securePath, isPathSafe, resolveSafePath } from "@outfitter/file-ops";

// Validate user input
const result = securePath(userInput, "/app/workspace");

if (result.isErr()) {
  // Path traversal attempt or invalid path
  return Result.err(result.error);
}

const safePath = result.value; // Guaranteed within workspace
```

### What Gets Blocked

| Input | Result |
|-------|--------|
| `../etc/passwd` | `ValidationError` (traversal) |
| `/etc/passwd` | `ValidationError` (absolute) |
| `file\x00.txt` | `ValidationError` (null byte) |
| `data/file.json` | OK, returns absolute path |

### Atomic Writes

Prevent partial writes and corruption:

```typescript
import { atomicWrite, atomicWriteJson } from "@outfitter/file-ops";

// Text content
await atomicWrite("/data/config.txt", content);

// JSON with auto-serialization
await atomicWriteJson("/data/config.json", { key: "value" });
```

### File Locking

Coordinate access between processes:

```typescript
import { withLock } from "@outfitter/file-ops";

const result = await withLock("/data/db.json", async () => {
  const data = JSON.parse(await Bun.file("/data/db.json").text());
  data.counter++;
  await atomicWrite("/data/db.json", JSON.stringify(data));
  return data.counter;
});
```

## Configuration

XDG-compliant config loading with schema validation.

### Loading Config

```typescript
import { loadConfig } from "@outfitter/config";
import { z } from "zod";

const AppConfigSchema = z.object({
  apiKey: z.string(),
  timeout: z.number().default(5000),
});

const result = await loadConfig("myapp", AppConfigSchema);
// Searches: ~/.config/myapp/config.{toml,yaml,json}
```

### Multi-Source Resolution

```typescript
import { resolveConfig } from "@outfitter/config";

const result = resolveConfig(AppConfigSchema, {
  defaults: { timeout: 5000 },
  file: fileConfig,
  env: { timeout: parseInt(process.env.TIMEOUT!) },
  flags: { timeout: cliArgs.timeout },
});
```

### Precedence (highest to lowest)

1. CLI flags
2. Environment variables
3. Config file
4. Defaults

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — How packages fit together
- [Getting Started](./GETTING-STARTED.md) — Hands-on tutorials
- [Migration](./MIGRATION.md) — Upgrading and adoption
