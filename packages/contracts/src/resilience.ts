import type { Result } from "better-result";
import type { KitError, TimeoutError } from "./errors.js";

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
	isRetryable?: (error: KitError) => boolean;

	/** Abort signal for cancellation */
	signal?: AbortSignal;

	/** Callback invoked before each retry */
	onRetry?: (attempt: number, error: KitError, delayMs: number) => void;
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
 *
 * @throws Error - Not implemented in scaffold
 */
export function retry<T>(
	_fn: () => Promise<Result<T, KitError>>,
	_options?: RetryOptions,
): Promise<Result<T, KitError>> {
	throw new Error("Not implemented");
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
 * if (result.isErr() && result.unwrapErr()._tag === "TimeoutError") {
 *   // Handle timeout
 * }
 * ```
 *
 * @throws Error - Not implemented in scaffold
 */
export function withTimeout<T, E extends KitError>(
	_fn: () => Promise<Result<T, E>>,
	_options: TimeoutOptions,
): Promise<Result<T, E | TimeoutError>> {
	throw new Error("Not implemented");
}
