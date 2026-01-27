/**
 * Tests for @outfitter/contracts/errors
 *
 * Tests cover:
 * - ErrorCategory type (2 tests)
 * - BaseKitError / Error Classes (8 + 26 tests, including AssertionError)
 * - Exit/Status Code Maps (6 tests)
 *
 * Total: 42 tests
 */
import { describe, expect, it } from "bun:test";
import {
  AssertionError,
  AuthError,
  CancelledError,
  ConflictError,
  type ErrorCategory,
  exitCodeMap,
  getExitCode,
  getStatusCode,
  InternalError,
  NetworkError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  statusCodeMap,
  TimeoutError,
  ValidationError,
} from "../errors.js";

// ============================================================================
// ErrorCategory Type Tests (2 tests)
// ============================================================================

describe("ErrorCategory", () => {
  it("includes all 10 categories", () => {
    // Use exitCodeMap keys as runtime validation of category names
    const categories = Object.keys(exitCodeMap);

    expect(categories).toContain("validation");
    expect(categories).toContain("not_found");
    expect(categories).toContain("conflict");
    expect(categories).toContain("permission");
    expect(categories).toContain("timeout");
    expect(categories).toContain("rate_limit");
    expect(categories).toContain("network");
    expect(categories).toContain("internal");
    expect(categories).toContain("auth");
    expect(categories).toContain("cancelled");
    expect(categories).toHaveLength(10);
  });

  it("validates at runtime via exitCodeMap keys", () => {
    // Type-level check: this should compile
    const category: ErrorCategory = "validation";
    expect(exitCodeMap[category]).toBeDefined();

    // All categories should have corresponding exit codes
    const allCategories: ErrorCategory[] = [
      "validation",
      "not_found",
      "conflict",
      "permission",
      "timeout",
      "rate_limit",
      "network",
      "internal",
      "auth",
      "cancelled",
    ];

    for (const cat of allCategories) {
      expect(exitCodeMap[cat]).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Exit/Status Code Maps Tests (6 tests)
// ============================================================================

describe("exitCodeMap", () => {
  it("maps all 10 categories to exit codes", () => {
    expect(Object.keys(exitCodeMap)).toHaveLength(10);
  });

  it("maps categories to non-zero exit codes", () => {
    for (const [_category, code] of Object.entries(exitCodeMap)) {
      expect(code).toBeGreaterThan(0);
      expect(code).toBeLessThan(256); // Valid exit code range
    }
  });

  it("has unique exit codes for each category", () => {
    const codes = Object.values(exitCodeMap);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

describe("statusCodeMap", () => {
  it("maps all 10 categories to HTTP status codes", () => {
    expect(Object.keys(statusCodeMap)).toHaveLength(10);
  });

  it("maps to valid HTTP status codes (400-599 range)", () => {
    for (const [_category, code] of Object.entries(statusCodeMap)) {
      expect(code).toBeGreaterThanOrEqual(400);
      expect(code).toBeLessThan(600);
    }
  });

  it("maps specific categories to expected HTTP codes", () => {
    expect(statusCodeMap.validation).toBe(400); // Bad Request
    expect(statusCodeMap.not_found).toBe(404); // Not Found
    expect(statusCodeMap.conflict).toBe(409); // Conflict
    expect(statusCodeMap.permission).toBe(403); // Forbidden
    expect(statusCodeMap.timeout).toBe(504); // Gateway Timeout
    expect(statusCodeMap.rate_limit).toBe(429); // Too Many Requests
    expect(statusCodeMap.network).toBe(502); // Bad Gateway
    expect(statusCodeMap.internal).toBe(500); // Internal Server Error
    expect(statusCodeMap.auth).toBe(401); // Unauthorized
    expect(statusCodeMap.cancelled).toBe(499); // Client Closed Request
  });
});

// ============================================================================
// Error Class Tests - Common Behavior (8 tests per class pattern)
// ============================================================================

describe("ValidationError", () => {
  it("extends TaggedError", () => {
    const error = new ValidationError({ message: "Invalid input" });
    // TaggedError instances should have _tag property
    expect(error._tag).toBeDefined();
  });

  it("has correct _tag", () => {
    const error = new ValidationError({ message: "Invalid input" });
    expect(error._tag).toBe("ValidationError");
  });

  it("has correct category", () => {
    const error = new ValidationError({ message: "Invalid input" });
    expect(error.category).toBe("validation");
  });

  it("exposes message property", () => {
    const error = new ValidationError({ message: "Email format invalid" });
    expect(error.message).toBe("Email format invalid");
  });

  it("exposes optional field property", () => {
    const error = new ValidationError({
      message: "Invalid email",
      field: "email",
    });
    expect(error.field).toBe("email");
  });

  it("exitCode() returns correct value", () => {
    const error = new ValidationError({ message: "Invalid input" });
    expect(error.exitCode()).toBe(exitCodeMap.validation);
    expect(error.exitCode()).toBe(1);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new ValidationError({ message: "Invalid input" });
    expect(error.statusCode()).toBe(statusCodeMap.validation);
    expect(error.statusCode()).toBe(400);
  });
});

describe("AssertionError", () => {
  it("extends TaggedError", () => {
    const error = new AssertionError({ message: "Invariant violated" });
    expect(error._tag).toBeDefined();
  });

  it("has correct _tag", () => {
    const error = new AssertionError({ message: "Invariant violated" });
    expect(error._tag).toBe("AssertionError");
  });

  it("has category 'internal' (programming bugs, not user input)", () => {
    // AssertionError indicates invariant violations — programming errors
    // These are internal issues, not user input validation failures
    const error = new AssertionError({ message: "Invariant violated" });
    expect(error.category).toBe("internal");
  });

  it("exposes message property", () => {
    const error = new AssertionError({ message: "Value must be non-null" });
    expect(error.message).toBe("Value must be non-null");
  });

  it("exitCode() returns internal category exit code", () => {
    const error = new AssertionError({ message: "Invariant violated" });
    expect(error.exitCode()).toBe(exitCodeMap.internal);
    expect(error.exitCode()).toBe(8);
  });

  it("statusCode() returns internal category HTTP code", () => {
    const error = new AssertionError({ message: "Invariant violated" });
    expect(error.statusCode()).toBe(statusCodeMap.internal);
    expect(error.statusCode()).toBe(500);
  });
});

describe("NotFoundError", () => {
  it("extends TaggedError", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error._tag).toBeDefined();
  });

  it("has correct _tag", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error._tag).toBe("NotFoundError");
  });

  it("has correct category", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error.category).toBe("not_found");
  });

  it("exposes resourceType and resourceId", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error.resourceType).toBe("note");
    expect(error.resourceId).toBe("abc123");
  });

  it("exitCode() returns correct value", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error.exitCode()).toBe(exitCodeMap.not_found);
    expect(error.exitCode()).toBe(2);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error.statusCode()).toBe(statusCodeMap.not_found);
    expect(error.statusCode()).toBe(404);
  });
});

describe("ConflictError", () => {
  it("has correct _tag", () => {
    const error = new ConflictError({ message: "Resource modified" });
    expect(error._tag).toBe("ConflictError");
  });

  it("has correct category", () => {
    const error = new ConflictError({ message: "Resource modified" });
    expect(error.category).toBe("conflict");
  });

  it("exitCode() returns correct value", () => {
    const error = new ConflictError({ message: "Resource modified" });
    expect(error.exitCode()).toBe(3);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new ConflictError({ message: "Resource modified" });
    expect(error.statusCode()).toBe(409);
  });
});

describe("PermissionError", () => {
  it("has correct _tag", () => {
    const error = new PermissionError({ message: "Access denied" });
    expect(error._tag).toBe("PermissionError");
  });

  it("has correct category", () => {
    const error = new PermissionError({ message: "Access denied" });
    expect(error.category).toBe("permission");
  });

  it("exitCode() returns correct value", () => {
    const error = new PermissionError({ message: "Access denied" });
    expect(error.exitCode()).toBe(4);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new PermissionError({ message: "Access denied" });
    expect(error.statusCode()).toBe(403);
  });
});

describe("TimeoutError", () => {
  it("has correct _tag", () => {
    const error = new TimeoutError({
      message: "Operation timed out",
      operation: "database query",
      timeoutMs: 5000,
    });
    expect(error._tag).toBe("TimeoutError");
  });

  it("has correct category", () => {
    const error = new TimeoutError({
      message: "Operation timed out",
      operation: "database query",
      timeoutMs: 5000,
    });
    expect(error.category).toBe("timeout");
  });

  it("exposes operation and timeoutMs", () => {
    const error = new TimeoutError({
      message: "Operation timed out",
      operation: "database query",
      timeoutMs: 5000,
    });
    expect(error.operation).toBe("database query");
    expect(error.timeoutMs).toBe(5000);
  });

  it("exitCode() returns correct value", () => {
    const error = new TimeoutError({
      message: "Operation timed out",
      operation: "database query",
      timeoutMs: 5000,
    });
    expect(error.exitCode()).toBe(5);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new TimeoutError({
      message: "Operation timed out",
      operation: "database query",
      timeoutMs: 5000,
    });
    expect(error.statusCode()).toBe(504);
  });
});

describe("RateLimitError", () => {
  it("has correct _tag", () => {
    const error = new RateLimitError({ message: "Rate limit exceeded" });
    expect(error._tag).toBe("RateLimitError");
  });

  it("has correct category", () => {
    const error = new RateLimitError({ message: "Rate limit exceeded" });
    expect(error.category).toBe("rate_limit");
  });

  it("exposes optional retryAfterSeconds", () => {
    const error = new RateLimitError({
      message: "Rate limit exceeded",
      retryAfterSeconds: 60,
    });
    expect(error.retryAfterSeconds).toBe(60);
  });

  it("exitCode() returns correct value", () => {
    const error = new RateLimitError({ message: "Rate limit exceeded" });
    expect(error.exitCode()).toBe(6);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new RateLimitError({ message: "Rate limit exceeded" });
    expect(error.statusCode()).toBe(429);
  });
});

describe("NetworkError", () => {
  it("has correct _tag", () => {
    const error = new NetworkError({ message: "Connection refused" });
    expect(error._tag).toBe("NetworkError");
  });

  it("has correct category", () => {
    const error = new NetworkError({ message: "Connection refused" });
    expect(error.category).toBe("network");
  });

  it("exitCode() returns correct value", () => {
    const error = new NetworkError({ message: "Connection refused" });
    expect(error.exitCode()).toBe(7);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new NetworkError({ message: "Connection refused" });
    expect(error.statusCode()).toBe(502);
  });
});

describe("InternalError", () => {
  it("has correct _tag", () => {
    const error = new InternalError({ message: "Unexpected error" });
    expect(error._tag).toBe("InternalError");
  });

  it("has correct category", () => {
    const error = new InternalError({ message: "Unexpected error" });
    expect(error.category).toBe("internal");
  });

  it("exitCode() returns correct value", () => {
    const error = new InternalError({ message: "Unexpected error" });
    expect(error.exitCode()).toBe(8);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new InternalError({ message: "Unexpected error" });
    expect(error.statusCode()).toBe(500);
  });
});

describe("AuthError", () => {
  it("has correct _tag", () => {
    const error = new AuthError({ message: "Invalid API key" });
    expect(error._tag).toBe("AuthError");
  });

  it("has correct category", () => {
    const error = new AuthError({ message: "Invalid API key" });
    expect(error.category).toBe("auth");
  });

  it("exposes optional reason", () => {
    const error = new AuthError({
      message: "Token expired",
      reason: "expired",
    });
    expect(error.reason).toBe("expired");
  });

  it("exitCode() returns correct value", () => {
    const error = new AuthError({ message: "Invalid API key" });
    expect(error.exitCode()).toBe(9);
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new AuthError({ message: "Invalid API key" });
    expect(error.statusCode()).toBe(401);
  });
});

describe("CancelledError", () => {
  it("has correct _tag", () => {
    const error = new CancelledError({ message: "Operation cancelled" });
    expect(error._tag).toBe("CancelledError");
  });

  it("has correct category", () => {
    const error = new CancelledError({ message: "Operation cancelled" });
    expect(error.category).toBe("cancelled");
  });

  it("exitCode() returns correct value", () => {
    const error = new CancelledError({ message: "Operation cancelled" });
    expect(error.exitCode()).toBe(130); // POSIX: 128 + SIGINT(2)
  });

  it("statusCode() returns correct HTTP code", () => {
    const error = new CancelledError({ message: "Operation cancelled" });
    expect(error.statusCode()).toBe(499);
  });
});

// ============================================================================
// Helper Functions Tests
// ============================================================================

describe("getExitCode", () => {
  it("returns correct exit code for each category", () => {
    expect(getExitCode("validation")).toBe(1);
    expect(getExitCode("not_found")).toBe(2);
    expect(getExitCode("conflict")).toBe(3);
    expect(getExitCode("permission")).toBe(4);
    expect(getExitCode("timeout")).toBe(5);
    expect(getExitCode("rate_limit")).toBe(6);
    expect(getExitCode("network")).toBe(7);
    expect(getExitCode("internal")).toBe(8);
    expect(getExitCode("auth")).toBe(9);
    expect(getExitCode("cancelled")).toBe(130); // POSIX: 128 + SIGINT(2)
  });
});

describe("getStatusCode", () => {
  it("returns correct HTTP status code for each category", () => {
    expect(getStatusCode("validation")).toBe(400);
    expect(getStatusCode("not_found")).toBe(404);
    expect(getStatusCode("conflict")).toBe(409);
    expect(getStatusCode("permission")).toBe(403);
    expect(getStatusCode("timeout")).toBe(504);
    expect(getStatusCode("rate_limit")).toBe(429);
    expect(getStatusCode("network")).toBe(502);
    expect(getStatusCode("internal")).toBe(500);
    expect(getStatusCode("auth")).toBe(401);
    expect(getStatusCode("cancelled")).toBe(499);
  });
});
