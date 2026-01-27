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
  // Daemon interface
  type Daemon,
  DaemonError,
  // Error types
  type DaemonErrorCode,
  // Configuration types
  type DaemonOptions,
  // State types
  type DaemonState,
  type ShutdownHandler,
} from "./types.js";

// ============================================================================
// Connection Errors
// ============================================================================

export {
  ConnectionRefusedError,
  ConnectionTimeoutError,
  // Union types
  type DaemonConnectionError,
  LockError,
  ProtocolError,
  // Error classes
  StaleSocketError,
} from "./errors.js";

// ============================================================================
// Platform
// ============================================================================

export {
  getDaemonDir,
  getLockPath,
  getPidPath,
  // Path resolution
  getSocketPath,
  // Platform detection
  isUnixPlatform,
} from "./platform.js";

// ============================================================================
// Locking
// ============================================================================

export {
  // Lock operations
  acquireDaemonLock,
  isDaemonAlive,
  // Liveness checks
  isProcessAlive,
  // Types
  type LockHandle,
  readLockPid,
  releaseDaemonLock,
} from "./locking.js";

// ============================================================================
// Lifecycle
// ============================================================================

export { createDaemon } from "./lifecycle.js";

// ============================================================================
// IPC
// ============================================================================

export {
  createIpcClient,
  // Factory functions
  createIpcServer,
  type IpcClient,
  // Types
  type IpcMessageHandler,
  type IpcServer,
} from "./ipc.js";

// ============================================================================
// Health Checks
// ============================================================================

export {
  // Factory function
  createHealthChecker,
  // Types
  type HealthCheck,
  type HealthChecker,
  type HealthCheckResult,
  type HealthStatus,
} from "./health.js";
