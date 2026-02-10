# @outfitter/mcp

MCP (Model Context Protocol) server framework with typed tools and Result-based error handling.

## Installation

```bash
bun add @outfitter/mcp
```

## Quick Start

```typescript
import { createMcpServer, defineTool } from "@outfitter/mcp";
import { Result } from "@outfitter/contracts";
import { z } from "zod";

const server = createMcpServer({
  name: "calculator",
  version: "1.0.0",
});

server.registerTool(
  defineTool({
    name: "add",
    description: "Add two numbers together",
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
    }),
    handler: async (input, ctx) => {
      ctx.logger.debug("Adding numbers", { a: input.a, b: input.b });
      return Result.ok({ sum: input.a + input.b });
    },
  })
);

await server.start();
```

## Features

- **Typed Tools** — Define tools with Zod schemas for automatic input validation
- **Result-Based Errors** — All operations return `Result<T, E>` for explicit error handling
- **Handler Contract** — Tools use the same `Handler` pattern as other Outfitter packages
- **Core Tools** — Built-in docs, config, and query tools for common patterns
- **Deferred Loading** — Support for MCP tool search with `deferLoading` flag

## API Reference

### createMcpServer(options)

Creates an MCP server instance.

```typescript
interface McpServerOptions {
  name: string;           // Server name for MCP handshake
  version: string;        // Server version (semver)
  logger?: Logger;        // Optional structured logger (BYO)
  defaultLogLevel?: McpLogLevel | null; // Default log forwarding level
}

const server = createMcpServer({
  name: "my-server",
  version: "1.0.0",
});

// If `logger` is omitted, Outfitter logger factory defaults are used.
```

### Bring Your Own Logger (BYO)

`createMcpServer` accepts any logger implementing the shared `Logger` contract.
This lets you use the default Outfitter backend or a custom backend adapter.

#### Outfitter factory backend

```typescript
import { createOutfitterLoggerFactory } from "@outfitter/logging";

const loggerFactory = createOutfitterLoggerFactory();
const server = createMcpServer({
  name: "my-server",
  version: "1.0.0",
  logger: loggerFactory.createLogger({
    name: "mcp",
    context: { surface: "mcp" },
  }),
});
```

#### Custom adapter backend

```typescript
import {
  createLoggerFactory,
  type Logger,
  type LoggerAdapter,
} from "@outfitter/contracts";

type BackendOptions = { write: (line: string) => void };

const adapter: LoggerAdapter<BackendOptions> = {
  createLogger(config) {
    const write = config.backend?.write ?? (() => {});
    const createMethod = (level: string): Logger["info"] =>
      ((message: string) => {
        write(`[${level}] ${config.name}: ${message}`);
      }) as Logger["info"];

    return {
      trace: createMethod("trace"),
      debug: createMethod("debug"),
      info: createMethod("info"),
      warn: createMethod("warn"),
      error: createMethod("error"),
      fatal: createMethod("fatal"),
      child: (childContext) =>
        adapter.createLogger({
          ...config,
          context: { ...(config.context ?? {}), ...childContext },
        }),
    };
  },
};

const loggerFactory = createLoggerFactory(adapter);
const server = createMcpServer({
  name: "my-server",
  version: "1.0.0",
  logger: loggerFactory.createLogger({
    name: "mcp",
    backend: { write: (line) => console.log(line) },
  }),
});
```

### Log Forwarding

MCP servers can forward log messages to the connected client. The default log level is resolved from environment configuration:

**Precedence** (highest wins):
1. `OUTFITTER_LOG_LEVEL` environment variable
2. `options.defaultLogLevel`
3. `OUTFITTER_ENV` profile defaults (`"debug"` in development, `null` otherwise)
4. `null` (no forwarding)

```typescript
const server = createMcpServer({
  name: "my-server",
  version: "1.0.0",
  // Forwarding level auto-resolved from OUTFITTER_ENV
});

// With OUTFITTER_ENV=development → forwards at "debug"
// With OUTFITTER_ENV=production → no forwarding (null)
// With OUTFITTER_LOG_LEVEL=error → forwards at "error"
```

Set `defaultLogLevel: null` to explicitly disable forwarding regardless of environment. The MCP client can always override via `logging/setLevel`.

#### `sendLogMessage(level, data, loggerName?)`

Send a log message to the connected MCP client.

```typescript
server.sendLogMessage("info", "Indexing complete", "my-server");
server.sendLogMessage("warning", { message: "Rate limited", retryAfter: 30 });
```

Only sends if the message level meets or exceeds the current client log level threshold.

### defineTool(definition)

Helper for defining typed tools with better type inference.

```typescript
interface ToolDefinition<TInput, TOutput, TError> {
  name: string;                    // Unique tool name (kebab-case)
  description: string;             // Human-readable description
  inputSchema: z.ZodType<TInput>;  // Zod schema for validation
  handler: Handler<TInput, TOutput, TError>;
  deferLoading?: boolean;          // Default: true
}

const getUserTool = defineTool({
  name: "get-user",
  description: "Retrieve a user by their unique ID",
  inputSchema: z.object({ userId: z.string().uuid() }),
  handler: async (input, ctx) => {
    const user = await db.users.find(input.userId);
    if (!user) {
      return Result.err(new NotFoundError("user", input.userId));
    }
    return Result.ok(user);
  },
});
```

### defineResource(definition)

Helper for defining MCP resources.

```typescript
interface ResourceDefinition {
  uri: string;           // Unique resource URI
  name: string;          // Human-readable name
  description?: string;  // Optional description
  mimeType?: string;     // Content MIME type
  handler?: ResourceReadHandler; // Optional resources/read handler
}

const configResource = defineResource({
  uri: "file:///etc/app/config.json",
  name: "Application Config",
  description: "Main configuration file",
  mimeType: "application/json",
  handler: async (uri, ctx) => {
    ctx.logger.debug("Reading config resource", { uri });
    return Result.ok([
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ debug: true }),
      },
    ]);
  },
});
```

Registered resources with handlers are exposed through MCP `resources/read`.

```typescript
server.registerResource(configResource);

const contentResult = await server.readResource("file:///etc/app/config.json");
```

### Server Methods

```typescript
interface McpServer {
  readonly name: string;
  readonly version: string;

  // Registration
  registerTool<TInput, TOutput, TError>(tool: ToolDefinition): void;
  registerResource(resource: ResourceDefinition): void;
  registerResourceTemplate(template: ResourceTemplateDefinition): void;

  // Introspection
  getTools(): SerializedTool[];
  getResources(): ResourceDefinition[];
  getResourceTemplates(): ResourceTemplateDefinition[];

  // Invocation
  readResource(uri: string): Promise<Result<ResourceContent[], McpError>>;
  invokeTool<T>(name: string, input: unknown, options?: InvokeToolOptions): Promise<Result<T, McpError>>;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

### McpHandlerContext

Extended handler context for MCP tools with additional metadata:

```typescript
interface McpHandlerContext extends HandlerContext {
  toolName?: string;  // Name of the tool being invoked
}
```

## Core Tools

Pre-built tools for common MCP patterns. These are marked with `deferLoading: false` for immediate availability.

### Docs Tool

Provides documentation, usage patterns, and examples.

```typescript
import { defineDocsTool, createCoreTools } from "@outfitter/mcp";

const docsTool = defineDocsTool({
  docs: {
    overview: "Calculator server for arithmetic operations",
    tools: [{ name: "add", summary: "Add two numbers" }],
    examples: [{ input: { a: 2, b: 3 }, description: "Basic addition" }],
  },
});

// Or use getDocs for dynamic content
const dynamicDocsTool = defineDocsTool({
  getDocs: async (section) => {
    return loadDocsFromFile(section);
  },
});
```

### Config Tool

Read and modify server configuration.

```typescript
import { defineConfigTool } from "@outfitter/mcp";

const configTool = defineConfigTool({
  initial: { debug: false, maxRetries: 3 },
});

// With custom store
const persistedConfigTool = defineConfigTool({
  store: {
    get: async (key) => db.config.get(key),
    set: async (key, value) => db.config.set(key, value),
    list: async () => db.config.all(),
  },
});
```

### Query Tool

Search and discovery with pagination.

```typescript
import { defineQueryTool } from "@outfitter/mcp";

const queryTool = defineQueryTool({
  handler: async (input, ctx) => {
    const results = await searchIndex(input.q, {
      limit: input.limit,
      cursor: input.cursor,
      filters: input.filters,
    });
    return Result.ok({
      results: results.items,
      nextCursor: results.nextCursor,
    });
  },
});
```

### Bundle All Core Tools

```typescript
import { createCoreTools } from "@outfitter/mcp";

const coreTools = createCoreTools({
  docs: { docs: myDocs },
  config: { initial: myConfig },
  query: { handler: myQueryHandler },
});

for (const tool of coreTools) {
  server.registerTool(tool);
}
```

## Transport Helpers

### connectStdio

Connect server to stdio transport for Claude Desktop integration.

```typescript
import { createMcpServer, connectStdio } from "@outfitter/mcp";

const server = createMcpServer({ name: "my-server", version: "1.0.0" });
// ... register tools ...

await connectStdio(server);
```

### createSdkServer

Create the underlying `@modelcontextprotocol/sdk` server.

```typescript
import { createSdkServer } from "@outfitter/mcp";

const { server: sdkServer, toolsList, callTool } = createSdkServer(mcpServer);
```

## Error Handling

Tools return Results with typed errors. The framework automatically translates `OutfitterError` categories to JSON-RPC error codes:

| Category | JSON-RPC Code | Description |
|----------|--------------|-------------|
| `validation` | -32602 | Invalid params |
| `not_found` | -32601 | Method not found |
| `permission` | -32600 | Invalid request |
| `internal` | -32603 | Internal error |

```typescript
const result = await server.invokeTool("get-user", { userId: "123" });

if (result.isErr()) {
  // result.error is McpError with code and context
  console.error(result.error.message, result.error.code);
}
```

## Schema Utilities

### zodToJsonSchema

Convert Zod schemas to JSON Schema for MCP protocol.

```typescript
import { zodToJsonSchema } from "@outfitter/mcp";

const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
});

const jsonSchema = zodToJsonSchema(schema);
// { type: "object", properties: { name: { type: "string" }, ... } }
```

## Action Adapter

### buildMcpTools

Build MCP tools from an action registry (for structured action-based servers).

```typescript
import { buildMcpTools } from "@outfitter/mcp";

const tools = buildMcpTools({
  actions: myActionRegistry,
  prefix: "myapp",
});

for (const tool of tools) {
  server.registerTool(tool);
}
```

## Claude Desktop Configuration

Add your MCP server to Claude Desktop:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "bun",
      "args": ["run", "/path/to/server.ts"]
    }
  }
}
```

Config location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

## Related Packages

- [@outfitter/contracts](../contracts/README.md) — Result types and error taxonomy
- [@outfitter/logging](../logging/README.md) — Structured logging
- [@outfitter/config](../config/README.md) — Configuration loading
