# Handler Contract

The core abstraction in Outfitter Stack. Handlers are pure functions that accept typed input and context, returning `Result<TOutput, TError>`.

## Signature

```typescript
type Handler<TInput, TOutput, TError extends OutfitterError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;

// Synchronous variant for operations that don't need async
type SyncHandler<TInput, TOutput, TError extends OutfitterError> = (
  input: TInput,
  ctx: HandlerContext
) => Result<TOutput, TError>;
```

## Type Parameters

| Parameter | Description |
|-----------|-------------|
| `TInput` | Input type (use `unknown` for raw input that needs validation) |
| `TOutput` | Success return type |
| `TError` | Union of possible error types (must extend `OutfitterError`) |

## Handler Structure

```typescript
import {
  Result,
  ValidationError,
  NotFoundError,
  createValidator,
  type Handler,
} from "@outfitter/contracts";
import { z } from "zod";

// 1. Define input schema
const InputSchema = z.object({
  id: z.string().min(1),
  options: z.object({
    includeDeleted: z.boolean().default(false),
  }).optional(),
});

// 2. Create validator
const validateInput = createValidator(InputSchema);

// 3. Define output type
interface UserOutput {
  id: string;
  name: string;
  email: string;
}

// 4. Implement handler
export const getUser: Handler<unknown, UserOutput, ValidationError | NotFoundError> = async (
  rawInput,
  ctx
) => {
  // Validate input
  const inputResult = validateInput(rawInput);
  if (inputResult.isErr()) return inputResult;
  const input = inputResult.value;

  // Log with context
  ctx.logger.debug("Fetching user", { userId: input.id });

  // Business logic
  const user = await db.users.findById(input.id);
  if (!user) {
    return Result.err(NotFoundError.create("user", input.id));
  }

  // Return success
  return Result.ok(user);
};
```

## Why Handlers?

### Transport Agnostic

Handlers know nothing about:
- CLI flags and arguments
- HTTP headers and status codes
- MCP tool schemas
- WebSocket messages

This separation means one handler serves all transports.

### Testability

Test handlers directly without transport layer:

```typescript
import { createContext } from "@outfitter/contracts";

test("getUser returns user", async () => {
  const ctx = createContext({});
  const result = await getUser({ id: "user-1" }, ctx);

  expect(result.isOk()).toBe(true);
  expect(result.value.name).toBe("Alice");
});
```

### Composability

Handlers can call other handlers:

```typescript
const createOrder: Handler<CreateOrderInput, Order, OrderError> = async (input, ctx) => {
  // Call another handler
  const userResult = await getUser({ id: input.userId }, ctx);
  if (userResult.isErr()) {
    return Result.err(
      ValidationError.create("userId", "invalid user", {
        userId: input.userId,
      })
    );
  }

  // Continue with order creation
  const order = await db.orders.create({
    user: userResult.value,
    items: input.items,
  });

  return Result.ok(order);
};
```

### Type Safety

TypeScript knows all possible outcomes:

```typescript
const result = await getUser({ id: "123" }, ctx);

if (result.isOk()) {
  // result.value is UserOutput
  console.log(result.value.name);
} else {
  // result.error is ValidationError | NotFoundError
  switch (result.error._tag) {
    case "ValidationError":
      console.log(result.error.context);
      break;
    case "NotFoundError":
      console.log(result.error.resourceId);
      break;
  }
}
```

## Validation Pattern

Always validate at handler entry:

```typescript
const handler: Handler<unknown, Output, ValidationError | OtherError> = async (rawInput, ctx) => {
  // First: validate
  const inputResult = validateInput(rawInput);
  if (inputResult.isErr()) return inputResult;
  const input = inputResult.value;  // Now typed!

  // Rest of handler uses validated input
};
```

## HandlerContext

All cross-cutting concerns are passed via `HandlerContext`:

```typescript
interface HandlerContext {
  signal?: AbortSignal;           // Cancellation propagation
  requestId: string;              // UUIDv7 for tracing
  logger: Logger;                 // Structured logger with redaction
  config?: ResolvedConfig;        // Resolved configuration values
  workspaceRoot?: string;         // Workspace root path, if detected
  cwd: string;                    // Current working directory
  env: Record<string, string | undefined>; // Environment variables (filtered)
}

// ResolvedConfig interface (provided by @outfitter/config)
interface ResolvedConfig {
  get<T>(key: string): T | undefined;
  getRequired<T>(key: string): T;
}
```

### Context Usage

```typescript
const handler: Handler<Input, Output, Error> = async (input, ctx) => {
  // Logging
  ctx.logger.info("Processing", { input });

  // Request tracing
  const requestId = ctx.requestId;

  // Configuration (typed access)
  const apiUrl = ctx.config?.get<string>("apiUrl");
  const port = ctx.config?.getRequired<number>("port");

  // Current working directory
  const resolvedPath = path.resolve(ctx.cwd, input.filename);

  // Environment variables
  const token = ctx.env["API_TOKEN"];

  // Cancellation
  if (ctx.signal?.aborted) {
    return Result.err(CancelledError.create("Operation cancelled"));
  }

  // Workspace paths
  if (ctx.workspaceRoot) {
    const filePath = path.join(ctx.workspaceRoot, input.filename);
  }
};
```

## Error Handling

Never throw in handlers. Return `Result.err()`:

```typescript
// BAD
if (!user) throw new Error("Not found");

// GOOD
if (!user) return Result.err(NotFoundError.create("user", id));
```

Use taxonomy error classes for consistent categorization:

```typescript
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  PermissionError,
  InternalError,
} from "@outfitter/contracts";
```
