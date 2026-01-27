/**
 * Error types for daemon operations.
 *
 * Provides discriminated union error types for daemon connection and
 * locking failures, extending the TaggedError pattern from contracts.
 *
 * @packageDocumentation
 */

import type { TaggedErrorClass } from "@outfitter/contracts";
import { TaggedError } from "@outfitter/contracts";

// ============================================================================
// Connection Error Types
// ============================================================================

const StaleSocketErrorBase: TaggedErrorClass<
  "StaleSocketError",
  {
    message: string;
    socketPath: string;
    pid?: number;
  }
> = TaggedError("StaleSocketError")<{
  message: string;
  socketPath: string;
  pid?: number;
}>();

const ConnectionRefusedErrorBase: TaggedErrorClass<
  "ConnectionRefusedError",
  {
    message: string;
    socketPath: string;
  }
> = TaggedError("ConnectionRefusedError")<{
  message: string;
  socketPath: string;
}>();

const ConnectionTimeoutErrorBase: TaggedErrorClass<
  "ConnectionTimeoutError",
  {
    message: string;
    socketPath: string;
    timeoutMs: number;
  }
> = TaggedError("ConnectionTimeoutError")<{
  message: string;
  socketPath: string;
  timeoutMs: number;
}>();

const ProtocolErrorBase: TaggedErrorClass<
  "ProtocolError",
  {
    message: string;
    socketPath: string;
    details?: string;
  }
> = TaggedError("ProtocolError")<{
  message: string;
  socketPath: string;
  details?: string;
}>();

const LockErrorBase: TaggedErrorClass<
  "LockError",
  {
    message: string;
    lockPath: string;
    pid?: number;
  }
> = TaggedError("LockError")<{
  message: string;
  lockPath: string;
  pid?: number;
}>();

/**
 * Socket exists but daemon process is dead.
 *
 * Indicates a stale socket from a crashed daemon that needs cleanup
 * before a new daemon can start.
 *
 * @example
 * ```typescript
 * const error = new StaleSocketError({
 *   message: "Daemon socket is stale",
 *   socketPath: "/run/user/1000/waymark/daemon.sock",
 *   pid: 12345,
 * });
 * ```
 */
export class StaleSocketError extends StaleSocketErrorBase {}

/**
 * Daemon is not running (connection refused).
 *
 * Socket does not exist or connection was actively refused,
 * indicating no daemon is listening.
 *
 * @example
 * ```typescript
 * const error = new ConnectionRefusedError({
 *   message: "Connection refused",
 *   socketPath: "/run/user/1000/waymark/daemon.sock",
 * });
 * ```
 */
export class ConnectionRefusedError extends ConnectionRefusedErrorBase {}

/**
 * Daemon did not respond within timeout.
 *
 * Connection was established but daemon failed to respond
 * to ping or request within the configured timeout.
 *
 * @example
 * ```typescript
 * const error = new ConnectionTimeoutError({
 *   message: "Connection timed out after 5000ms",
 *   socketPath: "/run/user/1000/waymark/daemon.sock",
 *   timeoutMs: 5000,
 * });
 * ```
 */
export class ConnectionTimeoutError extends ConnectionTimeoutErrorBase {}

/**
 * Invalid response format from daemon.
 *
 * Daemon responded but the response could not be parsed
 * or did not match the expected protocol format.
 *
 * @example
 * ```typescript
 * const error = new ProtocolError({
 *   message: "Invalid JSON response",
 *   socketPath: "/run/user/1000/waymark/daemon.sock",
 *   details: "Unexpected token at position 42",
 * });
 * ```
 */
export class ProtocolError extends ProtocolErrorBase {}

// ============================================================================
// Lock Error Types
// ============================================================================

/**
 * Failed to acquire or release daemon lock.
 *
 * Used when PID file operations fail due to permissions,
 * concurrent access, or file system errors.
 *
 * @example
 * ```typescript
 * const error = new LockError({
 *   message: "Daemon already running",
 *   lockPath: "/run/user/1000/waymark/daemon.lock",
 *   pid: 12345,
 * });
 * ```
 */
export class LockError extends LockErrorBase {}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union of all daemon connection error types.
 *
 * Use for exhaustive matching on connection failures:
 *
 * @example
 * ```typescript
 * function handleError(error: DaemonConnectionError): string {
 *   switch (error._tag) {
 *     case "StaleSocketError":
 *       return `Stale socket at ${error.socketPath}`;
 *     case "ConnectionRefusedError":
 *       return "Daemon not running";
 *     case "ConnectionTimeoutError":
 *       return `Timeout after ${error.timeoutMs}ms`;
 *     case "ProtocolError":
 *       return `Protocol error: ${error.details}`;
 *   }
 * }
 * ```
 */
export type DaemonConnectionError =
  | StaleSocketError
  | ConnectionRefusedError
  | ConnectionTimeoutError
  | ProtocolError;
