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
  AlreadyExistsError,
  AmbiguousError,
  AssertionError,
  AuthError,
  CancelledError,
  ConflictError,
  ERROR_CODES,
  type ErrorCategory,
  type ErrorCode,
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

  it("exposes optional context property", () => {
    const error = new ValidationError({
      message: "Value out of range",
      field: "age",
      context: { min: 0, max: 150, received: -1 },
    });
    expect(error.context).toEqual({ min: 0, max: 150, received: -1 });
  });

  it("context defaults to undefined when not provided", () => {
    const error = new ValidationError({ message: "Invalid input" });
    expect(error.context).toBeUndefined();
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

describe("AmbiguousError", () => {
  it("has correct _tag", () => {
    const error = new AmbiguousError({
      message: "Multiple matches",
      candidates: ["a", "b"],
    });
    expect(error._tag).toBe("AmbiguousError");
  });

  it("has validation category", () => {
    const error = new AmbiguousError({
      message: "Multiple matches",
      candidates: ["a", "b"],
    });
    expect(error.category).toBe("validation");
  });

  it("exposes candidates array", () => {
    const error = new AmbiguousError({
      message: "Multiple headings match",
      candidates: ["Introduction", "Intro to APIs"],
    });
    expect(error.candidates).toEqual(["Introduction", "Intro to APIs"]);
  });

  it("exposes optional context", () => {
    const error = new AmbiguousError({
      message: "Multiple matches",
      candidates: ["a", "b"],
      context: { query: "Intro" },
    });
    expect(error.context).toEqual({ query: "Intro" });
  });

  it("exitCode() returns validation exit code", () => {
    const error = new AmbiguousError({
      message: "Multiple matches",
      candidates: ["a"],
    });
    expect(error.exitCode()).toBe(1);
  });

  it("statusCode() returns 400", () => {
    const error = new AmbiguousError({
      message: "Multiple matches",
      candidates: ["a"],
    });
    expect(error.statusCode()).toBe(400);
  });
});

describe("AmbiguousError.create()", () => {
  it("generates message from what and candidate count", () => {
    const error = AmbiguousError.create("heading", [
      "Introduction",
      "Intro to APIs",
    ]);
    expect(error.message).toBe("Ambiguous heading: 2 matches found");
    expect(error.candidates).toEqual(["Introduction", "Intro to APIs"]);
  });

  it("accepts optional context", () => {
    const error = AmbiguousError.create("command", ["list", "lint"], {
      input: "li",
    });
    expect(error.context).toEqual({ input: "li" });
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

  it("exposes optional context property", () => {
    const error = new NotFoundError({
      message: "Heading not found",
      resourceType: "heading",
      resourceId: "h:Intro",
      context: { availableHeadings: ["Introduction", "Getting Started"] },
    });
    expect(error.context).toEqual({
      availableHeadings: ["Introduction", "Getting Started"],
    });
  });

  it("context defaults to undefined when not provided", () => {
    const error = new NotFoundError({
      message: "note not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    expect(error.context).toBeUndefined();
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

describe("AlreadyExistsError", () => {
  it("has correct _tag", () => {
    const error = new AlreadyExistsError({
      message: "file already exists",
      resourceType: "file",
      resourceId: "notes/meeting.md",
    });
    expect(error._tag).toBe("AlreadyExistsError");
  });

  it("has conflict category", () => {
    const error = new AlreadyExistsError({
      message: "file already exists",
      resourceType: "file",
      resourceId: "notes/meeting.md",
    });
    expect(error.category).toBe("conflict");
  });

  it("exposes resourceType and resourceId", () => {
    const error = new AlreadyExistsError({
      message: "file already exists",
      resourceType: "file",
      resourceId: "notes/meeting.md",
    });
    expect(error.resourceType).toBe("file");
    expect(error.resourceId).toBe("notes/meeting.md");
  });

  it("exposes optional context", () => {
    const error = new AlreadyExistsError({
      message: "file already exists",
      resourceType: "file",
      resourceId: "notes/meeting.md",
      context: { suggestion: "Use --force to overwrite" },
    });
    expect(error.context).toEqual({ suggestion: "Use --force to overwrite" });
  });

  it("exitCode() returns conflict exit code", () => {
    const error = new AlreadyExistsError({
      message: "file already exists",
      resourceType: "file",
      resourceId: "notes/meeting.md",
    });
    expect(error.exitCode()).toBe(3);
  });

  it("statusCode() returns 409", () => {
    const error = new AlreadyExistsError({
      message: "file already exists",
      resourceType: "file",
      resourceId: "notes/meeting.md",
    });
    expect(error.statusCode()).toBe(409);
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
// Static Factory Method Tests
// ============================================================================

describe("static create() methods", () => {
  it("ValidationError.create() sets field and generates message", () => {
    const error = ValidationError.create("email", "format invalid");
    expect(error.message).toBe("email: format invalid");
    expect(error.field).toBe("email");
    expect(error._tag).toBe("ValidationError");
    expect(error.category).toBe("validation");
  });

  it("ValidationError.create() accepts optional context", () => {
    const error = ValidationError.create("age", "out of range", {
      min: 0,
      max: 150,
    });
    expect(error.context).toEqual({ min: 0, max: 150 });
  });

  it("ValidationError.fromMessage() creates freeform error without field", () => {
    const error = ValidationError.fromMessage("Invalid pipeline configuration");
    expect(error._tag).toBe("ValidationError");
    expect(error.category).toBe("validation");
    expect(error.message).toBe("Invalid pipeline configuration");
    expect(error.field).toBeUndefined();
  });

  it("ValidationError.fromMessage() preserves context", () => {
    const error = ValidationError.fromMessage("Config invalid", {
      path: "/etc/app.toml",
    });
    expect(error.context).toEqual({ path: "/etc/app.toml" });
  });

  it("ValidationError.fromMessage() has correct exit and status codes", () => {
    const error = ValidationError.fromMessage("Bad input");
    expect(error.exitCode()).toBe(1);
    expect(error.statusCode()).toBe(400);
  });

  it("ValidationError.fromMessage() omits context when not provided", () => {
    const error = ValidationError.fromMessage("Bad input");
    expect(error.context).toBeUndefined();
  });

  it("NotFoundError.create() generates message from type and id", () => {
    const error = NotFoundError.create("PR", "outfitter#123");
    expect(error.message).toBe("PR not found: outfitter#123");
    expect(error.resourceType).toBe("PR");
    expect(error.resourceId).toBe("outfitter#123");
  });

  it("NotFoundError.create() accepts optional context", () => {
    const error = NotFoundError.create("heading", "h:Intro", {
      available: ["Introduction"],
    });
    expect(error.context).toEqual({ available: ["Introduction"] });
  });

  it("AlreadyExistsError.create() generates message from type and id", () => {
    const error = AlreadyExistsError.create("file", "notes/meeting.md");
    expect(error.message).toBe("file already exists: notes/meeting.md");
    expect(error.resourceType).toBe("file");
    expect(error.resourceId).toBe("notes/meeting.md");
    expect(error.category).toBe("conflict");
  });

  it("AlreadyExistsError.create() accepts optional context", () => {
    const error = AlreadyExistsError.create("file", "notes/meeting.md", {
      suggestion: "Use --force to overwrite",
    });
    expect(error.context).toEqual({ suggestion: "Use --force to overwrite" });
  });

  it("ConflictError.create() builds from message", () => {
    const error = ConflictError.create("Resource was modified");
    expect(error.message).toBe("Resource was modified");
    expect(error.category).toBe("conflict");
  });

  it("TimeoutError.create() generates message from operation and ms", () => {
    const error = TimeoutError.create("database query", 5000);
    expect(error.message).toBe("database query timed out after 5000ms");
    expect(error.operation).toBe("database query");
    expect(error.timeoutMs).toBe(5000);
  });

  it("RateLimitError.create() includes retryAfterSeconds", () => {
    const error = RateLimitError.create("Rate limit exceeded", 60);
    expect(error.message).toBe("Rate limit exceeded");
    expect(error.retryAfterSeconds).toBe(60);
  });

  it("AuthError.create() includes reason", () => {
    const error = AuthError.create("Token expired", "expired");
    expect(error.message).toBe("Token expired");
    expect(error.reason).toBe("expired");
  });

  it("CancelledError.create() builds from message", () => {
    const error = CancelledError.create("User aborted");
    expect(error.message).toBe("User aborted");
    expect(error.category).toBe("cancelled");
  });

  it("NetworkError.create() includes context", () => {
    const error = NetworkError.create("Connection refused", {
      host: "api.example.com",
    });
    expect(error.message).toBe("Connection refused");
    expect(error.context).toEqual({ host: "api.example.com" });
  });

  it("InternalError.create() includes context", () => {
    const error = InternalError.create("Unexpected state", {
      state: "corrupted",
    });
    expect(error.message).toBe("Unexpected state");
    expect(error.context).toEqual({ state: "corrupted" });
  });

  it("PermissionError.create() includes context", () => {
    const error = PermissionError.create("Access denied", {
      required: "admin",
    });
    expect(error.message).toBe("Access denied");
    expect(error.context).toEqual({ required: "admin" });
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

// ============================================================================
// ERROR_CODES Tests (Granular Numeric Error Codes)
// ============================================================================

describe("ERROR_CODES", () => {
  it("includes all 10 error categories", () => {
    const categories = Object.keys(ERROR_CODES);
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

  it("has at least one error code per category", () => {
    for (const [_category, codes] of Object.entries(ERROR_CODES)) {
      const codeCount = Object.keys(codes).length;
      expect(codeCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("has unique error codes across all categories", () => {
    const allCodes: number[] = [];
    for (const codes of Object.values(ERROR_CODES)) {
      allCodes.push(...Object.values(codes));
    }
    const uniqueCodes = new Set(allCodes);
    expect(uniqueCodes.size).toBe(allCodes.length);
  });

  it("has validation codes in 1000-1999 range", () => {
    for (const code of Object.values(ERROR_CODES.validation)) {
      expect(code).toBeGreaterThanOrEqual(1000);
      expect(code).toBeLessThan(2000);
    }
  });

  it("has not_found codes in 2000-2999 range", () => {
    for (const code of Object.values(ERROR_CODES.not_found)) {
      expect(code).toBeGreaterThanOrEqual(2000);
      expect(code).toBeLessThan(3000);
    }
  });

  it("has conflict codes in 3000-3999 range", () => {
    for (const code of Object.values(ERROR_CODES.conflict)) {
      expect(code).toBeGreaterThanOrEqual(3000);
      expect(code).toBeLessThan(4000);
    }
  });

  it("has permission codes in 4000-4999 range", () => {
    for (const code of Object.values(ERROR_CODES.permission)) {
      expect(code).toBeGreaterThanOrEqual(4000);
      expect(code).toBeLessThan(5000);
    }
  });

  it("has timeout codes in 5000-5999 range", () => {
    for (const code of Object.values(ERROR_CODES.timeout)) {
      expect(code).toBeGreaterThanOrEqual(5000);
      expect(code).toBeLessThan(6000);
    }
  });

  it("has rate_limit codes in 6000-6999 range", () => {
    for (const code of Object.values(ERROR_CODES.rate_limit)) {
      expect(code).toBeGreaterThanOrEqual(6000);
      expect(code).toBeLessThan(7000);
    }
  });

  it("has network codes in 7000-7999 range", () => {
    for (const code of Object.values(ERROR_CODES.network)) {
      expect(code).toBeGreaterThanOrEqual(7000);
      expect(code).toBeLessThan(8000);
    }
  });

  it("has internal codes in 8000-8999 range", () => {
    for (const code of Object.values(ERROR_CODES.internal)) {
      expect(code).toBeGreaterThanOrEqual(8000);
      expect(code).toBeLessThan(9000);
    }
  });

  it("has auth codes in 9000-9999 range", () => {
    for (const code of Object.values(ERROR_CODES.auth)) {
      expect(code).toBeGreaterThanOrEqual(9000);
      expect(code).toBeLessThan(10_000);
    }
  });

  it("has cancelled codes in 10000-10999 range", () => {
    for (const code of Object.values(ERROR_CODES.cancelled)) {
      expect(code).toBeGreaterThanOrEqual(10_000);
      expect(code).toBeLessThan(11_000);
    }
  });

  it("has expected validation error codes", () => {
    expect(ERROR_CODES.validation.FIELD_REQUIRED).toBe(1001);
    expect(ERROR_CODES.validation.INVALID_FORMAT).toBe(1002);
    expect(ERROR_CODES.validation.OUT_OF_RANGE).toBe(1003);
    expect(ERROR_CODES.validation.TYPE_MISMATCH).toBe(1004);
    expect(ERROR_CODES.validation.AMBIGUOUS_MATCH).toBe(1005);
  });

  it("has expected not_found error codes", () => {
    expect(ERROR_CODES.not_found.RESOURCE_NOT_FOUND).toBe(2001);
    expect(ERROR_CODES.not_found.FILE_NOT_FOUND).toBe(2002);
  });

  it("has expected conflict error codes", () => {
    expect(ERROR_CODES.conflict.ALREADY_EXISTS).toBe(3001);
    expect(ERROR_CODES.conflict.VERSION_MISMATCH).toBe(3002);
  });

  it("has expected permission error codes", () => {
    expect(ERROR_CODES.permission.FORBIDDEN).toBe(4001);
    expect(ERROR_CODES.permission.INSUFFICIENT_RIGHTS).toBe(4002);
  });

  it("has expected timeout error codes", () => {
    expect(ERROR_CODES.timeout.OPERATION_TIMEOUT).toBe(5001);
    expect(ERROR_CODES.timeout.CONNECTION_TIMEOUT).toBe(5002);
  });

  it("has expected rate_limit error codes", () => {
    expect(ERROR_CODES.rate_limit.QUOTA_EXCEEDED).toBe(6001);
    expect(ERROR_CODES.rate_limit.THROTTLED).toBe(6002);
  });

  it("has expected network error codes", () => {
    expect(ERROR_CODES.network.CONNECTION_REFUSED).toBe(7001);
    expect(ERROR_CODES.network.DNS_FAILED).toBe(7002);
  });

  it("has expected internal error codes", () => {
    expect(ERROR_CODES.internal.UNEXPECTED_STATE).toBe(8001);
    expect(ERROR_CODES.internal.ASSERTION_FAILED).toBe(8002);
  });

  it("has expected auth error codes", () => {
    expect(ERROR_CODES.auth.INVALID_TOKEN).toBe(9001);
    expect(ERROR_CODES.auth.EXPIRED_TOKEN).toBe(9002);
  });

  it("has expected cancelled error codes", () => {
    expect(ERROR_CODES.cancelled.USER_CANCELLED).toBe(10_001);
    expect(ERROR_CODES.cancelled.SIGNAL_RECEIVED).toBe(10_002);
  });
});

// ============================================================================
// ErrorCode Type Tests
// ============================================================================

describe("ErrorCode type", () => {
  it("is a union of all error code numbers", () => {
    // Type-level validation: ErrorCode should accept any valid error code
    const validCode1: ErrorCode = 1001;
    const validCode2: ErrorCode = 9002;
    const validCode3: ErrorCode = 10_001;

    // Runtime validation: all codes should be numbers
    expect(typeof validCode1).toBe("number");
    expect(typeof validCode2).toBe("number");
    expect(typeof validCode3).toBe("number");
  });

  it("includes codes from all categories", () => {
    // Collect all error codes as ErrorCode type
    const codes: ErrorCode[] = [
      ERROR_CODES.validation.FIELD_REQUIRED,
      ERROR_CODES.not_found.RESOURCE_NOT_FOUND,
      ERROR_CODES.conflict.ALREADY_EXISTS,
      ERROR_CODES.permission.FORBIDDEN,
      ERROR_CODES.timeout.OPERATION_TIMEOUT,
      ERROR_CODES.rate_limit.QUOTA_EXCEEDED,
      ERROR_CODES.network.CONNECTION_REFUSED,
      ERROR_CODES.internal.UNEXPECTED_STATE,
      ERROR_CODES.auth.INVALID_TOKEN,
      ERROR_CODES.cancelled.USER_CANCELLED,
    ];

    // All should be valid ErrorCode values
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(typeof code).toBe("number");
    }
  });
});
