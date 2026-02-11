---
package: "@outfitter/mcp"
version: 0.3.0
breaking: false
---

# @outfitter/mcp → 0.3.0

## New APIs

### `defaultLogLevel` on `McpServerOptions`

Server instances can define default client-facing log forwarding thresholds with
shared precedence:

1. `OUTFITTER_LOG_LEVEL`
2. `options.defaultLogLevel`
3. `OUTFITTER_ENV` profile defaults
4. `null` (no forwarding)

```typescript
import { createMcpServer } from "@outfitter/mcp";

const server = createMcpServer({
  name: "my-server",
  version: "1.0.0",
  defaultLogLevel: "warning",
});
```

### `sendLogMessage()`

Forward server logs to connected MCP clients through a typed surface.

```typescript
server.sendLogMessage("info", { action: "sync_started" }, "sync-runner");
```

The method is level-filtered and no-ops when forwarding is disabled.

### Default Outfitter Logger Factory Integration

When `logger` is not provided, MCP now uses the Outfitter logger factory with
sane defaults for stderr output and flush lifecycle.

## Migration Steps

### Replace Custom Default Log-Level Wiring

**Before:**

```typescript
const defaultLevel = process.env["OUTFITTER_LOG_LEVEL"] ?? "warning";
const server = createMcpServer({ name, version });
server.setLogLevel?.(defaultLevel);
```

**After:**

```typescript
const server = createMcpServer({
  name,
  version,
  defaultLogLevel: "warning",
});
```

### Replace Direct SDK Logging Calls

**Before:**

```typescript
sdkServer.sendLoggingMessage?.({ level: "info", data: payload });
```

**After:**

```typescript
server.sendLogMessage("info", payload);
```

## No Action Required

- Tool/resource/prompt registration APIs are unchanged
- Existing handlers and Result-based error translation are unchanged
- `defaultLogLevel` is optional, so existing server setup stays valid
