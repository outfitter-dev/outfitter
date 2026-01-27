/**
 * Error recovery heuristics
 *
 * Provides utilities for determining if errors are recoverable,
 * retryable, and calculating retry delays with configurable backoff.
 *
 * @module recovery
 */

import type { ErrorCategory } from "./errors.js";

/**
 * Backoff strategy configuration options
 */
export interface BackoffOptions {
  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff strategy (default: "exponential") */
  strategy?: "linear" | "exponential" | "constant";
  /** Whether to add jitter to prevent thundering herd (default: true) */
  useJitter?: boolean;
}

/**
 * Categories that are potentially recoverable.
 *
 * These represent transient failures that might succeed on retry
 * or with user intervention (like waiting for rate limit reset).
 */
const RECOVERABLE_CATEGORIES: readonly ErrorCategory[] = [
  "network",
  "timeout",
  "rate_limit",
  "conflict",
];

/**
 * Categories that are good candidates for automatic retry.
 *
 * More restrictive than RECOVERABLE_CATEGORIES. Excludes:
 * - rate_limit: Should wait for retryAfterSeconds, not auto-retry
 * - conflict: May need user intervention to resolve
 */
const RETRYABLE_CATEGORIES: readonly ErrorCategory[] = ["network", "timeout"];

/**
 * Determines if an error is potentially recoverable.
 *
 * Recoverable errors might succeed on retry or with user intervention.
 * This includes transient failures (network, timeout), rate limiting,
 * and optimistic lock conflicts.
 *
 * @param error - Error object with category property
 * @returns True if the error might be recoverable
 *
 * @example
 * ```typescript
 * import { isRecoverable, NetworkError } from '@outfitter/contracts';
 *
 * const networkError = new NetworkError({ message: "Connection refused" });
 * console.log(isRecoverable(networkError)); // true
 *
 * const validationError = new ValidationError({ message: "Invalid input" });
 * console.log(isRecoverable(validationError)); // false
 * ```
 */
export const isRecoverable = (error: {
  readonly category: ErrorCategory;
}): boolean => {
  return RECOVERABLE_CATEGORIES.includes(error.category);
};

/**
 * Determines if an error should trigger automatic retry.
 *
 * More restrictive than isRecoverable - only transient failures that
 * are good candidates for immediate retry without user intervention.
 *
 * Retryable categories:
 * - network: Connection issues may be temporary
 * - timeout: May succeed with another attempt
 *
 * NOT retryable (even though recoverable):
 * - rate_limit: Should respect retryAfterSeconds header
 * - conflict: May need user to resolve the conflict
 *
 * @param error - Error object with category property
 * @returns True if the operation should be automatically retried
 *
 * @example
 * ```typescript
 * import { isRetryable, TimeoutError } from '@outfitter/contracts';
 *
 * const timeout = new TimeoutError({
 *   message: "Operation timed out",
 *   operation: "fetch",
 *   timeoutMs: 5000,
 * });
 * console.log(isRetryable(timeout)); // true
 *
 * const rateLimitError = new RateLimitError({ message: "Rate limit exceeded" });
 * console.log(isRetryable(rateLimitError)); // false (use retryAfterSeconds)
 * ```
 */
export const isRetryable = (error: {
  readonly category: ErrorCategory;
}): boolean => {
  return RETRYABLE_CATEGORIES.includes(error.category);
};

/**
 * Calculate appropriate backoff delay for retry.
 *
 * Supports three strategies:
 * - exponential (default): delay = baseDelayMs * 2^attempt
 * - linear: delay = baseDelayMs * (attempt + 1)
 * - constant: delay = baseDelayMs
 *
 * By default, adds jitter (+/-10%) to prevent thundering herd problems
 * when multiple clients retry simultaneously.
 *
 * @param attempt - The attempt number (0-indexed)
 * @param options - Backoff configuration options
 * @returns Delay in milliseconds before next retry
 *
 * @example
 * ```typescript
 * import { getBackoffDelay } from '@outfitter/contracts';
 *
 * // Exponential backoff (default): 100ms, 200ms, 400ms, 800ms...
 * const delay = getBackoffDelay(2); // ~400ms (with jitter)
 *
 * // Linear backoff: 100ms, 200ms, 300ms...
 * const linearDelay = getBackoffDelay(2, { strategy: "linear" }); // ~300ms
 *
 * // Constant delay: 500ms, 500ms, 500ms...
 * const constantDelay = getBackoffDelay(2, {
 *   strategy: "constant",
 *   baseDelayMs: 500,
 * }); // ~500ms
 *
 * // No jitter for deterministic timing
 * const exactDelay = getBackoffDelay(2, { useJitter: false }); // exactly 400ms
 * ```
 */
export const getBackoffDelay = (
  attempt: number,
  options: BackoffOptions = {}
): number => {
  const {
    baseDelayMs = 100,
    maxDelayMs = 30_000,
    strategy = "exponential",
    useJitter = true,
  } = options;

  let delay: number;
  switch (strategy) {
    case "constant": {
      delay = baseDelayMs;
      break;
    }
    case "linear": {
      delay = baseDelayMs * (attempt + 1);
      break;
    }
    default: {
      // "exponential" and any unhandled cases
      delay = baseDelayMs * 2 ** attempt;
    }
  }

  // Cap at maxDelayMs before jitter calculation
  delay = Math.min(delay, maxDelayMs);

  // Add jitter (+/-10%) to prevent thundering herd
  if (useJitter) {
    const jitterFactor = 0.1;
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    delay = Math.round(delay + jitter);
  }

  // Re-cap after jitter to ensure we never exceed maxDelayMs
  return Math.min(delay, maxDelayMs);
};

/**
 * Convenience function combining retryability check with attempt limit.
 *
 * Returns true only if:
 * 1. The error is retryable (network or timeout)
 * 2. We haven't exceeded maxAttempts
 *
 * @param error - Error object with category property
 * @param attempt - Current attempt number (0-indexed)
 * @param maxAttempts - Maximum number of retry attempts (default: 3)
 * @returns True if the operation should be retried
 *
 * @example
 * ```typescript
 * import { shouldRetry, NetworkError } from '@outfitter/contracts';
 *
 * const error = new NetworkError({ message: "Connection timeout" });
 *
 * // First attempt failed
 * console.log(shouldRetry(error, 0)); // true (will retry)
 *
 * // Fourth attempt failed (exceeded default max of 3)
 * console.log(shouldRetry(error, 3)); // false (no more retries)
 *
 * // Custom max attempts
 * console.log(shouldRetry(error, 4, 5)); // true (under custom limit)
 * ```
 */
export const shouldRetry = (
  error: { readonly category: ErrorCategory },
  attempt: number,
  maxAttempts = 3
): boolean => {
  if (attempt >= maxAttempts) {
    return false;
  }
  return isRetryable(error);
};
