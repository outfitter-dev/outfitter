/**
 * @outfitter/daemon
 *
 * Daemon lifecycle management, IPC communication, and health checks
 * for background processes. Provides utilities for building robust
 * daemon services with graceful shutdown and monitoring.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export {
	// Error types
	type DaemonErrorCode,
	DaemonError,
	// State types
	type DaemonState,
	// Configuration types
	type DaemonOptions,
	type ShutdownHandler,
	// Daemon interface
	type Daemon,
} from "./types.js";

// ============================================================================
// Connection Errors
// ============================================================================

export {
	// Error classes
	StaleSocketError,
	ConnectionRefusedError,
	ConnectionTimeoutError,
	ProtocolError,
	LockError,
	// Union types
	type DaemonConnectionError,
} from "./errors.js";

// ============================================================================
// Platform
// ============================================================================

export {
	// Platform detection
	isUnixPlatform,
	// Path resolution
	getSocketPath,
	getLockPath,
	getPidPath,
	getDaemonDir,
} from "./platform.js";

// ============================================================================
// Locking
// ============================================================================

export {
	// Types
	type LockHandle,
	// Lock operations
	acquireDaemonLock,
	releaseDaemonLock,
	// Liveness checks
	isProcessAlive,
	isDaemonAlive,
	readLockPid,
} from "./locking.js";

// ============================================================================
// Lifecycle
// ============================================================================

export { createDaemon } from "./lifecycle.js";

// ============================================================================
// IPC
// ============================================================================

export {
	// Types
	type IpcMessageHandler,
	type IpcServer,
	type IpcClient,
	// Factory functions
	createIpcServer,
	createIpcClient,
} from "./ipc.js";

// ============================================================================
// Health Checks
// ============================================================================

export {
	// Types
	type HealthCheck,
	type HealthCheckResult,
	type HealthStatus,
	type HealthChecker,
	// Factory function
	createHealthChecker,
} from "./health.js";
