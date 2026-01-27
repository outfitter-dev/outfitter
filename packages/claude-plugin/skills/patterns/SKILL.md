---
name: patterns
version: 0.1.0
description: Reference for Outfitter Stack conventions including Result types, Handler contract, Error taxonomy, and transport-agnostic patterns. Use when learning the stack, looking up patterns, understanding @outfitter/* packages, or when "Result", "Handler", "error taxonomy", or "OutfitterError" are mentioned.
allowed-tools: Read Grep Glob
---

# Outfitter Stack Patterns

Primary reference for @outfitter/* package conventions.

## Handler Contract

Handlers are pure functions that:
- Accept typed input and context
- Return `Result<TOutput, TError>`
- Know nothing about transport (CLI flags, HTTP headers, MCP tool schemas)

```typescript
type Handler<TInput, TOutput, TError extends OutfitterError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;
```

### Example

```typescript
import { Result, NotFoundError, type Handler } from "@outfitter/contracts";

export const getUser: Handler<{ id: string }, User, NotFoundError> = async (input, ctx) => {
  ctx.logger.debug("Fetching user", { userId: input.id });
  const user = await db.users.findById(input.id);

  if (!user) {
    return Result.err(new NotFoundError("user", input.id));
  }
  return Result.ok(user);
};
```

**Why?** Testability (just call the function), reusability (same handler for CLI/MCP/HTTP), type safety (explicit types), composability (handlers wrap handlers).

## Result Types

Uses `Result<T, E>` from `better-result` for explicit error handling.

```typescript
import { Result } from "@outfitter/contracts";

// Create
const ok = Result.ok({ name: "Alice" });
const err = Result.err(new NotFoundError("user", "123"));

// Check
if (result.isOk()) {
  console.log(result.value);  // TypeScript knows T
} else {
  console.log(result.error);  // TypeScript knows E
}

// Pattern match
const message = result.match({
  ok: (user) => `Found ${user.name}`,
  err: (error) => `Error: ${error.message}`,
});

// Combine
const combined = combine2(result1, result2);  // tuple or first error
```

## Error Taxonomy

Ten categories map to exit codes and HTTP status:

| Category | Exit | HTTP | When to Use |
|----------|------|------|-------------|
| `validation` | 1 | 400 | Invalid input, schema failures |
| `not_found` | 2 | 404 | Resource doesn't exist |
| `conflict` | 3 | 409 | Already exists, version mismatch |
| `permission` | 4 | 403 | Forbidden action |
| `timeout` | 5 | 504 | Operation took too long |
| `rate_limit` | 6 | 429 | Too many requests |
| `network` | 7 | 503 | Connection failures |
| `internal` | 8 | 500 | Unexpected errors, bugs |
| `auth` | 9 | 401 | Authentication required |
| `cancelled` | 130 | 499 | User interrupted (Ctrl+C) |

```typescript
import { ValidationError, NotFoundError, getExitCode } from "@outfitter/contracts";

new ValidationError("Invalid email", { field: "email" });
new NotFoundError("user", "user-123");

getExitCode(error.category);   // 2 for not_found
getStatusCode(error.category); // 404 for not_found
```

## Validation

Use Zod with `createValidator` for type-safe validation returning Results:

```typescript
import { createValidator } from "@outfitter/contracts";
import { z } from "zod";

const InputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const validateInput = createValidator(InputSchema);

// In handler
const inputResult = validateInput(rawInput);
if (inputResult.isErr()) return inputResult;
const input = inputResult.value;  // typed as z.infer<typeof InputSchema>
```

## Context

`HandlerContext` carries cross-cutting concerns:

```typescript
import { createContext } from "@outfitter/contracts";

const ctx = createContext({
  logger: myLogger,           // structured logger
  config: resolvedConfig,     // merged configuration
  signal: controller.signal,  // cancellation
  workspaceRoot: "/project",
});

// ctx.requestId is auto-generated UUIDv7 for tracing
```

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | Auto-generated UUIDv7 |
| `logger` | `Logger` | Structured logger |
| `config` | `ResolvedConfig` | Merged config |
| `signal` | `AbortSignal` | Cancellation signal |
| `workspaceRoot` | `string` | Project root |
| `cwd` | `string` | Current directory |

## Bun-First APIs

Prefer Bun-native APIs:

| Need | Bun API |
|------|---------|
| Hashing | `Bun.hash()` |
| Globbing | `Bun.Glob` |
| Semver | `Bun.semver` |
| Shell | `Bun.$` |
| Colors | `Bun.color()` |
| String width | `Bun.stringWidth()` |
| SQLite | `bun:sqlite` |
| UUID v7 | `Bun.randomUUIDv7()` |

## References

- [Handler Contract](references/handler-contract.md)
- [Error Taxonomy](references/error-taxonomy.md)
- [Result Utilities](references/result-utilities.md)
