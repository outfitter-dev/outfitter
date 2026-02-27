# Dynamic Tool Registration

Calling `registerTool()` after `connectStdio()` automatically sends a `tools/list_changed` notification to the connected client. The client then re-fetches the tool list and discovers the new tools — no manual notification step required.

This enables patterns like auth-gated registration, where read-only tools are available immediately and write tools appear only after the caller proves authorization.

## How It Works

`connectStdio()` binds an SDK server internally. Once bound, every `registerTool()` call triggers `sendToolListChanged()` on the SDK server, which the MCP protocol translates into a `notifications/tools/list_changed` message to the client.

Before binding (i.e., before `connectStdio()`), `registerTool()` silently adds the tool with no notification — there's no client to notify yet.

```
registerTool(readTool)   →  tool stored, no notification (no client yet)
connectStdio()           →  SDK server bound, client connected
registerTool(writeTool)  →  tool stored + tools/list_changed sent automatically
```

**Source reference:** In `server.ts`, `registerTool()` checks whether the SDK server is bound and calls `sendToolListChanged()` if so:

```typescript
tools.set(tool.name, stored);
if (sdkServer) {
  sdkServer.sendToolListChanged?.();
}
```

The same auto-notification applies to `registerResource()`, `registerResourceTemplate()`, and `registerPrompt()`.

## Auth-Gated Dynamic Registration

A common pattern is registering base (read-only) tools before connecting, then adding write tools after verifying the caller's authorization:

```typescript
import {
  createMcpServer,
  connectStdio,
  defineTool,
  TOOL_ANNOTATIONS,
} from "@outfitter/mcp";
import { Result } from "@outfitter/contracts";
import { z } from "zod";

const server = createMcpServer({ name: "my-server", version: "1.0.0" });

// 1. Register read-only tools before connecting
server.registerTool(
  defineTool({
    name: "list-items",
    description: "List all items in the workspace",
    inputSchema: z.object({}),
    annotations: TOOL_ANNOTATIONS.readOnly,
    handler: async (input, ctx) => {
      const items = await db.items.list();
      return Result.ok({ items });
    },
  })
);

// 2. Connect — client sees only read-only tools initially
await connectStdio(server);

// 3. Verify authorization (your logic)
const hasWriteAccess = await checkCallerAuth();

// 4. Conditionally register write tools — client auto-discovers them
if (hasWriteAccess) {
  server.registerTool(
    defineTool({
      name: "create-item",
      description: "Create a new item in the workspace",
      inputSchema: z.object({ title: z.string() }),
      annotations: TOOL_ANNOTATIONS.write,
      handler: async (input, ctx) => {
        const item = await db.items.create({ title: input.title });
        return Result.ok(item);
      },
    })
  );

  server.registerTool(
    defineTool({
      name: "delete-item",
      description: "Delete an item by ID",
      inputSchema: z.object({ id: z.string() }),
      annotations: TOOL_ANNOTATIONS.destructive,
      handler: async (input, ctx) => {
        await db.items.delete(input.id);
        return Result.ok({ deleted: true });
      },
    })
  );
}
```

The client receives a `tools/list_changed` notification for each `registerTool()` call after `connectStdio()`, then re-fetches the tool list to discover the newly available tools.

## Manual Notifications

For bulk registration or other scenarios where you want explicit control over when the notification fires, use `notifyToolsChanged()`:

```typescript
// Register several tools without per-tool notifications
// (each registerTool still auto-notifies, but you can also trigger manually)
server.notifyToolsChanged();
```

The same pattern applies to resources (`notifyResourcesChanged()`) and prompts (`notifyPromptsChanged()`).

## See Also

- [Bridging Domain Errors with `adaptHandler()`](./adapt-handler.md) — registering handlers with non-Outfitter error types
- [Error Handling Patterns](../../contracts/docs/error-handling-patterns.md) — error boundaries and taxonomy
