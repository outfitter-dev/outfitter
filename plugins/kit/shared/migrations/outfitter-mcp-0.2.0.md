---
package: "@outfitter/mcp"
version: 0.2.0
breaking: false
---

# @outfitter/mcp → 0.2.0

## New APIs

### Tool Annotations

Tools can now declare behavioral hints for clients via `annotations`:

```typescript
import { defineTool } from "@outfitter/mcp";

const listUsers = defineTool({
  name: "list-users",
  description: "List all users",
  inputSchema: z.object({ limit: z.number().optional() }),
  annotations: {
    readOnlyHint: true,       // Does not modify state
    destructiveHint: false,   // Not destructive
    idempotentHint: true,     // Same input → same result
    openWorldHint: false,     // Operates on closed dataset
  },
  handler: async (input, ctx) => { /* ... */ },
});
```

Annotation hints help clients make decisions about confirmation dialogs, caching, and retry behavior.

### Resource Read Handlers

Resources can now include inline read handlers instead of relying on external dispatch:

```typescript
import type { ResourceDefinition } from "@outfitter/mcp";

const configResource: ResourceDefinition = {
  uri: "config:///app",
  name: "App Configuration",
  description: "Current application configuration",
  mimeType: "application/json",
  handler: async (uri, ctx) => {
    const config = await loadConfig();
    return Result.ok([{ uri, text: JSON.stringify(config) }]);
  },
};
```

### Resource Templates

URI-templated resources with variable completion:

```typescript
import type { ResourceTemplateDefinition } from "@outfitter/mcp";

const userProfile: ResourceTemplateDefinition = {
  uriTemplate: "db:///users/{userId}/profile",
  name: "User Profile",
  description: "Profile for a specific user",
  handler: async (uri, variables, ctx) => {
    const user = await getUser(variables.userId);
    return Result.ok([{
      uri,
      text: JSON.stringify(user),
      mimeType: "application/json",
    }]);
  },
  complete: {
    userId: async (partial) => {
      const users = await searchUsers(partial);
      return { values: users.map((u) => u.id) };
    },
  },
};
```

### Prompt System

Define reusable prompt templates for MCP clients:

```typescript
import type { PromptDefinition } from "@outfitter/mcp";

const codeReview: PromptDefinition = {
  name: "code-review",
  description: "Review code changes",
  arguments: [
    { name: "file", description: "File to review", required: true },
    { name: "focus", description: "Review focus area", required: false },
  ],
  handler: async (args, ctx) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review ${args.file} focusing on ${args.focus ?? "general quality"}`,
          },
        },
      ],
    };
  },
};
```

### Content Annotations

Annotate content with audience and priority hints:

```typescript
{
  type: "text",
  text: "Debug trace information",
  annotations: {
    audience: ["assistant"],  // Not shown to user
    priority: 0.2,            // Low priority
  },
}
```

### Completions, Logging, Notifications, Progress

- **Completions**: Resource template variables and prompt arguments support auto-completion handlers
- **Logging**: Structured logging via `ctx.logger` with severity levels
- **Notifications**: Server-to-client notifications for resource changes
- **Progress**: Long-running operations can report progress via `ctx.progress(current, total)`

## Migration Steps

### Add annotations to existing tools

**Before:**
```typescript
const tool = defineTool({
  name: "delete-user",
  description: "Delete a user",
  inputSchema: z.object({ id: z.string() }),
  handler: deleteUserHandler,
});
```

**After:**
```typescript
const tool = defineTool({
  name: "delete-user",
  description: "Delete a user",
  inputSchema: z.object({ id: z.string() }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  handler: deleteUserHandler,
});
```

### Add `.describe()` to Zod schemas for MCP tools

MCP clients use schema descriptions for tool documentation:

```typescript
// Before
z.object({ limit: z.number().optional() })

// After
z.object({
  limit: z.number().optional().describe("Maximum number of results to return"),
})
```

## No Action Required

- Existing tool definitions work without annotations
- `deferLoading` defaults to `true` (unchanged)
- Handler signatures are backward-compatible
- Resource and prompt systems are additive
