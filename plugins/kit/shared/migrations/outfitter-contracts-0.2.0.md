---
package: "@outfitter/contracts"
version: 0.2.0
breaking: false
---

# @outfitter/contracts → 0.2.0

## New APIs

### `create()` Static Factories

All error classes now have a `create()` static method that auto-generates messages from structured inputs. This is the preferred way to construct errors.

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

// ValidationError — field + reason
ValidationError.create("email", "format invalid");
// → message: "email: format invalid", field: "email"

// NotFoundError — resourceType + resourceId
NotFoundError.create("user", "user-123");
// → message: "user not found: user-123", resourceType: "user", resourceId: "user-123"

// AmbiguousError — what + candidates
AmbiguousError.create("heading", ["Introduction", "Intro to APIs"]);
// → message: "Ambiguous heading: 2 matches found", candidates: [...]

// ConflictError — message
ConflictError.create("User already exists");

// PermissionError — message
PermissionError.create("Cannot delete admin users");

// TimeoutError — operation + timeoutMs
TimeoutError.create("database query", 5000);
// → message: "database query timed out after 5000ms"

// RateLimitError — message + optional retryAfterSeconds
RateLimitError.create("API rate limit exceeded", 30);

// NetworkError — message
NetworkError.create("Failed to connect to API");

// InternalError — message
InternalError.create("Unexpected failure");

// AuthError — message + optional reason
AuthError.create("Invalid API key", "invalid");

// CancelledError — message
CancelledError.create("Operation cancelled by user");
```

All `create()` methods accept an optional `context` parameter:

```typescript
ValidationError.create("email", "format invalid", { received: "not-an-email" });
NotFoundError.create("user", "user-123", { searchedIn: "active_users" });
```

### `context` Field

All error classes now support an optional `context` field for attaching structured metadata without overloading the message string:

```typescript
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

new InternalError({
  message: "Failed to add block",
  context: { action: "add", blockName: "scaffolding" },
});
```

### `AmbiguousError`

New error class for disambiguation scenarios. Uses `validation` category (exit 1, HTTP 400).

```typescript
import { AmbiguousError } from "@outfitter/contracts";

// When a search matches multiple candidates
const error = new AmbiguousError({
  message: "Multiple headings match 'Intro'",
  candidates: ["Introduction", "Intro to APIs"],
});

// Or use the factory
const error = AmbiguousError.create("heading", ["Introduction", "Intro to APIs"]);

// Access candidates for disambiguation UI
error.candidates; // ["Introduction", "Intro to APIs"]
error.category;   // "validation"
error.exitCode(); // 1
```

### `AssertionError`

New error class for invariant violations. Uses `internal` category (exit 8, HTTP 500).

```typescript
import { AssertionError } from "@outfitter/contracts";

// Used by assertion utilities that return Result instead of throwing
const error = new AssertionError({
  message: "Cache should always have value after init",
});
```

### `expect()` Result Boundary Helper

Unwraps a `Result` or throws with a contextual message. Use at system boundaries where you need to exit the Result railway.

```typescript
import { expect } from "@outfitter/contracts";

// Unwraps Ok, throws on Err
const config = expect(loadConfig(), "Failed to load config");

// Throws: Error("Failed to load config: <original error>")
```

## Migration Steps

### Use `create()` factories instead of manual construction

**Before:**
```typescript
new ValidationError({ message: "email: format invalid", field: "email" });
new NotFoundError({ message: "user not found: user-123", resourceType: "user", resourceId: "user-123" });
```

**After:**
```typescript
ValidationError.create("email", "format invalid");
NotFoundError.create("user", "user-123");
```

### Use `context` instead of `details`

The `context` field replaces ad-hoc `details` patterns:

**Before:**
```typescript
new InternalError("Unexpected error", { cause: error });
```

**After:**
```typescript
new InternalError({ message: "Unexpected error", context: { cause: error } });
// Or with factory:
InternalError.create("Unexpected error", { cause: error });
```

### Use `AmbiguousError` for multi-match scenarios

**Before:**
```typescript
new ValidationError({
  message: `Multiple matches found for '${query}'`,
  field: "query",
});
```

**After:**
```typescript
AmbiguousError.create(query, matchedCandidates);
// Carries the candidate list for transport layers to use
```

## No Action Required

- Existing error constructors still work — `create()` is additive
- `exitCode()` and `statusCode()` methods unchanged
- `_tag` discriminators unchanged
- Pattern matching with `_tag` works the same way
