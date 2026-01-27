/**
 * Daemon lifecycle management.
 *
 * Provides functions for creating and managing daemon processes including
 * PID file management, signal handling, and graceful shutdown.
 *
 * @packageDocumentation
 */

import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Result } from "@outfitter/contracts";
import type {
  Daemon,
  DaemonOptions,
  DaemonState,
  ShutdownHandler,
} from "./types.js";
import { DaemonError } from "./types.js";

// ============================================================================
// Internal Types
// ============================================================================

interface DaemonInternalOptions {
  name: string;
  pidFile: string;
  logger: DaemonOptions["logger"];
  shutdownTimeout: number;
}

interface DaemonInternalState {
  state: DaemonState;
  options: DaemonInternalOptions;
  shutdownHandlers: ShutdownHandler[];
  signalHandlers: {
    sigterm?: () => void;
    sigint?: () => void;
  };
  isShuttingDown: boolean;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Check if a PID file already exists.
 */
function pidFileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

/**
 * Write PID to file, creating parent directories if needed.
 */
async function writePidFile(
  path: string,
  pid: number
): Promise<Result<void, DaemonError>> {
  try {
    // Create parent directories
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });

    // Write PID file
    await writeFile(path, String(pid), { flag: "wx" });
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(
      new DaemonError({
        code: "PID_ERROR",
        message: `Failed to write PID file: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    );
  }
}

/**
 * Remove PID file.
 */
async function removePidFile(path: string): Promise<Result<void, DaemonError>> {
  try {
    await unlink(path);
    return Result.ok(undefined);
  } catch (error) {
    // Ignore if file doesn't exist
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return Result.ok(undefined);
    }
    return Result.err(
      new DaemonError({
        code: "PID_ERROR",
        message: `Failed to remove PID file: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    );
  }
}

/**
 * Run shutdown handlers with timeout.
 */
async function runShutdownHandlers(
  handlers: ShutdownHandler[],
  timeout: number,
  logger?: DaemonOptions["logger"]
): Promise<{ completed: boolean; errors: Error[] }> {
  const errors: Error[] = [];

  const runHandlers = async () => {
    for (const handler of handlers) {
      try {
        await handler();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        logger?.warn("Shutdown handler failed", { error: err.message });
      }
    }
  };

  const timeoutPromise = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), timeout);
  });

  const result = await Promise.race([
    runHandlers().then(() => "completed" as const),
    timeoutPromise,
  ]);

  return {
    completed: result === "completed",
    errors,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a new daemon instance.
 *
 * The daemon manages its own lifecycle including PID file creation/removal,
 * signal handling for graceful shutdown, and execution of registered
 * shutdown handlers.
 *
 * @param options - Daemon configuration options
 * @returns Daemon instance
 *
 * @example
 * ```typescript
 * const daemon = createDaemon({
 *   name: "my-service",
 *   pidFile: "/var/run/my-service.pid",
 *   shutdownTimeout: 10000,
 * });
 *
 * daemon.onShutdown(async () => {
 *   await database.close();
 * });
 *
 * const result = await daemon.start();
 * if (result.isErr()) {
 *   console.error("Failed to start:", result.error.message);
 *   process.exit(1);
 * }
 * ```
 */
export function createDaemon(options: DaemonOptions): Daemon {
  const internalState: DaemonInternalState = {
    state: "stopped",
    options: {
      name: options.name,
      pidFile: options.pidFile,
      logger: options.logger,
      shutdownTimeout: options.shutdownTimeout ?? 5000,
    },
    shutdownHandlers: [],
    signalHandlers: {},
    isShuttingDown: false,
  };

  /**
   * Internal stop implementation used by both explicit stop and signal handlers.
   */
  async function doStop(): Promise<Result<void, DaemonError>> {
    const { logger } = internalState.options;

    // Prevent re-entry during shutdown
    if (internalState.isShuttingDown) {
      return Result.ok(undefined);
    }

    if (internalState.state === "stopped") {
      return Result.err(
        new DaemonError({
          code: "NOT_RUNNING",
          message: `Daemon "${internalState.options.name}" is not running`,
        })
      );
    }

    internalState.isShuttingDown = true;
    internalState.state = "stopping";
    logger?.info("Daemon stopping", { name: internalState.options.name });

    // Run shutdown handlers
    const { completed } = await runShutdownHandlers(
      internalState.shutdownHandlers,
      internalState.options.shutdownTimeout,
      logger
    );

    if (!completed) {
      logger?.warn("Shutdown handlers timed out", {
        name: internalState.options.name,
        timeout: internalState.options.shutdownTimeout,
      });
    }

    // Remove signal handlers
    if (internalState.signalHandlers.sigterm) {
      process.off("SIGTERM", internalState.signalHandlers.sigterm);
    }
    if (internalState.signalHandlers.sigint) {
      process.off("SIGINT", internalState.signalHandlers.sigint);
    }

    // Remove PID file
    const removeResult = await removePidFile(internalState.options.pidFile);
    if (removeResult.isErr()) {
      logger?.error("Failed to remove PID file", {
        error: removeResult.error.message,
      });
    }

    internalState.state = "stopped";
    internalState.isShuttingDown = false;
    logger?.info("Daemon stopped", { name: internalState.options.name });

    // Return timeout error if handlers didn't complete
    if (!completed) {
      return Result.err(
        new DaemonError({
          code: "SHUTDOWN_TIMEOUT",
          message: `Shutdown handlers exceeded timeout of ${internalState.options.shutdownTimeout}ms`,
        })
      );
    }

    return Result.ok(undefined);
  }

  const daemon: Daemon = {
    get state(): DaemonState {
      return internalState.state;
    },

    async start(): Promise<Result<void, DaemonError>> {
      const { logger } = internalState.options;

      // Check if already running
      if (internalState.state !== "stopped") {
        return Result.err(
          new DaemonError({
            code: "ALREADY_RUNNING",
            message: `Daemon "${internalState.options.name}" is already running`,
          })
        );
      }

      internalState.state = "starting";
      logger?.info("Daemon starting", { name: internalState.options.name });

      // Check if PID file already exists (another instance might be running)
      if (await pidFileExists(internalState.options.pidFile)) {
        internalState.state = "stopped";
        return Result.err(
          new DaemonError({
            code: "ALREADY_RUNNING",
            message: `PID file already exists: ${internalState.options.pidFile}`,
          })
        );
      }

      // Write PID file
      const writeResult = await writePidFile(
        internalState.options.pidFile,
        process.pid
      );
      if (writeResult.isErr()) {
        internalState.state = "stopped";
        return writeResult;
      }

      // Register signal handlers
      const sigTermHandler = () => {
        logger?.info("Received SIGTERM signal");
        void doStop();
      };
      const sigIntHandler = () => {
        logger?.info("Received SIGINT signal");
        void doStop();
      };

      internalState.signalHandlers.sigterm = sigTermHandler;
      internalState.signalHandlers.sigint = sigIntHandler;

      process.on("SIGTERM", sigTermHandler);
      process.on("SIGINT", sigIntHandler);

      internalState.state = "running";
      logger?.info("Daemon started", {
        name: internalState.options.name,
        pid: process.pid,
      });

      return Result.ok(undefined);
    },

    stop(): Promise<Result<void, DaemonError>> {
      return doStop();
    },

    isRunning(): boolean {
      return internalState.state === "running";
    },

    onShutdown(handler: ShutdownHandler): void {
      internalState.shutdownHandlers.push(handler);
    },
  };

  return daemon;
}
