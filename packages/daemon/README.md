# @outfitter/daemon

Daemon lifecycle management, IPC communication, and health checks for background processes.

## Installation

```bash
bun add @outfitter/daemon
```

## Quick Start

```typescript
import {
  createDaemon,
  createIpcServer,
  createHealthChecker,
  getSocketPath,
  getLockPath,
} from "@outfitter/daemon";

// Create a daemon with lifecycle management
const daemon = createDaemon({
  name: "my-service",
  pidFile: getLockPath("my-service"),
  shutdownTimeout: 10000,
});

// Register cleanup handlers
daemon.onShutdown(async () => {
  await database.close();
});

// Start the daemon
const result = await daemon.start();
if (result.isErr()) {
  console.error("Failed to start:", result.error.message);
  process.exit(1);
}

// Set up IPC server
const server = createIpcServer(getSocketPath("my-service"));
server.onMessage(async (msg) => {
  if (msg.type === "status") {
    return { status: "ok", uptime: process.uptime() };
  }
  return { error: "Unknown command" };
});
await server.listen();
```

## Platform Detection

Utilities for detecting the platform and resolving platform-specific paths.

### isUnixPlatform

Check if running on a Unix-like platform (macOS or Linux).

```typescript
import { isUnixPlatform } from "@outfitter/daemon";

if (isUnixPlatform()) {
  // Use Unix domain sockets
} else {
  // Use named pipes (Windows)
}
```

### Path Resolution

Get platform-appropriate paths for daemon files.

```typescript
import {
  getSocketPath,
  getLockPath,
  getPidPath,
  getDaemonDir,
} from "@outfitter/daemon";

const socketPath = getSocketPath("waymark");
// Linux: "/run/user/1000/waymark/daemon.sock"
// macOS: "/var/folders/.../waymark/daemon.sock"
// Windows: "\\\\.\\pipe\\waymark-daemon"

const lockPath = getLockPath("waymark");
// Linux: "/run/user/1000/waymark/daemon.lock"

const pidPath = getPidPath("waymark");
// Linux: "/run/user/1000/waymark/daemon.pid"

const daemonDir = getDaemonDir("waymark");
// Linux: "/run/user/1000/waymark"
```

Path resolution follows XDG standards:
- `$XDG_RUNTIME_DIR` takes precedence if set
- Linux: Falls back to `/run/user/<uid>`
- macOS: Uses `$TMPDIR`
- Windows: Uses `%TEMP%`

## Locking

PID-based locking with stale detection for ensuring single daemon instances.

### Acquire and Release Locks

```typescript
import {
  acquireDaemonLock,
  releaseDaemonLock,
  type LockHandle,
} from "@outfitter/daemon";

const result = await acquireDaemonLock("/run/user/1000/waymark/daemon.lock");

if (result.isOk()) {
  const handle: LockHandle = result.value;
  console.log(`Lock acquired for PID ${handle.pid}`);

  try {
    // ... run daemon ...
  } finally {
    await releaseDaemonLock(handle);
  }
} else {
  console.error(`Failed to acquire lock: ${result.error.message}`);
}
```

### Process Liveness Checks

```typescript
import { isProcessAlive, isDaemonAlive, readLockPid } from "@outfitter/daemon";

// Check if a specific PID is alive
if (isProcessAlive(12345)) {
  console.log("Process is still running");
}

// Check if a daemon is alive via its lock file
const alive = await isDaemonAlive("/run/user/1000/waymark/daemon.lock");
if (!alive) {
  // Safe to start a new daemon
}

// Read the PID from a lock file
const pid = await readLockPid("/run/user/1000/waymark/daemon.lock");
if (pid !== undefined) {
  console.log(`Daemon running with PID ${pid}`);
}
```

### LockHandle Interface

```typescript
interface LockHandle {
  readonly lockPath: string;  // Path to the lock file
  readonly pid: number;       // PID that owns the lock
}
```

## Lifecycle

Daemon lifecycle management with PID file handling, signal handling, and graceful shutdown.

### Creating a Daemon

```typescript
import { createDaemon, type DaemonOptions } from "@outfitter/daemon";

const options: DaemonOptions = {
  name: "my-daemon",
  pidFile: "/var/run/my-daemon.pid",
  logger: myLogger,           // Optional @outfitter/logging instance
  shutdownTimeout: 10000,     // Optional, default: 5000ms
};

const daemon = createDaemon(options);
```

### Daemon Lifecycle

```typescript
// Register shutdown handlers (called during graceful shutdown)
daemon.onShutdown(async () => {
  await database.close();
});

daemon.onShutdown(async () => {
  await cache.disconnect();
});

// Start the daemon
const startResult = await daemon.start();
if (startResult.isErr()) {
  console.error("Failed to start:", startResult.error.message);
  process.exit(1);
}

// Check running state
console.log("Running:", daemon.isRunning());  // true
console.log("State:", daemon.state);          // "running"

// Stop gracefully (also triggered by SIGTERM/SIGINT)
const stopResult = await daemon.stop();
if (stopResult.isErr()) {
  console.error("Shutdown issue:", stopResult.error.message);
}
```

### Daemon States

The daemon follows a state machine:

| State | Description |
|-------|-------------|
| `stopped` | Initial state, daemon not running |
| `starting` | Transitioning to running (creating PID file) |
| `running` | Daemon is active and processing |
| `stopping` | Graceful shutdown in progress |

State transitions:
- `stopped` -> `starting` -> `running` (via `start()`)
- `running` -> `stopping` -> `stopped` (via `stop()` or signal)
- `starting` -> `stopped` (if start fails)

### Daemon Interface

```typescript
interface Daemon {
  readonly state: DaemonState;
  start(): Promise<Result<void, DaemonError>>;
  stop(): Promise<Result<void, DaemonError>>;
  isRunning(): boolean;
  onShutdown(handler: ShutdownHandler): void;
}

type DaemonState = "stopped" | "starting" | "running" | "stopping";
type ShutdownHandler = () => Promise<void>;
```

## IPC

Inter-process communication via Unix domain sockets using JSON-serialized messages.

### IPC Server

```typescript
import { createIpcServer, type IpcServer } from "@outfitter/daemon";

const server: IpcServer = createIpcServer("/var/run/my-daemon.sock");

// Register message handler
server.onMessage(async (msg) => {
  const message = msg as { type: string };

  switch (message.type) {
    case "status":
      return { status: "ok", uptime: process.uptime() };
    case "ping":
      return { pong: true };
    default:
      return { error: "Unknown command" };
  }
});

// Start listening
await server.listen();

// Stop and cleanup
await server.close();
```

### IPC Client

```typescript
import { createIpcClient, type IpcClient } from "@outfitter/daemon";

const client: IpcClient = createIpcClient("/var/run/my-daemon.sock");

// Connect to the server
await client.connect();

// Send messages and receive responses
interface StatusResponse {
  status: string;
  uptime: number;
}

const response = await client.send<StatusResponse>({ type: "status" });
console.log("Daemon uptime:", response.uptime);

// Close connection
client.close();
```

### IPC Interfaces

```typescript
interface IpcServer {
  listen(): Promise<void>;
  close(): Promise<void>;
  onMessage(handler: IpcMessageHandler): void;
}

interface IpcClient {
  connect(): Promise<void>;
  send<T>(message: unknown): Promise<T>;
  close(): void;
}

type IpcMessageHandler = (message: unknown) => Promise<unknown>;
```

## Health Checks

Parallel health check execution with aggregated status reporting.

### Creating a Health Checker

```typescript
import {
  createHealthChecker,
  type HealthCheck,
  type HealthChecker,
} from "@outfitter/daemon";
import { Result } from "@outfitter/contracts";

// Define health checks
const checks: HealthCheck[] = [
  {
    name: "database",
    check: async () => {
      try {
        await db.ping();
        return Result.ok(undefined);
      } catch (error) {
        return Result.err(error as Error);
      }
    },
  },
  {
    name: "cache",
    check: async () => {
      try {
        await redis.ping();
        return Result.ok(undefined);
      } catch (error) {
        return Result.err(error as Error);
      }
    },
  },
];

// Create health checker
const checker: HealthChecker = createHealthChecker(checks);

// Register additional checks at runtime
checker.register({
  name: "queue",
  check: async () => {
    const connected = await queue.isConnected();
    return connected
      ? Result.ok(undefined)
      : Result.err(new Error("Queue disconnected"));
  },
});
```

### Running Health Checks

```typescript
const status = await checker.check();

console.log("Overall healthy:", status.healthy);  // true only if ALL checks pass
console.log("Uptime (seconds):", status.uptime);
console.log("Checks:", status.checks);
// {
//   database: { healthy: true },
//   cache: { healthy: false, message: "Connection refused" },
//   queue: { healthy: true }
// }

if (!status.healthy) {
  const failed = Object.entries(status.checks)
    .filter(([, result]) => !result.healthy)
    .map(([name, result]) => `${name}: ${result.message}`);

  console.error("Failed checks:", failed.join(", "));
}
```

### Health Check Types

```typescript
interface HealthCheck {
  name: string;
  check(): Promise<Result<void, Error>>;
}

interface HealthCheckResult {
  healthy: boolean;
  message?: string;  // Error message on failure
}

interface HealthStatus {
  healthy: boolean;                          // true only if ALL checks pass
  checks: Record<string, HealthCheckResult>; // Individual results
  uptime: number;                            // Seconds since checker created
}

interface HealthChecker {
  check(): Promise<HealthStatus>;
  register(check: HealthCheck): void;
}
```

## Error Types

### DaemonError

Main error type for daemon lifecycle operations.

```typescript
import { DaemonError, type DaemonErrorCode } from "@outfitter/daemon";

const error = new DaemonError({
  code: "ALREADY_RUNNING",
  message: "Daemon is already running with PID 1234",
});

// Error codes
type DaemonErrorCode =
  | "ALREADY_RUNNING"    // Daemon start requested but already running
  | "NOT_RUNNING"        // Daemon stop requested but not running
  | "SHUTDOWN_TIMEOUT"   // Graceful shutdown exceeded timeout
  | "PID_ERROR"          // PID file operations failed
  | "START_FAILED";      // Daemon failed to start
```

### Connection Errors

Discriminated union for IPC connection failures.

```typescript
import {
  StaleSocketError,
  ConnectionRefusedError,
  ConnectionTimeoutError,
  ProtocolError,
  LockError,
  type DaemonConnectionError,
} from "@outfitter/daemon";

// Handle connection errors with exhaustive matching
function handleError(error: DaemonConnectionError): string {
  switch (error._tag) {
    case "StaleSocketError":
      return `Stale socket at ${error.socketPath}, PID: ${error.pid}`;
    case "ConnectionRefusedError":
      return "Daemon not running";
    case "ConnectionTimeoutError":
      return `Timeout after ${error.timeoutMs}ms`;
    case "ProtocolError":
      return `Protocol error: ${error.details}`;
  }
}

// Lock errors
const lockError = new LockError({
  message: "Daemon already running",
  lockPath: "/run/user/1000/waymark/daemon.lock",
  pid: 12345,
});
```

## Platform Support

| Platform | Socket Type | Runtime Dir |
|----------|-------------|-------------|
| Linux | Unix domain socket | `$XDG_RUNTIME_DIR` or `/run/user/<uid>` |
| macOS | Unix domain socket | `$TMPDIR` |
| Windows | Named pipe | `%TEMP%` |

## Related Packages

- `@outfitter/contracts` - Result types and TaggedError base classes
- `@outfitter/logging` - Structured logging for daemon messages
- `@outfitter/config` - Configuration loading with schema validation

## License

MIT
