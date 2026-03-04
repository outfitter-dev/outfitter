/**
 * Error taxonomy: categories, code maps, metadata, and lookup functions.
 *
 * @internal
 */

// ---------------------------------------------------------------------------
// Taxonomy: categories, code maps, and metadata
// ---------------------------------------------------------------------------

/**
 * Error categories for classification, exit codes, and HTTP status mapping.
 *
 * Used for:
 * - CLI exit code determination
 * - HTTP status code mapping
 * - Error grouping in logs and metrics
 * - Client retry decisions (transient vs permanent)
 */
export type ErrorCategory =
  | "validation"
  | "not_found"
  | "conflict"
  | "permission"
  | "timeout"
  | "rate_limit"
  | "network"
  | "internal"
  | "auth"
  | "cancelled";

/**
 * Maps error category to CLI exit code.
 * Non-zero exit indicates error; specific values for script automation.
 */
export const exitCodeMap: Record<ErrorCategory, number> = {
  validation: 1,
  not_found: 2,
  conflict: 3,
  permission: 4,
  timeout: 5,
  rate_limit: 6,
  network: 7,
  internal: 8,
  auth: 9,
  cancelled: 130, // POSIX convention: 128 + SIGINT(2)
};

/**
 * Maps error category to HTTP status code.
 * Used by MCP servers and API responses.
 */
export const statusCodeMap: Record<ErrorCategory, number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
  permission: 403,
  timeout: 504,
  rate_limit: 429,
  network: 502,
  internal: 500,
  auth: 401,
  cancelled: 499,
};

/**
 * Maps error category to JSON-RPC 2.0 error code (for MCP protocol compliance).
 *
 * Standard protocol codes (-32600 series) for direct mappings:
 * - validation -> -32602 (Invalid params)
 * - internal -> -32603 (Internal error)
 *
 * Implementation-defined server error codes (-32000 to -32099) for domain categories:
 * - auth -> -32000
 * - timeout -> -32001
 * - conflict -> -32002
 * - permission -> -32003
 * - rate_limit -> -32004
 * - network -> -32005
 * - cancelled -> -32006
 * - not_found -> -32007
 */
export const jsonRpcCodeMap: Record<ErrorCategory, number> = {
  validation: -32_602,
  not_found: -32_007,
  internal: -32_603,
  auth: -32_000,
  timeout: -32_001,
  conflict: -32_002,
  permission: -32_003,
  rate_limit: -32_004,
  network: -32_005,
  cancelled: -32_006,
};

/**
 * Maps error category to whether the error is safe to retry (for agent safety).
 *
 * Transient errors (timeout, rate_limit, network) are retryable — they may
 * succeed on a subsequent attempt. Permanent errors require human intervention
 * or input correction before retrying would help.
 */
export const retryableMap: Record<ErrorCategory, boolean> = {
  validation: false,
  not_found: false,
  conflict: false,
  permission: false,
  timeout: true,
  rate_limit: true,
  network: true,
  internal: false,
  auth: false,
  cancelled: false,
};

/**
 * Unified metadata for an error category.
 *
 * Combines exit code, HTTP status, JSON-RPC code, and retryable flag
 * into a single lookup for transport adapters and agent tooling.
 */
export interface ErrorCategoryMeta {
  exitCode: number;
  statusCode: number;
  jsonRpcCode: number;
  retryable: boolean;
}

/**
 * Get unified metadata for an error category.
 *
 * Returns exit code, HTTP status code, JSON-RPC error code, and retryable
 * flag in a single object. Useful for transport adapters that need all
 * metadata at once.
 *
 * @example
 * ```typescript
 * const meta = errorCategoryMeta("validation");
 * // { exitCode: 1, statusCode: 400, jsonRpcCode: -32602, retryable: false }
 *
 * const meta = errorCategoryMeta("timeout");
 * // { exitCode: 5, statusCode: 504, jsonRpcCode: -32001, retryable: true }
 * ```
 */
export function errorCategoryMeta(category: ErrorCategory): ErrorCategoryMeta {
  return {
    exitCode: exitCodeMap[category],
    statusCode: statusCodeMap[category],
    jsonRpcCode: jsonRpcCodeMap[category],
    retryable: retryableMap[category],
  };
}

/**
 * Numeric error codes for granular error identification.
 *
 * Ranges by category:
 * - validation: 1000-1999
 * - not_found: 2000-2999
 * - conflict: 3000-3999
 * - permission: 4000-4999
 * - timeout: 5000-5999
 * - rate_limit: 6000-6999
 * - network: 7000-7999
 * - internal: 8000-8999
 * - auth: 9000-9999
 * - cancelled: 10000-10999
 */
export const ERROR_CODES = {
  validation: {
    FIELD_REQUIRED: 1001,
    INVALID_FORMAT: 1002,
    OUT_OF_RANGE: 1003,
    TYPE_MISMATCH: 1004,
    AMBIGUOUS_MATCH: 1005,
  },
  not_found: {
    RESOURCE_NOT_FOUND: 2001,
    FILE_NOT_FOUND: 2002,
  },
  conflict: {
    ALREADY_EXISTS: 3001,
    VERSION_MISMATCH: 3002,
  },
  permission: {
    FORBIDDEN: 4001,
    INSUFFICIENT_RIGHTS: 4002,
  },
  timeout: {
    OPERATION_TIMEOUT: 5001,
    CONNECTION_TIMEOUT: 5002,
  },
  rate_limit: {
    QUOTA_EXCEEDED: 6001,
    THROTTLED: 6002,
  },
  network: {
    CONNECTION_REFUSED: 7001,
    DNS_FAILED: 7002,
  },
  internal: {
    UNEXPECTED_STATE: 8001,
    ASSERTION_FAILED: 8002,
  },
  auth: {
    INVALID_TOKEN: 9001,
    EXPIRED_TOKEN: 9002,
  },
  cancelled: {
    USER_CANCELLED: 10_001,
    SIGNAL_RECEIVED: 10_002,
  },
} as const;

/**
 * Union type of all numeric error codes.
 * Useful for type-safe error code handling.
 */
export type ErrorCode =
  (typeof ERROR_CODES)[keyof typeof ERROR_CODES][keyof (typeof ERROR_CODES)[keyof typeof ERROR_CODES]];

/**
 * Serialized error format for JSON transport.
 */
export interface SerializedError {
  _tag: string;
  category: ErrorCategory;
  context?: Record<string, unknown>;
  message: string;
}

/**
 * Base interface for OutfitterError properties.
 * All concrete error classes must include these fields.
 *
 * @deprecated Use `OutfitterError` (or concrete error class constructor props) instead. This alias will be removed in v1.0.
 */
export interface KitErrorProps {
  category: ErrorCategory;
  context?: Record<string, unknown>;
  message: string;
}

/**
 * Get CLI exit code for an error category.
 */
export function getExitCode(category: ErrorCategory): number {
  return exitCodeMap[category];
}

/**
 * Get HTTP status code for an error category.
 */
export function getStatusCode(category: ErrorCategory): number {
  return statusCodeMap[category];
}
