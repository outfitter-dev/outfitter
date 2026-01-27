/**
 * Tests for @outfitter/contracts/recovery
 *
 * Tests cover:
 * - isRecoverable function (8 tests)
 * - isRetryable function (8 tests)
 * - getBackoffDelay function (10 tests)
 * - shouldRetry function (6 tests)
 *
 * Total: 32 tests
 */
import { describe, expect, it } from "bun:test";
import {
  AuthError,
  CancelledError,
  ConflictError,
  InternalError,
  NetworkError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "../errors.js";
import {
  type BackoffOptions,
  getBackoffDelay,
  isRecoverable,
  isRetryable,
  shouldRetry,
} from "../recovery.js";

// ============================================================================
// isRecoverable Tests (8 tests)
// ============================================================================

describe("isRecoverable", () => {
  describe("returns true for recoverable categories", () => {
    it("returns true for network errors", () => {
      const error = new NetworkError({ message: "Connection refused" });
      expect(isRecoverable(error)).toBe(true);
    });

    it("returns true for timeout errors", () => {
      const error = new TimeoutError({
        message: "Operation timed out",
        operation: "fetch",
        timeoutMs: 5000,
      });
      expect(isRecoverable(error)).toBe(true);
    });

    it("returns true for rate_limit errors", () => {
      const error = new RateLimitError({
        message: "Rate limit exceeded",
        retryAfterSeconds: 60,
      });
      expect(isRecoverable(error)).toBe(true);
    });

    it("returns true for conflict errors (optimistic lock failures)", () => {
      const error = new ConflictError({
        message: "Resource was modified",
      });
      expect(isRecoverable(error)).toBe(true);
    });
  });

  describe("returns false for non-recoverable categories", () => {
    it("returns false for validation errors", () => {
      const error = new ValidationError({ message: "Invalid input" });
      expect(isRecoverable(error)).toBe(false);
    });

    it("returns false for auth errors", () => {
      const error = new AuthError({ message: "Invalid API key" });
      expect(isRecoverable(error)).toBe(false);
    });

    it("returns false for not_found errors", () => {
      const error = new NotFoundError({
        message: "Resource not found",
        resourceType: "user",
        resourceId: "123",
      });
      expect(isRecoverable(error)).toBe(false);
    });

    it("returns false for permission errors", () => {
      const error = new PermissionError({ message: "Access denied" });
      expect(isRecoverable(error)).toBe(false);
    });
  });
});

// ============================================================================
// isRetryable Tests (8 tests)
// ============================================================================

describe("isRetryable", () => {
  describe("returns true for retryable categories", () => {
    it("returns true for network errors", () => {
      const error = new NetworkError({ message: "Connection timeout" });
      expect(isRetryable(error)).toBe(true);
    });

    it("returns true for timeout errors", () => {
      const error = new TimeoutError({
        message: "Operation timed out",
        operation: "fetch",
        timeoutMs: 5000,
      });
      expect(isRetryable(error)).toBe(true);
    });
  });

  describe("returns false for non-retryable categories", () => {
    it("returns false for validation errors", () => {
      const error = new ValidationError({ message: "Invalid input" });
      expect(isRetryable(error)).toBe(false);
    });

    it("returns false for auth errors", () => {
      const error = new AuthError({ message: "Invalid API key" });
      expect(isRetryable(error)).toBe(false);
    });

    it("returns false for not_found errors", () => {
      const error = new NotFoundError({
        message: "Resource not found",
        resourceType: "user",
        resourceId: "123",
      });
      expect(isRetryable(error)).toBe(false);
    });

    it("returns false for permission errors", () => {
      const error = new PermissionError({ message: "Access denied" });
      expect(isRetryable(error)).toBe(false);
    });

    it("returns false for internal errors", () => {
      const error = new InternalError({ message: "Unexpected error" });
      expect(isRetryable(error)).toBe(false);
    });

    it("returns false for cancelled errors", () => {
      const error = new CancelledError({ message: "Operation cancelled" });
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe("is more restrictive than isRecoverable", () => {
    it("rate_limit is recoverable but not automatically retryable", () => {
      const error = new RateLimitError({
        message: "Rate limit exceeded",
        retryAfterSeconds: 60,
      });
      expect(isRecoverable(error)).toBe(true);
      expect(isRetryable(error)).toBe(false);
    });

    it("conflict is recoverable but not automatically retryable", () => {
      const error = new ConflictError({
        message: "Resource was modified",
      });
      expect(isRecoverable(error)).toBe(true);
      expect(isRetryable(error)).toBe(false);
    });
  });
});

// ============================================================================
// getBackoffDelay Tests (10 tests)
// ============================================================================

describe("getBackoffDelay", () => {
  describe("exponential strategy (default)", () => {
    it("returns baseDelayMs for attempt 0", () => {
      const delay = getBackoffDelay(0, { useJitter: false });
      expect(delay).toBe(100); // default baseDelayMs
    });

    it("doubles delay for each attempt", () => {
      const delay0 = getBackoffDelay(0, { useJitter: false });
      const delay1 = getBackoffDelay(1, { useJitter: false });
      const delay2 = getBackoffDelay(2, { useJitter: false });
      const delay3 = getBackoffDelay(3, { useJitter: false });

      expect(delay0).toBe(100);
      expect(delay1).toBe(200);
      expect(delay2).toBe(400);
      expect(delay3).toBe(800);
    });

    it("respects custom baseDelayMs", () => {
      const delay = getBackoffDelay(0, { baseDelayMs: 500, useJitter: false });
      expect(delay).toBe(500);
    });
  });

  describe("linear strategy", () => {
    it("increases delay linearly", () => {
      const options: BackoffOptions = { strategy: "linear", useJitter: false };
      const delay0 = getBackoffDelay(0, options);
      const delay1 = getBackoffDelay(1, options);
      const delay2 = getBackoffDelay(2, options);

      expect(delay0).toBe(100); // baseDelayMs * 1
      expect(delay1).toBe(200); // baseDelayMs * 2
      expect(delay2).toBe(300); // baseDelayMs * 3
    });
  });

  describe("constant strategy", () => {
    it("returns same delay regardless of attempt", () => {
      const options: BackoffOptions = {
        strategy: "constant",
        baseDelayMs: 250,
        useJitter: false,
      };
      const delay0 = getBackoffDelay(0, options);
      const delay1 = getBackoffDelay(1, options);
      const delay2 = getBackoffDelay(2, options);

      expect(delay0).toBe(250);
      expect(delay1).toBe(250);
      expect(delay2).toBe(250);
    });
  });

  describe("maxDelayMs cap", () => {
    it("caps delay at maxDelayMs", () => {
      const delay = getBackoffDelay(10, {
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        useJitter: false,
      });
      expect(delay).toBe(5000); // capped, not 1000 * 2^10 = 1024000
    });

    it("respects default maxDelayMs of 30000", () => {
      const delay = getBackoffDelay(20, {
        baseDelayMs: 1000,
        useJitter: false,
      });
      expect(delay).toBe(30_000); // default max
    });
  });

  describe("jitter", () => {
    it("adds jitter when useJitter is true (default)", () => {
      const baseOptions: BackoffOptions = { baseDelayMs: 1000 };
      const delays = new Set<number>();

      // Run multiple times to see jitter variation
      for (let i = 0; i < 20; i++) {
        delays.add(getBackoffDelay(0, baseOptions));
      }

      // With jitter, we should see some variation (not all same value)
      // Jitter is +/-10%, so values should be between 900 and 1100
      expect(delays.size).toBeGreaterThan(1);

      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(900);
        expect(delay).toBeLessThanOrEqual(1100);
      }
    });

    it("produces consistent results when useJitter is false", () => {
      const options: BackoffOptions = { baseDelayMs: 1000, useJitter: false };
      const delays = new Set<number>();

      for (let i = 0; i < 10; i++) {
        delays.add(getBackoffDelay(0, options));
      }

      expect(delays.size).toBe(1);
      expect([...delays][0]).toBe(1000);
    });
  });
});

// ============================================================================
// shouldRetry Tests (6 tests)
// ============================================================================

describe("shouldRetry", () => {
  describe("combines retryability with attempt limit", () => {
    it("returns true when error is retryable and under maxAttempts", () => {
      const error = new NetworkError({ message: "Connection timeout" });
      expect(shouldRetry(error, 0)).toBe(true);
      expect(shouldRetry(error, 1)).toBe(true);
      expect(shouldRetry(error, 2)).toBe(true);
    });

    it("returns false when at maxAttempts (default 3)", () => {
      const error = new NetworkError({ message: "Connection timeout" });
      expect(shouldRetry(error, 3)).toBe(false);
    });

    it("returns false when over maxAttempts", () => {
      const error = new NetworkError({ message: "Connection timeout" });
      expect(shouldRetry(error, 5)).toBe(false);
    });

    it("respects custom maxAttempts", () => {
      const error = new TimeoutError({
        message: "Operation timed out",
        operation: "fetch",
        timeoutMs: 5000,
      });
      expect(shouldRetry(error, 4, 5)).toBe(true);
      expect(shouldRetry(error, 5, 5)).toBe(false);
    });

    it("returns false for non-retryable errors regardless of attempt count", () => {
      const error = new ValidationError({ message: "Invalid input" });
      expect(shouldRetry(error, 0)).toBe(false);
      expect(shouldRetry(error, 0, 10)).toBe(false);
    });

    it("returns false for recoverable but non-retryable errors", () => {
      const error = new RateLimitError({
        message: "Rate limit exceeded",
        retryAfterSeconds: 60,
      });
      // Rate limit is recoverable but not automatically retryable
      expect(isRecoverable(error)).toBe(true);
      expect(shouldRetry(error, 0)).toBe(false);
    });
  });
});
