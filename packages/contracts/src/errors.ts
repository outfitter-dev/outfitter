import type { TaggedErrorClass } from "better-result";
import { TaggedError } from "better-result";

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
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Base interface for OutfitterError properties.
 * All concrete error classes must include these fields.
 */
export interface KitErrorProps {
  message: string;
  category: ErrorCategory;
  context?: Record<string, unknown>;
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

// ============================================================================
// Concrete Error Classes
// ============================================================================

// Base classes avoid TS9021 warnings from extending expressions.
const ValidationErrorBase: TaggedErrorClass<
  "ValidationError",
  {
    message: string;
    field?: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("ValidationError")<{
  message: string;
  field?: string;
  context?: Record<string, unknown>;
}>();

const AssertionErrorBase: TaggedErrorClass<
  "AssertionError",
  {
    message: string;
  }
> = TaggedError("AssertionError")<{
  message: string;
}>();

const NotFoundErrorBase: TaggedErrorClass<
  "NotFoundError",
  {
    message: string;
    resourceType: string;
    resourceId: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("NotFoundError")<{
  message: string;
  resourceType: string;
  resourceId: string;
  context?: Record<string, unknown>;
}>();

const ConflictErrorBase: TaggedErrorClass<
  "ConflictError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("ConflictError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

const PermissionErrorBase: TaggedErrorClass<
  "PermissionError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("PermissionError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

const TimeoutErrorBase: TaggedErrorClass<
  "TimeoutError",
  {
    message: string;
    operation: string;
    timeoutMs: number;
  }
> = TaggedError("TimeoutError")<{
  message: string;
  operation: string;
  timeoutMs: number;
}>();

const RateLimitErrorBase: TaggedErrorClass<
  "RateLimitError",
  {
    message: string;
    retryAfterSeconds?: number;
  }
> = TaggedError("RateLimitError")<{
  message: string;
  retryAfterSeconds?: number;
}>();

const NetworkErrorBase: TaggedErrorClass<
  "NetworkError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("NetworkError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

const InternalErrorBase: TaggedErrorClass<
  "InternalError",
  {
    message: string;
    context?: Record<string, unknown>;
  }
> = TaggedError("InternalError")<{
  message: string;
  context?: Record<string, unknown>;
}>();

const AuthErrorBase: TaggedErrorClass<
  "AuthError",
  {
    message: string;
    reason?: "missing" | "invalid" | "expired";
  }
> = TaggedError("AuthError")<{
  message: string;
  reason?: "missing" | "invalid" | "expired";
}>();

const CancelledErrorBase: TaggedErrorClass<
  "CancelledError",
  {
    message: string;
  }
> = TaggedError("CancelledError")<{
  message: string;
}>();

/**
 * Input validation failed.
 *
 * @example
 * ```typescript
 * new ValidationError({ message: "Email format invalid", field: "email" });
 * new ValidationError({
 *   message: "Value out of range",
 *   field: "age",
 *   context: { min: 0, max: 150, received: -1 },
 * });
 * ```
 */
export class ValidationError extends ValidationErrorBase {
  readonly category = "validation" as const;

  /** Create a ValidationError with auto-generated message from field name. */
  static create(
    field: string,
    reason: string,
    context?: Record<string, unknown>
  ): ValidationError {
    return new ValidationError({
      message: `${field}: ${reason}`,
      field,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Assertion failed (invariant violation).
 *
 * Used by assertion utilities that return Result types instead of throwing.
 * AssertionError indicates a programming bug — an invariant that should
 * never be violated was broken. These are internal errors, not user input
 * validation failures.
 *
 * **Category rationale**: Uses `internal` (not `validation`) because:
 * - Assertions check **invariants** (programmer assumptions), not user input
 * - A failed assertion means "this should be impossible if the code is correct"
 * - User-facing validation uses {@link ValidationError} with helpful field info
 * - HTTP 500 is correct: this is a server bug, not a client mistake
 *
 * @example
 * ```typescript
 * // In domain logic after validation has passed
 * const result = assertDefined(cachedValue, "Cache should always have value after init");
 * if (result.isErr()) {
 *   return result; // Propagate as internal error
 * }
 * ```
 *
 * @see ValidationError - For user input validation failures (HTTP 400)
 */
export class AssertionError extends AssertionErrorBase {
  readonly category = "internal" as const;

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Requested resource not found.
 *
 * @example
 * ```typescript
 * new NotFoundError({ message: "note not found: abc123", resourceType: "note", resourceId: "abc123" });
 * new NotFoundError({
 *   message: "Heading not found",
 *   resourceType: "heading",
 *   resourceId: "h:Intro",
 *   context: { availableHeadings: ["Introduction", "Getting Started"] },
 * });
 * ```
 */
export class NotFoundError extends NotFoundErrorBase {
  readonly category = "not_found" as const;

  /** Create a NotFoundError with auto-generated message. */
  static create(
    resourceType: string,
    resourceId: string,
    context?: Record<string, unknown>
  ): NotFoundError {
    return new NotFoundError({
      message: `${resourceType} not found: ${resourceId}`,
      resourceType,
      resourceId,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * State conflict (optimistic locking, concurrent modification).
 *
 * @example
 * ```typescript
 * new ConflictError({ message: "Resource was modified by another process" });
 * ```
 */
export class ConflictError extends ConflictErrorBase {
  readonly category = "conflict" as const;

  /** Create a ConflictError with optional context. */
  static create(
    message: string,
    context?: Record<string, unknown>
  ): ConflictError {
    return new ConflictError({ message, ...(context != null && { context }) });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Authorization denied.
 *
 * @example
 * ```typescript
 * new PermissionError({ message: "Cannot delete read-only resource" });
 * ```
 */
export class PermissionError extends PermissionErrorBase {
  readonly category = "permission" as const;

  /** Create a PermissionError with optional context. */
  static create(
    message: string,
    context?: Record<string, unknown>
  ): PermissionError {
    return new PermissionError({
      message,
      ...(context != null && { context }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Operation timed out.
 *
 * @example
 * ```typescript
 * new TimeoutError({ message: "Database query timed out after 5000ms", operation: "Database query", timeoutMs: 5000 });
 * ```
 */
export class TimeoutError extends TimeoutErrorBase {
  readonly category = "timeout" as const;

  /** Create a TimeoutError with auto-generated message. */
  static create(operation: string, timeoutMs: number): TimeoutError {
    return new TimeoutError({
      message: `${operation} timed out after ${timeoutMs}ms`,
      operation,
      timeoutMs,
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Rate limit exceeded.
 *
 * @example
 * ```typescript
 * new RateLimitError({ message: "Rate limit exceeded, retry after 60s", retryAfterSeconds: 60 });
 * ```
 */
export class RateLimitError extends RateLimitErrorBase {
  readonly category = "rate_limit" as const;

  /** Create a RateLimitError with optional retry hint. */
  static create(message: string, retryAfterSeconds?: number): RateLimitError {
    return new RateLimitError({
      message,
      ...(retryAfterSeconds != null && { retryAfterSeconds }),
    });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Network/transport failure.
 *
 * @example
 * ```typescript
 * new NetworkError({ message: "Connection refused to api.example.com" });
 * ```
 */
export class NetworkError extends NetworkErrorBase {
  readonly category = "network" as const;

  /** Create a NetworkError with optional context. */
  static create(
    message: string,
    context?: Record<string, unknown>
  ): NetworkError {
    return new NetworkError({ message, ...(context != null && { context }) });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Unexpected internal error.
 *
 * @example
 * ```typescript
 * new InternalError({ message: "Unexpected state in processor" });
 * ```
 */
export class InternalError extends InternalErrorBase {
  readonly category = "internal" as const;

  /** Create an InternalError with optional context. */
  static create(
    message: string,
    context?: Record<string, unknown>
  ): InternalError {
    return new InternalError({ message, ...(context != null && { context }) });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Authentication failed (missing or invalid credentials).
 *
 * @example
 * ```typescript
 * new AuthError({ message: "Invalid API key", reason: "invalid" });
 * ```
 */
export class AuthError extends AuthErrorBase {
  readonly category = "auth" as const;

  /** Create an AuthError with optional reason. */
  static create(
    message: string,
    reason?: "missing" | "invalid" | "expired"
  ): AuthError {
    return new AuthError({ message, ...(reason != null && { reason }) });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Operation cancelled by user or signal.
 *
 * @example
 * ```typescript
 * new CancelledError({ message: "Operation cancelled by user" });
 * ```
 */
export class CancelledError extends CancelledErrorBase {
  readonly category = "cancelled" as const;

  /** Create a CancelledError. */
  static create(message: string): CancelledError {
    return new CancelledError({ message });
  }

  exitCode(): number {
    return getExitCode(this.category);
  }

  statusCode(): number {
    return getStatusCode(this.category);
  }
}

/**
 * Union type of all concrete error class instances.
 */
export type AnyKitError =
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof AssertionError>
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ConflictError>
  | InstanceType<typeof PermissionError>
  | InstanceType<typeof TimeoutError>
  | InstanceType<typeof RateLimitError>
  | InstanceType<typeof NetworkError>
  | InstanceType<typeof InternalError>
  | InstanceType<typeof AuthError>
  | InstanceType<typeof CancelledError>;

/**
 * Type alias for backwards compatibility with handler signatures.
 * Use AnyKitError for the union type.
 */
export type OutfitterError = AnyKitError;
