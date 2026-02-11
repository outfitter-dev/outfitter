# Designing Systems with the Outfitter Stack

A systematic approach to designing transport-agnostic handler systems with Result types and the error taxonomy.

## The Process

### Step 1: Understand the Terrain

Before writing code, gather information:

**Transport surfaces** — Where will this system be consumed?
- CLI for human operators
- MCP for AI agents
- HTTP for services
- All three?

**Domain operations** — What actions does the system perform?
- CRUD operations on resources
- Complex workflows
- Background processing
- File transformations

**Failure modes** — What can go wrong?
- Invalid input (validation)
- Missing resources (not_found)
- Duplicate resources (conflict)
- External service failures (network, timeout)
- Permission issues (permission, auth)

**External dependencies** — What systems do you touch?
- Databases
- APIs
- File system
- Message queues

### Step 2: Design the Handler Layer

For each domain operation, define:

1. **Input type** — Zod schema for validation
2. **Output type** — What success looks like
3. **Error types** — Which taxonomy categories apply
4. **Handler signature** — `Handler<Input, Output, Error1 | Error2>`

```typescript
// Input schema (source of truth)
const CreateUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "user"]).default("user"),
});

// Input type derived from schema
type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

// Output type
interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
}

// Handler signature with explicit error types
const createUser: Handler<
  CreateUserInput,
  User,
  ValidationError | ConflictError
>;
```

### Step 3: Map Errors to the Taxonomy

Every domain error maps to one of ten categories:

| Domain Error | Category | Error Class | Exit | HTTP |
|--------------|----------|-------------|------|------|
| Invalid email format | `validation` | `ValidationError` | 1 | 400 |
| User not found | `not_found` | `NotFoundError` | 2 | 404 |
| Email already exists | `conflict` | `ConflictError` | 3 | 409 |
| Can't modify other users | `permission` | `PermissionError` | 4 | 403 |
| Database query timed out | `timeout` | `TimeoutError` | 5 | 504 |
| API rate limit hit | `rate_limit` | `RateLimitError` | 6 | 429 |
| Can't reach external API | `network` | `NetworkError` | 7 | 502 |
| Unexpected null pointer | `internal` | `InternalError` | 8 | 500 |
| Token expired | `auth` | `AuthError` | 9 | 401 |
| User pressed Ctrl+C | `cancelled` | `CancelledError` | 130 | 499 |

**Design principle**: Domain errors are domain-specific; stack categories are transport-agnostic. The mapping happens once, at handler boundaries.

### Step 4: Choose Packages

Start with the foundation, add what you need:

```
Always start here:
└── @outfitter/contracts     # Result types, errors, Handler contract

Add based on transport:
├── @outfitter/cli           # CLI applications
├── @outfitter/mcp           # MCP servers (AI tools)
└── @outfitter/daemon        # Background services

Add based on needs:
├── @outfitter/config        # XDG paths, config loading
├── @outfitter/logging       # Structured logging
├── @outfitter/file-ops      # Secure file operations
├── @outfitter/state         # Pagination state
└── @outfitter/index         # Full-text search (FTS5)

Dev dependencies:
├── @outfitter/testing       # Test harnesses
├── @outfitter/tooling       # Biome, TypeScript, Lefthook presets
└── @outfitter/kit         # Version coordination
```

**Selection rules**:
- All projects need `@outfitter/contracts` — this is non-negotiable
- CLI apps get `@outfitter/cli` (includes terminal UI, colors, output modes)
- MCP servers get `@outfitter/mcp` (includes Zod-to-MCP tool wiring)
- File operations need both `@outfitter/config` (XDG paths) and `@outfitter/file-ops` (safety)
- Everything needs logging — add `@outfitter/logging`

### Step 5: Design Context Flow

Context carries cross-cutting concerns through the handler chain:

```typescript
interface HandlerContext {
  logger: Logger;           // Scoped, structured logging
  config: Config;           // Loaded configuration
  signal?: AbortSignal;     // For cancellation
  workspaceRoot: string;    // Resolved workspace path
  requestId: string;        // Correlation ID for tracing
}
```

**Entry points create context**:
- CLI `main()` → creates context with terminal logger
- MCP server → creates context per tool invocation
- HTTP handler → creates context per request

**Context flows through**:
- Parent handler → child handler (passed explicitly)
- Logger gets child scopes for nested operations
- requestId stays consistent for tracing

## Output Templates

### Architecture Overview

```
Project: {PROJECT_NAME}
Transport Surfaces: {CLI | MCP | HTTP | ...}

Directory Structure:
├── src/
│   ├── handlers/           # Transport-agnostic business logic
│   │   ├── {handler-1}.ts
│   │   ├── {handler-2}.ts
│   │   └── index.ts        # Re-exports
│   ├── commands/           # CLI adapter (if CLI)
│   ├── tools/              # MCP adapter (if MCP)
│   └── index.ts            # Entry point
├── tests/
│   └── handlers/           # Handler tests (mirror src/)
└── package.json

Dependencies:
├── @outfitter/contracts    # Foundation (always)
├── @outfitter/{package-2}  # {reason}
└── @outfitter/{package-3}  # {reason}
```

### Handler Inventory

| Handler | Input | Output | Errors | Description |
|---------|-------|--------|--------|-------------|
| `getUser` | `GetUserInput` | `User` | `NotFoundError` | Fetch user by ID |
| `createUser` | `CreateUserInput` | `User` | `ValidationError`, `ConflictError` | Create new user |
| `updateUser` | `UpdateUserInput` | `User` | `NotFoundError`, `ValidationError` | Update user fields |
| `deleteUser` | `DeleteUserInput` | `void` | `NotFoundError`, `PermissionError` | Remove user |
| `listUsers` | `ListUsersInput` | `PaginatedList<User>` | — | List with pagination |

### Error Strategy Document

```
Project: {PROJECT_NAME}
Domain Errors → Stack Taxonomy:

{DOMAIN_ERROR_1} → {stack-category} ({ErrorClass})
  Condition: {when this error occurs}
  Exit code: {N}
  HTTP status: {NNN}
  Agent hint: {retry | abort | ask_user}

{DOMAIN_ERROR_2} → {stack-category} ({ErrorClass})
  Condition: {when this error occurs}
  Exit code: {N}
  HTTP status: {NNN}
  Agent hint: {retry | abort | ask_user}
```

### Implementation Order

Follow this sequence for predictable progress:

1. **Foundation**
   - Install packages
   - Set up TypeScript config (extend `@outfitter/tooling`)
   - Create shared types

2. **Core handlers**
   - Write tests first (red)
   - Implement handlers (green)
   - Refactor while green

3. **Transport adapters**
   - Wire CLI commands to handlers
   - Wire MCP tools to handlers
   - Each adapter is thin — just input mapping and output formatting

4. **Integration testing**
   - Test across transports
   - Verify error codes map correctly
   - Confirm output modes work

## Design Constraints

### Always

- **Result types over exceptions** — Errors are data, not control flow
- **Map domain errors to taxonomy** — Every error fits a category
- **Pure handler functions** — `(input, ctx) => Result`
- **Plan all transports upfront** — CLI, MCP, HTTP shape the handler contract
- **Explicit error types in signatures** — `Handler<I, O, E1 | E2>`

### Never

- **Throw exceptions in handlers** — Return `Result.err()` instead
- **Transport logic in handlers** — Handlers don't know about CLI flags or MCP schemas
- **Hardcoded paths** — Use XDG via `@outfitter/config`
- **Skip error planning** — Map errors before implementing
- **Couple to specific transport** — Handlers are transport-agnostic

## Example: User Service Design

A complete example tying it together:

```typescript
// types.ts
import { z } from "zod";

export const UserIdSchema = z.string().uuid();
export const EmailSchema = z.string().email();

export const CreateUserInputSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(100),
});

export const GetUserInputSchema = z.object({
  id: UserIdSchema,
});

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// handlers/create-user.ts
import { Handler, createValidator, Result } from "@outfitter/contracts";
import { CreateUserInputSchema, User } from "../types";

const validate = createValidator(CreateUserInputSchema);

export const createUser: Handler<
  unknown,
  User,
  ValidationError | ConflictError
> = async (input, ctx) => {
  // Validate input
  const validated = validate(input);
  if (validated.isErr()) return validated;

  // Check for existing user
  const existing = await ctx.db.findByEmail(validated.value.email);
  if (existing) {
    return Result.err(
      ConflictError.create("User already exists", {
        email: validated.value.email,
      })
    );
  }

  // Create user
  const user = await ctx.db.create({
    id: crypto.randomUUID(),
    ...validated.value,
    createdAt: new Date(),
  });

  ctx.logger.info("User created", { userId: user.id });
  return Result.ok(user);
};
```

## Related Patterns

- [Handler Contract](../patterns/handler.md) — Full handler pattern reference
- [Error Taxonomy](../patterns/errors.md) — All 10 categories with examples
- [CLI Patterns](../patterns/cli.md) — Wiring handlers to CLI commands
- [MCP Patterns](../patterns/mcp.md) — Wiring handlers to MCP tools
