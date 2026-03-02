# Error Handling Patterns

Guidance on when to use Result types vs exceptions, how errors flow through MCP and CLI boundaries, and how to bridge domain errors into the Outfitter taxonomy.

## Error Boundaries

Outfitter distinguishes two error strategies based on where the error originates:

### Results for Domain Errors

All domain logic — handlers, validators, data access — returns `Result<T, E>`. This makes error paths explicit, composable, and testable without try/catch.

```typescript
import { type Handler, Result, NotFoundError } from "@outfitter/contracts";

const getNote: Handler<{ id: string }, Note, NotFoundError> = async (
  input,
  ctx,
) => {
  const note = await db.notes.find(input.id);
  if (!note) return Result.err(NotFoundError.create("note", input.id));
  return Result.ok(note);
};
```

**Use Result when:**

- The failure is a known domain condition (not found, validation, conflict, etc.)
- The caller can meaningfully handle the error
- The error should propagate through handler composition

### Throws for Protocol Violations and Startup Failures

Throw exceptions only for:

- **Protocol violations** — broken invariants that indicate programmer error (e.g., registering a tool with a duplicate name, calling a method before initialization)
- **Unrecoverable startup failures** — configuration errors or missing dependencies that prevent the process from starting at all

```typescript
// Protocol violation: programmer error, not a domain condition
if (this.tools.has(name)) {
  throw new Error(`Tool already registered: ${name}`);
}

// Startup failure: process cannot continue
const config = loadConfig();
if (!config) {
  throw new Error("Missing required configuration file");
}
```

These are bugs or environment issues, not domain errors. They should crash early with a clear message rather than propagate through Result chains.

## MCP Boundary Rule

MCP tool handlers **must always return `Result`**. The MCP server translates Results into MCP protocol responses — `Ok` becomes tool content, `Err` becomes an error response with the appropriate message.

```typescript
import { defineTool } from "@outfitter/mcp";
import { Result, NotFoundError } from "@outfitter/contracts";
import { z } from "zod";

const getUserTool = defineTool({
  name: "get-user",
  description: "Retrieve a user by ID",
  inputSchema: z.object({ userId: z.string() }),
  handler: async (input, ctx) => {
    const user = await db.users.find(input.userId);
    if (!user) {
      return Result.err(
        NotFoundError.create("user", input.userId),
      );
    }
    return Result.ok({ name: user.name, email: user.email });
  },
});
```

Never throw from a tool handler. An unhandled throw bypasses the server's error formatting and produces an opaque internal error for the client.

## Error Taxonomy

All domain errors use one of 10 categories. Each category maps to a CLI exit code and HTTP status code, ensuring consistent behavior across CLI, MCP, and API transports.

| Category     | Exit Code | HTTP Status | When to Use                               |
| ------------ | --------- | ----------- | ----------------------------------------- |
| `validation` | 1         | 400         | Invalid input, schema violation            |
| `not_found`  | 2         | 404         | Resource does not exist                    |
| `conflict`   | 3         | 409         | Duplicate creation, version mismatch       |
| `permission` | 4         | 403         | Insufficient permissions                   |
| `timeout`    | 5         | 504         | Operation exceeded time limit              |
| `rate_limit` | 6         | 429         | Request rate exceeded                      |
| `network`    | 7         | 502         | Network or upstream failure                |
| `internal`   | 8         | 500         | Unexpected internal error                  |
| `auth`       | 9         | 401         | Missing or invalid credentials             |
| `cancelled`  | 130       | 499         | User cancellation (POSIX: 128 + SIGINT)    |

Use `getExitCode()` and `getStatusCode()` from `@outfitter/contracts` for programmatic lookups. See the full taxonomy reference in [error-taxonomy.md](./error-taxonomy.md).

## The `adaptHandler()` Bridge Pattern

MCP tool definitions constrain `TError extends OutfitterError`. When your handler returns domain-specific errors that extend `Error` but not `OutfitterError`, the types don't align. Use `adaptHandler()` from `@outfitter/mcp` to bridge the gap instead of an unsafe cast.

### When to Use

- Your handler returns errors from a third-party library or domain module that extend `Error` but don't carry a `category` field
- You want to register the handler as an MCP tool without rewriting its error types

### When Not to Use

- Your handler already returns `OutfitterError` subtypes (e.g., `NotFoundError`, `ValidationError`) — pass it directly
- You can refactor the handler to use `OutfitterError` — prefer that over bridging

### Example

```typescript
import { adaptHandler, defineTool } from "@outfitter/mcp";
import { Result } from "@outfitter/contracts";
import { z } from "zod";

// Domain handler returns a custom error that extends Error, not OutfitterError
class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

async function getCommit(
  input: { sha: string },
  ctx: import("@outfitter/contracts").HandlerContext,
): Promise<Result<{ sha: string; message: string }, GitError>> {
  // ... domain logic returning Result<T, GitError>
}

// Bridge the type gap with adaptHandler()
const commitTool = defineTool({
  name: "get-commit",
  description: "Look up a git commit by SHA",
  inputSchema: z.object({ sha: z.string() }),
  handler: adaptHandler(getCommit),
});
```

`adaptHandler()` is a type-level bridge — it performs an `unknown` cast at runtime so the handler's error type satisfies the `OutfitterError` constraint. The actual error values are unchanged; the MCP server serializes whatever it receives.

For more robust error normalization at runtime, pair it with `wrapError()` from `@outfitter/contracts/wrap-error`:

```typescript
import { wrapError, type ErrorMapper } from "@outfitter/contracts/wrap-error";
import { NetworkError } from "@outfitter/contracts";

const gitErrorMapper: ErrorMapper = (err) => {
  if (err instanceof GitError) {
    return NetworkError.create(err.message);
  }
  return undefined;
};

// Normalize unknown errors into typed OutfitterErrors
const normalized = wrapError(caughtError, gitErrorMapper);
```
