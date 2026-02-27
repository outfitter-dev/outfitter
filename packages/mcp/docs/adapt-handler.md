# Bridging Domain Errors with `adaptHandler()`

MCP tool definitions require `TError extends OutfitterError`. When your handler returns domain errors that extend `Error` but not `OutfitterError`, the types don't align. `adaptHandler()` bridges that gap so you can register domain handlers as MCP tools without unsafe casts or error rewriting.

## The Problem

The Outfitter handler contract constrains tool errors to `OutfitterError`:

```typescript
type Handler<TInput, TOutput, TError extends OutfitterError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;
```

Domain handlers often use their own error hierarchies:

```typescript
class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

async function getCommit(
  input: { sha: string },
  ctx: HandlerContext
): Promise<Result<{ sha: string; message: string }, GitError>> {
  // ...
}
```

Passing `getCommit` directly to `defineTool()` produces a TypeScript error because `GitError` doesn't extend `OutfitterError`.

## The Solution

Wrap the handler with `adaptHandler()`:

```typescript
import { adaptHandler, defineTool } from "@outfitter/mcp";
import { z } from "zod";

const commitTool = defineTool({
  name: "get-commit",
  description: "Look up a git commit by SHA",
  inputSchema: z.object({ sha: z.string() }),
  handler: adaptHandler(getCommit),
});
```

`adaptHandler()` is a type-level bridge. At runtime it performs an `unknown` cast so the handler's error type satisfies `OutfitterError`. The actual error values are unchanged — the MCP server serializes whatever it receives.

## Signature

```typescript
function adaptHandler<TInput, TOutput, TError extends Error>(
  handler: (
    input: TInput,
    ctx: HandlerContext
  ) => Promise<Result<TOutput, TError>>
): Handler<TInput, TOutput, OutfitterError>;
```

**Import:**

```typescript
import { adaptHandler } from "@outfitter/mcp";
```

## When to Use

- Your handler returns errors from a third-party library or domain module that extend `Error` but don't carry a `category` field
- You want to register the handler as an MCP tool without rewriting its error types
- You're integrating existing domain logic that predates the Outfitter error taxonomy

## When Not to Use

- Your handler already returns `OutfitterError` subtypes (e.g., `NotFoundError`, `ValidationError`) — pass it directly to `defineTool()`
- You can refactor the handler to use `OutfitterError` — prefer that over bridging for new code

## Full Example

```typescript
import { adaptHandler, defineTool, createMcpServer } from "@outfitter/mcp";
import { Result } from "@outfitter/contracts";
import type { HandlerContext } from "@outfitter/contracts";
import { z } from "zod";

// Domain error that extends Error, not OutfitterError
class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

// Domain handler returning Result<T, GitError>
async function getCommit(
  input: { sha: string },
  ctx: HandlerContext
): Promise<Result<{ sha: string; message: string }, GitError>> {
  ctx.logger.debug("Looking up commit", { sha: input.sha });
  const commit = await lookupCommit(input.sha);
  if (!commit) {
    return Result.err(new GitError(`Commit not found: ${input.sha}`));
  }
  return Result.ok({ sha: commit.sha, message: commit.message });
}

// Register as MCP tool with adaptHandler()
const server = createMcpServer({ name: "git-tools", version: "1.0.0" });

server.registerTool(
  defineTool({
    name: "get-commit",
    description: "Look up a git commit by SHA",
    inputSchema: z.object({ sha: z.string() }),
    handler: adaptHandler(getCommit),
  })
);
```

## Runtime Error Normalization

`adaptHandler()` only bridges types — it doesn't transform error values at runtime. If you need errors to carry `category` metadata for richer MCP error responses, pair it with `wrapError()` from `@outfitter/contracts/wrap-error`:

```typescript
import { wrapError, type ErrorMapper } from "@outfitter/contracts/wrap-error";
import { NotFoundError, NetworkError } from "@outfitter/contracts";

const gitMapper: ErrorMapper = (err) => {
  if (err instanceof GitError && err.message.includes("not found")) {
    return NotFoundError.create("commit", "unknown");
  }
  if (err instanceof GitError) {
    return NetworkError.create(err.message);
  }
  return undefined;
};

// Normalize at the call site before returning
async function getCommitNormalized(
  input: { sha: string },
  ctx: HandlerContext
) {
  const result = await getCommit(input, ctx);
  if (result.isErr()) {
    return Result.err(wrapError(result.error, gitMapper));
  }
  return result;
}
```

This approach gives you full control over how domain errors map to the Outfitter taxonomy while keeping the domain handler itself transport-agnostic.

## See Also

- [Error Handling Patterns](../../contracts/docs/error-handling-patterns.md) — broader guide covering error boundaries, the MCP boundary rule, and error taxonomy
- [Error Taxonomy](../../contracts/docs/error-taxonomy.md) — the 10 error categories with exit code and HTTP status mappings
