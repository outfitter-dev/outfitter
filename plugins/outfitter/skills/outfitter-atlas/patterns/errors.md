# Error Taxonomy

Ten error categories that map to exit codes (CLI) and HTTP status codes (API).

## Categories

| Category | Exit | HTTP | Class | When to Use |
|----------|------|------|-------|-------------|
| `validation` | 1 | 400 | `ValidationError` | Invalid input, schema failures, constraint violations |
| `validation` | 1 | 400 | `AmbiguousError` | Multiple matches found, user must disambiguate |
| `not_found` | 2 | 404 | `NotFoundError` | Resource doesn't exist |
| `conflict` | 3 | 409 | `ConflictError` | Already exists, version mismatch, optimistic lock failure |
| `permission` | 4 | 403 | `PermissionError` | Forbidden action, insufficient privileges |
| `timeout` | 5 | 504 | `TimeoutError` | Operation took too long |
| `rate_limit` | 6 | 429 | `RateLimitError` | Too many requests, quota exceeded |
| `network` | 7 | 502 | `NetworkError` | Connection failures, DNS errors, unreachable hosts |
| `internal` | 8 | 500 | `InternalError` | Unexpected errors, bugs, unhandled cases |
| `internal` | 8 | 500 | `AssertionError` | Invariant violations, programming bugs |
| `auth` | 9 | 401 | `AuthError` | Authentication required, invalid credentials |
| `cancelled` | 130 | 499 | `CancelledError` | User interrupted (Ctrl+C), operation aborted |

## Error Classes

All errors extend `OutfitterError` and have:

```typescript
interface OutfitterError {
  readonly _tag: string;           // Discriminator for pattern matching
  readonly category: ErrorCategory; // One of the 10 categories
  readonly message: string;         // Human-readable message
  readonly context?: Record<string, unknown>; // Structured metadata
}
```

### `create()` Static Factories

Most error classes provide a `create()` method that auto-generates messages. This is the preferred way to construct errors (except `AssertionError`, which uses direct construction):

```typescript
import {
  ValidationError,
  NotFoundError,
  AmbiguousError,
  ConflictError,
  PermissionError,
  TimeoutError,
  RateLimitError,
  NetworkError,
  InternalError,
  AuthError,
  CancelledError,
} from "@outfitter/contracts";

ValidationError.create("email", "format invalid");
// → { message: "email: format invalid", field: "email" }

NotFoundError.create("user", "user-123");
// → { message: "user not found: user-123", resourceType: "user", resourceId: "user-123" }

AmbiguousError.create("heading", ["Introduction", "Intro to APIs"]);
// → { message: "Ambiguous heading: 2 matches found", candidates: [...] }

ConflictError.create("User already exists");
PermissionError.create("Cannot delete admin users");
TimeoutError.create("database query", 5000);
RateLimitError.create("API rate limit exceeded", 30);
NetworkError.create("Failed to connect to API");
InternalError.create("Unexpected failure");
AuthError.create("Invalid API key", "invalid");
CancelledError.create("Operation cancelled by user");
```

Some factories accept an optional `context` parameter for structured metadata. Others have specialized signatures:

```typescript
// context parameter (ValidationError, AmbiguousError, NotFoundError, ConflictError,
// PermissionError, NetworkError, InternalError)
ValidationError.create("email", "format invalid", { received: "not-an-email" });
NotFoundError.create("user", "user-123", { searchedIn: "active_users" });
InternalError.create("Unexpected failure", { cause: originalError });

// Specialized signatures (no context parameter)
TimeoutError.create("database query", 5000);       // operation, timeoutMs
RateLimitError.create("API rate limit exceeded", 30); // message, retryAfterSeconds
AuthError.create("Invalid API key", "invalid");     // message, reason
CancelledError.create("Operation cancelled");       // message only
```

### `context` Field

All errors support a `context` field for attaching structured metadata:

```typescript
new InternalError({
  message: "Failed to add block",
  context: { action: "add", blockName: "scaffolding" },
});

new NotFoundError({
  message: "Heading not found",
  resourceType: "heading",
  resourceId: "h:Intro",
  context: { availableHeadings: ["Introduction", "Getting Started"] },
});

new ValidationError({
  message: "Value out of range",
  field: "age",
  context: { min: 0, max: 150, received: -1 },
});
```

Use `context` instead of ad-hoc details objects — it's a typed, consistent field across all error classes.

### ValidationError

```typescript
import { ValidationError } from "@outfitter/contracts";

// Factory (preferred)
ValidationError.create("email", "format invalid");

// With context
ValidationError.create("email", "format invalid", { received: "not-an-email" });

// Manual construction
new ValidationError({ message: "Invalid email format", field: "email" });

// From Zod
const result = schema.safeParse(input);
if (!result.success) {
  return Result.err(ValidationError.create("input", "schema validation failed", {
    issues: result.error.issues,
  }));
}
```

### AmbiguousError

For disambiguation scenarios where partial input matches multiple candidates:

```typescript
import { AmbiguousError } from "@outfitter/contracts";

// Factory (preferred)
AmbiguousError.create("heading", ["Introduction", "Intro to APIs"]);

// Manual construction
new AmbiguousError({
  message: "Multiple headings match 'Intro'",
  candidates: ["Introduction", "Intro to APIs"],
});

// Access candidates for disambiguation UI
error.candidates;  // ["Introduction", "Intro to APIs"]
error.category;    // "validation" (exit 1, HTTP 400)
```

### NotFoundError

```typescript
import { NotFoundError } from "@outfitter/contracts";

// Factory (preferred)
NotFoundError.create("user", "user-123");
// → message: "user not found: user-123"

// With context
NotFoundError.create("user", "user-123", {
  searchedIn: "active_users",
});

// Access properties
error.resourceType;  // "user"
error.resourceId;    // "user-123"
```

### ConflictError

```typescript
import { ConflictError } from "@outfitter/contracts";

// Factory (preferred)
ConflictError.create("User already exists");

// With context
ConflictError.create("Version mismatch", { expected: 5, actual: 7 });
```

### PermissionError

```typescript
import { PermissionError } from "@outfitter/contracts";

PermissionError.create("Cannot delete admin users");

// With context
PermissionError.create("Cannot delete admin users", {
  action: "delete",
  resource: "user",
});
```

### TimeoutError

```typescript
import { TimeoutError } from "@outfitter/contracts";

// Factory — takes operation name and timeout in ms
TimeoutError.create("database query", 5000);
// → message: "database query timed out after 5000ms"
```

### RateLimitError

```typescript
import { RateLimitError } from "@outfitter/contracts";

// Factory — message + optional retryAfterSeconds
RateLimitError.create("API rate limit exceeded", 30);
```

### NetworkError

```typescript
import { NetworkError } from "@outfitter/contracts";

NetworkError.create("Failed to connect to API");

// With context
NetworkError.create("Failed to connect to API", {
  host: "api.example.com",
  code: "ECONNREFUSED",
});
```

### InternalError

```typescript
import { InternalError } from "@outfitter/contracts";

InternalError.create("Unexpected failure");

// With context (wrapping caught errors)
InternalError.create("Unexpected failure", { cause: error });
```

### AuthError

```typescript
import { AuthError } from "@outfitter/contracts";

// Factory — message + optional reason
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

### AssertionError

For invariant violations — programming bugs, not user input validation:

```typescript
import { AssertionError } from "@outfitter/contracts";

// Used by assertion utilities that return Result instead of throwing
new AssertionError({ message: "Cache should always have value after init" });
// category: "internal" (exit 8, HTTP 500)
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

## ERROR_CODES Constant

Use `ERROR_CODES` for type-safe category validation and iteration:

```typescript
import { ERROR_CODES, type ErrorCategory } from "@outfitter/contracts";

// ERROR_CODES is a readonly object mapping category names to exit codes
ERROR_CODES.validation;  // 1
ERROR_CODES.not_found;   // 2
ERROR_CODES.conflict;    // 3
// ... etc

// Validate a category exists
const isValidCategory = (cat: string): cat is ErrorCategory => {
  return cat in ERROR_CODES;
};

// Iterate over all categories
for (const [category, exitCode] of Object.entries(ERROR_CODES)) {
  console.log(`${category}: exit ${exitCode}`);
}
```

## Domain-Specific Error Factories

For domain-specific errors, create factory functions that use `create()`:

```typescript
import { ValidationError, NotFoundError } from "@outfitter/contracts";

// Domain factory wrapping the generic create()
export const userNotFound = (id: string) =>
  NotFoundError.create("user", id);

export const invalidEmail = (email: string) =>
  ValidationError.create("email", "invalid format", { received: email });
```

For more complex domain errors, extend the base classes:

```typescript
import { ValidationError } from "@outfitter/contracts";

export class EmailValidationError extends ValidationError {
  constructor(email: string) {
    super({ message: "Invalid email format", field: "email", context: { email } });
  }
}
```

The category is inherited, so exit codes and HTTP status work automatically.
