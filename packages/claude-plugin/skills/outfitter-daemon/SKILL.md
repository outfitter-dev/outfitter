---
name: outfitter-daemon
version: 0.1.0
description: Patterns for @outfitter/daemon including lifecycle management, IPC communication, health checks, and PID files. Use when building background services, daemons, or when "daemon", "IPC", "health check", "background service", or "@outfitter/daemon" are mentioned.
allowed-tools: Read Write Edit Glob Grep Bash(bun *)
---

# Daemon Patterns

Deep dive into @outfitter/daemon patterns.

## Creating a Daemon

```typescript
import { createDaemon, getPidPath } from "@outfitter/daemon";
import { createLogger } from "@outfitter/logging";

const logger = createLogger({ name: "my-daemon" });

const daemon = createDaemon({
  name: "my-daemon",
  pidFile: getPidPath("my-daemon"),
  logger,
  shutdownTimeout: 10000, // 10s graceful shutdown
});
```

## Lifecycle

```typescript
// Register shutdown handlers (called on SIGTERM, SIGINT, or daemon.stop())
daemon.onShutdown(async () => {
  logger.info("Shutting down...");
  await closeConnections();
  await flushBuffers();
});

// Start the daemon (writes PID file, registers signal handlers)
const result = await daemon.start();
if (result.isErr()) {
  logger.error("Failed to start", { error: result.error });
  process.exit(1);
}
```

## Communication Patterns

Two approaches for daemon communication, each suited to different use cases.

### HTTP on Unix Socket (recommended for scaffolds)

Simpler pattern using `Bun.serve()` on a Unix socket. Standard REST-style endpoints — any tool can `curl` them. Best for health checks, metrics, admin APIs.

```typescript
import { getSocketPath } from "@outfitter/daemon";

const socketPath = getSocketPath("my-daemon");

const server = Bun.serve({
  unix: socketPath,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        uptime: process.uptime(),
      });
    }

    if (url.pathname === "/shutdown" && request.method === "POST") {
      setTimeout(() => void daemon.stop(), 100);
      return new Response("Shutting down");
    }

    return new Response("Not found", { status: 404 });
  },
});

// Register server cleanup as a shutdown handler
daemon.onShutdown(async () => {
  server.stop();
});
```

CLI commands use `fetch` over the Unix socket:

```typescript
// Stop via HTTP
await fetch(`http://unix:${socketPath}:/shutdown`, { method: "POST" });

// Health check via HTTP
const health = await fetch(`http://unix:${socketPath}:/health`);
```

### IPC (structured messaging)

Lower-level pattern using `createIpcServer`/`createIpcClient` for typed bidirectional messaging over Unix sockets. Best for language servers, editor plugins, agent coordination, or high-frequency communication.

```typescript
import { createIpcServer, getSocketPath } from "@outfitter/daemon";

const ipcServer = createIpcServer(getSocketPath("my-daemon"));

// Handle typed messages
ipcServer.onMessage(async (msg) => {
  const message = msg as { type: string; payload?: unknown };

  switch (message.type) {
    case "status":
      return { status: "ok", uptime: process.uptime() };
    case "reload":
      await reloadConfig();
      return { success: true };
    case "metrics":
      return getMetrics();
    default:
      return { error: "Unknown command" };
  }
});

// Register cleanup
daemon.onShutdown(async () => {
  await ipcServer.close();
});

// Start listening
await ipcServer.listen();
```

CLI commands use the IPC client:

```typescript
import { createIpcClient, getSocketPath } from "@outfitter/daemon";

const client = createIpcClient(getSocketPath("my-daemon"));
await client.connect();

const status = await client.send<{ status: string }>({ type: "status" });
console.log("Status:", status);

client.close();
```

### When to Use Each

| Concern         | HTTP                             | IPC                                         |
| --------------- | -------------------------------- | ------------------------------------------- |
| Simplicity      | Simpler — standard REST patterns | More complex — message framing, correlation |
| External access | Any tool can `curl`              | Requires the IPC client library             |
| Type safety     | Untyped (parse JSON manually)    | Typed request/response protocol             |
| Bidirectional   | Request/response only            | Full bidirectional messaging                |
| Best for        | Admin APIs, health, metrics      | Language servers, editor plugins, agents    |

The scaffold `daemon` preset uses HTTP by default. Use `--example ipc` for the IPC pattern.

## Health Checks

```typescript
import { createHealthChecker } from "@outfitter/daemon";
import { Result } from "@outfitter/contracts";

const healthChecker = createHealthChecker([
  {
    name: "memory",
    check: async () => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      return used < 500
        ? Result.ok(undefined)
        : Result.err(new Error(`High memory: ${used.toFixed(2)}MB`));
    },
  },
  {
    name: "database",
    check: async () => {
      try {
        await db.ping();
        return Result.ok(undefined);
      } catch {
        return Result.err(new Error("Database unreachable"));
      }
    },
  },
]);
```

### Exposing Health via HTTP

```typescript
if (url.pathname === "/health") {
  const result = await healthChecker.check();
  return Response.json({
    healthy: result.isOk(),
    checks: result.isOk() ? result.value : result.error,
  });
}
```

## PID File Management

### XDG Paths

```typescript
import { getPidPath, getSocketPath, getDaemonDir } from "@outfitter/daemon";

// PID file: ~/.local/state/my-daemon/my-daemon.pid
const pidPath = getPidPath("my-daemon");

// Socket: ~/.local/state/my-daemon/my-daemon.sock
const socketPath = getSocketPath("my-daemon");

// Daemon directory: ~/.local/state/my-daemon/
const daemonDir = getDaemonDir("my-daemon");
```

### Checking if Running

```typescript
import { isDaemonAlive, getPidPath } from "@outfitter/daemon";

const pidPath = getPidPath("my-daemon");
if (await isDaemonAlive(pidPath)) {
  console.log("Daemon already running");
  process.exit(1);
}
```

## CLI Integration

### Start Command

```typescript
import { command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { ConflictError, Result } from "@outfitter/contracts";
import { getPidPath, isDaemonAlive } from "@outfitter/daemon";
import { spawn } from "node:child_process";

const pidPath = getPidPath("my-daemon");

command("start")
  .description("Start the daemon")
  .option("-f, --foreground", "Run in foreground")
  .action(async ({ flags }) => {
    const foreground = Boolean(flags["foreground"]);

    await runHandler({
      command: "start",
      input: { foreground },
      handler: async ({ foreground: fg }) => {
        if (await isDaemonAlive(pidPath)) {
          return Result.err(ConflictError.create("Daemon is already running"));
        }

        if (fg) {
          const { runDaemon } = await import("./daemon-main.js");
          await runDaemon();
          return Result.ok({ status: "exited", mode: "foreground" });
        }

        const daemon = spawn(
          process.execPath,
          [import.meta.dir + "/daemon.js"],
          {
            detached: true,
            stdio: "ignore",
          }
        );
        daemon.unref();
        return Result.ok({ status: "started", pid: daemon.pid ?? null });
      },
    });
  });
```

### Stop Command (HTTP pattern)

```typescript
import { NotFoundError, NetworkError, Result } from "@outfitter/contracts";
import { getSocketPath, getPidPath, isDaemonAlive } from "@outfitter/daemon";

const socketPath = getSocketPath("my-daemon");
const pidPath = getPidPath("my-daemon");

command("stop")
  .description("Stop the daemon")
  .action(async () => {
    await runHandler({
      command: "stop",
      input: {},
      handler: async () => {
        if (!(await isDaemonAlive(pidPath))) {
          return Result.err(NotFoundError.create("daemon", "process"));
        }

        try {
          const response = await fetch(`http://unix:${socketPath}:/shutdown`, {
            method: "POST",
          });
          if (!response.ok) {
            return Result.err(NetworkError.create("Failed to stop daemon"));
          }
          return Result.ok({ status: "stopped" });
        } catch {
          return Result.err(NetworkError.create("Failed to reach daemon"));
        }
      },
    });
  });
```
