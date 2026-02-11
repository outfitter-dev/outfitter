# MCP Server Patterns

Deep dive into @outfitter/mcp patterns for building MCP servers with typed tools, resources, prompts, and logging.

## Creating a Server

```typescript
import { createMcpServer } from "@outfitter/mcp";

const server = createMcpServer({
  name: "my-server",
  version: "0.1.0",
  logger: myLogger,          // optional — defaults to Outfitter logger factory
  defaultLogLevel: "info",   // optional — client log forwarding level
});

// Register tools, resources, prompts before start
server.registerTool(searchTool);
server.registerResource(configResource);
server.registerPrompt(reviewPrompt);

// Start server
await server.start();
```

### McpServerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | required | Server name for MCP handshake |
| `version` | `string` | required | Server version (semver) |
| `logger` | `Logger` | auto-created | Logger instance |
| `defaultLogLevel` | `McpLogLevel \| null` | env-resolved | Default client log forwarding level |

**Log level precedence** for `defaultLogLevel`:

1. `OUTFITTER_LOG_LEVEL` env var
2. `defaultLogLevel` option
3. `OUTFITTER_ENV` profile
4. `null` (no forwarding until client opts in)

## Tool Definition

### Using defineTool()

The `defineTool()` helper provides full type inference from the Zod schema:

```typescript
import { defineTool } from "@outfitter/mcp";
import { Result, ValidationError } from "@outfitter/contracts";
import { z } from "zod";

const InputSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  limit: z.number().int().positive().default(10).describe("Max results"),
});

export const searchTool = defineTool({
  name: "search",
  description: "Search for items. Use when user asks to find or search.",
  inputSchema: InputSchema,

  handler: async (input, ctx) => {
    ctx.logger.debug("Searching", { query: input.query });
    const results = await performSearch(input.query, input.limit);
    return Result.ok({ results, total: results.length });
  },
});
```

### Tool Annotations

Behavioral hints help clients understand tool behavior without invoking them:

```typescript
export const deleteTool = defineTool({
  name: "delete-item",
  description: "Permanently delete an item by ID",
  inputSchema: z.object({ id: z.string().describe("Item ID") }),
  annotations: {
    readOnlyHint: false,      // modifies state
    destructiveHint: true,    // may delete data
    idempotentHint: true,     // same input = same effect
    openWorldHint: false,     // no external system interaction
  },
  handler: async (input, ctx) => {
    // ...
  },
});
```

| Annotation | Type | Description |
|-----------|------|-------------|
| `readOnlyHint` | `boolean` | Tool does not modify any state |
| `destructiveHint` | `boolean` | Tool may perform destructive operations |
| `idempotentHint` | `boolean` | Multiple calls with same input have same effect |
| `openWorldHint` | `boolean` | Tool may interact with external systems |

### Deferred Tool Loading

Tools default to deferred loading (`deferLoading: true`). Clients discover them via tool search. Set `deferLoading: false` for core tools that should always be listed:

```typescript
export const helpTool = defineTool({
  name: "help",
  description: "Show available commands and usage",
  deferLoading: false, // Always listed, not deferred
  inputSchema: z.object({}),
  handler: async () => Result.ok({ commands: [...] }),
});
```

### Schema Best Practices

```typescript
const InputSchema = z.object({
  // Always use .describe() for AI understanding
  query: z.string().describe("The search term to look for"),

  // Provide defaults where sensible
  limit: z.number().default(10).describe("Maximum number of results"),

  // Use enums for fixed choices
  sortBy: z.enum(["name", "date", "relevance"]).default("relevance")
    .describe("Field to sort results by"),

  // Mark optional fields explicitly
  tags: z.array(z.string()).optional().describe("Filter by tags"),
});
```

## Resources

### Static Resource (defineResource)

```typescript
import { defineResource } from "@outfitter/mcp";

const configResource = defineResource({
  uri: "config://settings",
  name: "Configuration",
  description: "Current server configuration",
  mimeType: "application/json",
  handler: async (uri, ctx) => {
    return Result.ok([{ uri, text: JSON.stringify(config, null, 2) }]);
  },
});

server.registerResource(configResource);
```

### Resource Templates (defineResourceTemplate)

URI templates with `{param}` placeholders (RFC 6570 Level 1):

```typescript
import { defineResourceTemplate } from "@outfitter/mcp";

const userTemplate = defineResourceTemplate({
  uriTemplate: "db:///users/{userId}/profile",
  name: "User Profile",
  description: "User profile by ID",
  mimeType: "application/json",
  handler: async (uri, variables, ctx) => {
    const profile = await getProfile(variables.userId);
    return Result.ok([{ uri, text: JSON.stringify(profile) }]);
  },
  complete: {
    userId: async (value) => {
      const users = await searchUsers(value);
      return { values: users.map(u => u.id) };
    },
  },
});

server.registerResourceTemplate(userTemplate);
```

### Resource Notifications

```typescript
// Subscribe/unsubscribe (managed by client)
server.subscribe("config://settings");
server.unsubscribe("config://settings");

// Notify clients of updates
server.notifyResourceUpdated("config://settings");
server.notifyResourcesChanged(); // resource list changed
```

## Prompts

```typescript
import { definePrompt } from "@outfitter/mcp";

const reviewPrompt = definePrompt({
  name: "code-review",
  description: "Review code changes with specific focus",
  arguments: [
    { name: "language", description: "Programming language", required: true },
    { name: "focus", description: "Review focus area", required: false },
  ],
  handler: async (args) => {
    return Result.ok({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Review this ${args.language} code. Focus: ${args.focus ?? "general quality"}`,
        },
      }],
    });
  },
});

server.registerPrompt(reviewPrompt);
server.notifyPromptsChanged(); // prompt list changed
```

## Server Logging

### Log Forwarding to Clients

The server can forward log messages to connected MCP clients:

```typescript
// Send log message to client
server.sendLogMessage("info", "Processing complete", "my-tool");
server.sendLogMessage("warning", { message: "Rate limited", retryAfter: 30 });

// Set client-requested log level
server.setLogLevel("warning"); // only forward warning+ to client
```

**MCP log levels** (ordered): `debug` < `info` < `notice` < `warning` < `error` < `critical` < `alert` < `emergency`

### sendLogMessage Signature

```typescript
sendLogMessage(
  level: McpLogLevel,      // MCP severity level
  data: unknown,           // String, object, or any serializable value
  loggerName?: string,     // Optional logger name for client-side filtering
): void
```

Messages below the client's threshold are silently dropped. No-op if no SDK server is bound.

## Error Handling

### Returning Errors from Tools

```typescript
handler: async (input, ctx) => {
  if (!input.query) {
    return Result.err(ValidationError.create("query", "is required"));
  }

  const item = await findItem(input.id);
  if (!item) {
    return Result.err(NotFoundError.create("item", input.id));
  }

  return Result.ok(item);
}
```

Outfitter errors are automatically translated to MCP errors (JSON-RPC codes):

| Category | JSON-RPC Code |
|----------|---------------|
| `validation` | -32602 (Invalid params) |
| `not_found` | -32601 (Method not found) |
| `permission`, `auth` | -32600 (Invalid request) |
| Everything else | -32603 (Internal error) |

## Server Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "bun",
      "args": ["run", "/path/to/server.ts"],
      "env": {
        "OUTFITTER_ENV": "development",
        "OUTFITTER_LOG_LEVEL": "debug"
      }
    }
  }
}
```

## Testing MCP Tools

```typescript
import { createMcpHarness } from "@outfitter/testing";

const harness = createMcpHarness(myTool);

test("tool returns results", async () => {
  const result = await harness.invoke({ query: "test" });

  expect(result.isOk()).toBe(true);
  expect(result.value.results).toHaveLength(3);
});
```

## Best Practices

1. **Descriptive schemas** — Use `.describe()` on every Zod field
2. **Sensible defaults** — Provide `.default()` where appropriate
3. **Tool annotations** — Add behavioral hints for clients
4. **Error categories** — Use taxonomy errors for proper handling
5. **Logging** — Log tool invocations via `ctx.logger` for debugging
6. **Test harnesses** — Use `createMcpHarness` from `@outfitter/testing`
7. **Deferred loading** — Keep `deferLoading: true` for domain tools
