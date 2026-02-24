# Error Taxonomy

Ten error categories that map to exit codes (CLI) and HTTP status codes (API).

## Categories

| Category     | Exit | HTTP | Class             | When to Use                                               |
| ------------ | ---- | ---- | ----------------- | --------------------------------------------------------- |
| `validation` | 1    | 400  | `ValidationError` | Invalid input, schema failures, constraint violations     |
| `not_found`  | 2    | 404  | `NotFoundError`   | Resource doesn't exist                                    |
| `conflict`   | 3    | 409  | `ConflictError`   | Already exists, version mismatch, optimistic lock failure |
| `permission` | 4    | 403  | `PermissionError` | Forbidden action, insufficient privileges                 |
| `timeout`    | 5    | 504  | `TimeoutError`    | Operation took too long                                   |
| `rate_limit` | 6    | 429  | `RateLimitError`  | Too many requests, quota exceeded                         |
| `network`    | 7    | 502  | `NetworkError`    | Connection failures, DNS errors, unreachable hosts        |
| `internal`   | 8    | 500  | `InternalError`   | Unexpected errors, bugs, unhandled cases                  |
| `auth`       | 9    | 401  | `AuthError`       | Authentication required, invalid credentials              |
| `cancelled`  | 130  | 499  | `CancelledError`  | User interrupted (Ctrl+C), operation aborted              |

## Error Classes

All errors extend `OutfitterError` and have:

```typescript
interface OutfitterError {
  readonly _tag: string; // Discriminator for pattern matching
  readonly category: ErrorCategory; // One of the 10 categories
  readonly message: string; // Human-readable message
  readonly context?: Record<string, unknown>; // Additional context
}
```

### ValidationError

```typescript
import { ValidationError } from "@outfitter/contracts";

// Basic
ValidationError.create("email", "invalid format");

// With context
ValidationError.create("email", "validation failed", {
  field: "email",
  value: "not-an-email",
  constraint: "email",
});

// From Zod
const result = schema.safeParse(input);
if (!result.success) {
  return Result.err(
    ValidationError.create("input", "invalid", {
      issues: result.error.issues,
    })
  );
}
```

### NotFoundError

```typescript
import { NotFoundError } from "@outfitter/contracts";

// Resource type and ID
NotFoundError.create("user", "user-123");

// Access properties
error.resourceType; // "user"
error.resourceId; // "user-123"
error.message; // "user not found: user-123"
```

### ConflictError

```typescript
import { ConflictError } from "@outfitter/contracts";

// Already exists
ConflictError.create("User already exists", { email: "user@example.com" });

// Version mismatch
ConflictError.create("Version mismatch", {
  expected: 5,
  actual: 7,
});
```

### PermissionError

```typescript
import { PermissionError } from "@outfitter/contracts";

PermissionError.create("Cannot delete admin users", {
  action: "delete",
  resource: "user",
  resourceId: "admin-1",
});
```

### TimeoutError

```typescript
import { TimeoutError } from "@outfitter/contracts";

TimeoutError.create("findUsers", 5000);
```

### RateLimitError

```typescript
import { RateLimitError } from "@outfitter/contracts";

RateLimitError.create("API rate limit exceeded", 30);
```

### NetworkError

```typescript
import { NetworkError } from "@outfitter/contracts";

NetworkError.create("Failed to connect to API", {
  host: "api.example.com",
  code: "ECONNREFUSED",
});
```

### InternalError

```typescript
import { InternalError } from "@outfitter/contracts";

// Wrap unexpected errors
try {
  await riskyOperation();
} catch (error) {
  return Result.err(InternalError.create("Unexpected error", { cause: error }));
}
```

### AuthError

```typescript
import { AuthError } from "@outfitter/contracts";

AuthError.create("Invalid API key", "invalid");
AuthError.create("Token expired", "expired");
```

### CancelledError

```typescript
import { CancelledError } from "@outfitter/contracts";

if (ctx.signal.aborted) {
  return Result.err(CancelledError.create("Operation cancelled by user"));
}
```

## Pattern Matching

Use `_tag` for type-safe error handling:

```typescript
if (result.isErr()) {
  switch (result.error._tag) {
    case "ValidationError":
      console.log("Invalid input:", result.error.context);
      break;
    case "NotFoundError":
      console.log(`${result.error.resourceType} not found`);
      break;
    case "ConflictError":
      console.log("Conflict:", result.error.message);
      break;
    default:
      console.log("Error:", result.error.message);
  }
}
```

## Exit Code Mapping

```typescript
import { getExitCode } from "@outfitter/contracts";

const exitCode = getExitCode(error.category);
process.exit(exitCode);
```

## HTTP Status Mapping

```typescript
import { getStatusCode } from "@outfitter/contracts";

const status = getStatusCode(error.category);
res.status(status).json({ error: error.message });
```

## Creating Custom Errors

Extend the base classes for domain-specific errors:

```typescript
import { ValidationError } from "@outfitter/contracts";

export class EmailValidationError extends ValidationError {
  constructor(email: string) {
    super({
      message: "Invalid email format",
      field: "email",
      context: { email },
    });
  }
}
```

The category is inherited, so exit codes and HTTP status work automatically.
