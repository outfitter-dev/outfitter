/**
 * Type definitions for the daemon package.
 *
 * Provides interfaces for daemon lifecycle management, configuration,
 * and error handling.
 *
 * @packageDocumentation
 */

import type { Result } from "@outfitter/contracts";
import { TaggedError } from "@outfitter/contracts";
import type { LoggerInstance } from "@outfitter/logging";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for daemon operations.
 *
 * - `ALREADY_RUNNING`: Daemon start requested but already running
 * - `NOT_RUNNING`: Daemon stop requested but not running
 * - `SHUTDOWN_TIMEOUT`: Graceful shutdown exceeded timeout
 * - `PID_ERROR`: PID file operations failed
 * - `START_FAILED`: Daemon failed to start
 */
export type DaemonErrorCode =
	| "ALREADY_RUNNING"
	| "NOT_RUNNING"
	| "SHUTDOWN_TIMEOUT"
	| "PID_ERROR"
	| "START_FAILED";

/**
 * Error type for daemon operations.
 *
 * Uses the TaggedError pattern for type-safe error handling with Result types.
 *
 * @example
 * ```typescript
 * const error = new DaemonError({
 *   code: "ALREADY_RUNNING",
 *   message: "Daemon is already running with PID 1234",
 * });
 *
 * if (error.code === "ALREADY_RUNNING") {
 *   console.log("Stop the existing daemon first");
 * }
 * ```
 */
export class DaemonError extends TaggedError("DaemonError")<{
	code: DaemonErrorCode;
	message: string;
}>() {}

// ============================================================================
// State Types
// ============================================================================

/**
 * Daemon lifecycle states.
 *
 * State machine transitions:
 * - `stopped` -> `starting` (via start())
 * - `starting` -> `running` (when initialization complete)
 * - `starting` -> `stopped` (if start fails)
 * - `running` -> `stopping` (via stop() or signal)
 * - `stopping` -> `stopped` (when shutdown complete)
 */
export type DaemonState = "stopped" | "starting" | "running" | "stopping";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for creating a daemon.
 *
 * @example
 * ```typescript
 * const options: DaemonOptions = {
 *   name: "my-daemon",
 *   pidFile: "/var/run/my-daemon.pid",
 *   logger: myLogger,
 *   shutdownTimeout: 10000, // 10 seconds
 * };
 *
 * const daemon = createDaemon(options);
 * ```
 */
export interface DaemonOptions {
	/**
	 * Unique name identifying this daemon.
	 * Used in log messages and error context.
	 */
	name: string;

	/**
	 * Absolute path to the PID file.
	 * The daemon writes its process ID here on start and removes it on stop.
	 * Used to prevent multiple instances and for external process management.
	 */
	pidFile: string;

	/**
	 * Optional logger instance for daemon messages.
	 * If not provided, logging is disabled.
	 */
	logger?: LoggerInstance;

	/**
	 * Maximum time in milliseconds to wait for graceful shutdown.
	 * After this timeout, the daemon will force stop.
	 * @defaultValue 5000
	 */
	shutdownTimeout?: number;
}

// ============================================================================
// Daemon Interface
// ============================================================================

/**
 * Shutdown handler function type.
 *
 * Called during graceful shutdown to allow cleanup of resources.
 * Must complete within the shutdown timeout.
 */
export type ShutdownHandler = () => Promise<void>;

/**
 * Daemon instance interface.
 *
 * Provides lifecycle management for a background process including
 * start/stop operations, signal handling, and shutdown hooks.
 *
 * @example
 * ```typescript
 * const daemon = createDaemon({
 *   name: "my-service",
 *   pidFile: "/var/run/my-service.pid",
 * });
 *
 * // Register cleanup handlers
 * daemon.onShutdown(async () => {
 *   await database.close();
 * });
 *
 * // Start the daemon
 * const result = await daemon.start();
 * if (result.isErr()) {
 *   console.error("Failed to start:", result.error.message);
 *   process.exit(1);
 * }
 *
 * // Daemon is now running...
 * // Stop gracefully when needed
 * await daemon.stop();
 * ```
 */
export interface Daemon {
	/**
	 * Current lifecycle state of the daemon.
	 */
	readonly state: DaemonState;

	/**
	 * Start the daemon.
	 *
	 * Creates PID file and registers signal handlers.
	 * Transitions from `stopped` to `starting` then `running`.
	 *
	 * @returns Result with void on success, or DaemonError on failure
	 */
	start(): Promise<Result<void, DaemonError>>;

	/**
	 * Stop the daemon gracefully.
	 *
	 * Runs shutdown handlers, removes PID file, and cleans up signal handlers.
	 * Transitions from `running` to `stopping` then `stopped`.
	 *
	 * @returns Result with void on success, or DaemonError on failure
	 */
	stop(): Promise<Result<void, DaemonError>>;

	/**
	 * Check if the daemon is currently running.
	 *
	 * @returns true if state is "running", false otherwise
	 */
	isRunning(): boolean;

	/**
	 * Register a shutdown handler to be called during graceful shutdown.
	 *
	 * Multiple handlers can be registered and will be called in registration order.
	 * Handlers must complete within the shutdown timeout.
	 *
	 * @param handler - Async function to execute during shutdown
	 */
	onShutdown(handler: ShutdownHandler): void;
}
