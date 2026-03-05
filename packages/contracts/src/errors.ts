/**
 * Error taxonomy and concrete error classes.
 *
 * Defines the error classification system used throughout Outfitter for:
 * - CLI exit code determination
 * - HTTP status code mapping
 * - JSON-RPC error code mapping (MCP protocol)
 * - Agent retry decisions (transient vs permanent)
 * - Granular error code identification
 *
 * @module errors
 */

// Re-export types (erased at runtime — no bundle impact)
export type {
  ErrorCategory,
  ErrorCategoryMeta,
  ErrorCode,
  KitErrorProps,
  SerializedError,
} from "./internal/error-taxonomy.js";

// Re-export runtime taxonomy values
export {
  ERROR_CODES,
  errorCategoryMeta,
  exitCodeMap,
  getExitCode,
  getStatusCode,
  jsonRpcCodeMap,
  retryableMap,
  statusCodeMap,
} from "./internal/error-taxonomy.js";

// Re-export validation/resource error classes
export {
  AlreadyExistsError,
  AmbiguousError,
  AssertionError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "./internal/error-validation.js";

// Re-export operational error classes
export {
  AuthError,
  CancelledError,
  InternalError,
  NetworkError,
  PermissionError,
  RateLimitError,
  TimeoutError,
} from "./internal/error-operational.js";

// ---------------------------------------------------------------------------
// Union types
// ---------------------------------------------------------------------------

import type {
  AuthError,
  CancelledError,
  InternalError,
  NetworkError,
  PermissionError,
  RateLimitError,
  TimeoutError,
} from "./internal/error-operational.js";
import type {
  AlreadyExistsError,
  AmbiguousError,
  AssertionError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "./internal/error-validation.js";

/**
 * Canonical union type of all concrete error class instances.
 */
export type OutfitterError =
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof AmbiguousError>
  | InstanceType<typeof AssertionError>
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof AlreadyExistsError>
  | InstanceType<typeof ConflictError>
  | InstanceType<typeof PermissionError>
  | InstanceType<typeof TimeoutError>
  | InstanceType<typeof RateLimitError>
  | InstanceType<typeof NetworkError>
  | InstanceType<typeof InternalError>
  | InstanceType<typeof AuthError>
  | InstanceType<typeof CancelledError>;

/**
 * @deprecated Use `OutfitterError` instead. This alias will be removed in v1.0.
 */
export type AnyKitError = OutfitterError;
