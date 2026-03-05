/**
 * Operational error classes.
 *
 * Includes errors for permissions, timeouts, rate limits, network failures,
 * internal errors, authentication failures, and cancellations.
 *
 * @internal
 */

import {
  AuthErrorBase,
  CancelledErrorBase,
  InternalErrorBase,
  NetworkErrorBase,
  PermissionErrorBase,
  RateLimitErrorBase,
  TimeoutErrorBase,
} from "./error-base.js";
import { getExitCode, getStatusCode } from "./error-taxonomy.js";

// ---------------------------------------------------------------------------
// Concrete error classes — operational errors
// ---------------------------------------------------------------------------

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
