import { Result } from "better-result";
import { type OutfitterError, TimeoutError } from "./errors.js";

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;

  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;

  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;

  /** Predicate to determine if error is retryable */
  isRetryable?: (error: OutfitterError) => boolean;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Callback invoked before each retry */
  onRetry?: (attempt: number, error: OutfitterError, delayMs: number) => void;
}

/**
 * Options for timeout behavior.
 */
export interface TimeoutOptions {
  /** Timeout duration in milliseconds */
  timeoutMs: number;

  /** Operation name for error context */
  operation?: string;
}

/**
 * Default retry predicate - retries transient errors.
 */
function defaultIsRetryable(error: OutfitterError): boolean {
  return (
    error.category === "network" ||
    error.category === "timeout" ||
    error.category === "rate_limit"
  );
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Calculate base delay: initialDelayMs * multiplier^(attempt-1)
  const baseDelay = initialDelayMs * backoffMultiplier ** (attempt - 1);

  // Cap at maxDelayMs
  const cappedDelay = Math.min(baseDelay, maxDelayMs);

  // Apply jitter if enabled (random value between 0.5x and 1.5x)
  if (jitter) {
    const jitterFactor = 0.5 + Math.random();
    return Math.floor(cappedDelay * jitterFactor);
  }

  return cappedDelay;
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff.
 *
 * Automatically retries transient errors (network, timeout, rate_limit)
 * unless overridden with `isRetryable`.
 *
 * @typeParam T - Success type
 * @param fn - Async function returning Result
 * @param options - Retry configuration
 * @returns Result from final attempt
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchData(url),
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 500,
 *     onRetry: (attempt, error) => {
 *       logger.warn(`Retry ${attempt}`, { error: error._tag });
 *     },
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<Result<T, OutfitterError>>,
  options?: RetryOptions
): Promise<Result<T, OutfitterError>> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 30_000;
  const backoffMultiplier = options?.backoffMultiplier ?? 2;
  const jitter = options?.jitter ?? true;
  const isRetryable = options?.isRetryable ?? defaultIsRetryable;
  const onRetry = options?.onRetry;
  const signal = options?.signal;

  let lastError: OutfitterError | undefined;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    // Check for cancellation
    if (signal?.aborted) {
      return Result.err(
        lastError ??
          new TimeoutError({
            message: "Operation cancelled",
            operation: "retry",
            timeoutMs: 0,
          })
      );
    }

    const result = await fn();

    if (result.isOk()) {
      return result;
    }

    lastError = result.error;

    // Check if we should retry
    if (attempt >= maxAttempts || !isRetryable(lastError)) {
      return result;
    }

    // Calculate delay for next attempt
    const delayMs = calculateDelay(
      attempt,
      initialDelayMs,
      maxDelayMs,
      backoffMultiplier,
      jitter
    );

    // Invoke onRetry callback
    if (onRetry) {
      onRetry(attempt, lastError, delayMs);
    }

    // Wait before retrying
    await sleep(delayMs);
  }

  // Should not reach here since loop will always either:
  // 1. Return success result
  // 2. Return error result when maxAttempts reached or error not retryable
  // But TypeScript needs a return, and lastError will always be defined if we get here
  // because we only exit the loop early on success or error condition
  throw new Error(
    "Unexpected: retry loop completed without returning a result"
  );
}

/**
 * Wrap an async operation with a timeout.
 *
 * Returns TimeoutError if operation doesn't complete within the specified duration.
 *
 * @typeParam T - Success type
 * @typeParam E - Error type
 * @param fn - Async function returning Result
 * @param options - Timeout configuration
 * @returns Result from operation or TimeoutError
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => slowOperation(),
 *   { timeoutMs: 5000, operation: "database query" }
 * );
 *
 * if (result.isErr() && result.error._tag === "TimeoutError") {
 *   // Handle timeout
 * }
 * ```
 */
export async function withTimeout<T, E extends OutfitterError>(
  fn: () => Promise<Result<T, E>>,
  options: TimeoutOptions
): Promise<Result<T, E | TimeoutError>> {
  const { timeoutMs, operation = "operation" } = options;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<Result<T, TimeoutError>>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(
        Result.err(
          new TimeoutError({
            message: `${operation} timed out after ${timeoutMs}ms`,
            operation,
            timeoutMs,
          })
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
