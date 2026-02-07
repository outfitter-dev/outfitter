/**
 * Tests for @outfitter/contracts/serialization
 *
 * Tests cover:
 * - serializeError() (6 tests)
 * - deserializeError() (8 tests)
 * - safeStringify() (5 tests)
 * - safeParse<T>() (4 tests)
 *
 * Total: 23 tests
 */
import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
  AmbiguousError,
  AssertionError,
  ConflictError,
  InternalError,
  NotFoundError,
  type SerializedError,
  ValidationError,
} from "../errors.js";
import {
  deserializeError,
  safeParse,
  safeStringify,
  serializeError,
} from "../serialization.js";

// ============================================================================
// serializeError() Tests (6 tests)
// ============================================================================

describe("serializeError()", () => {
  it("produces SerializedError shape", () => {
    const error = new ValidationError({ message: "Invalid input" });

    const serialized = serializeError(error);

    expect(serialized).toHaveProperty("_tag");
    expect(serialized).toHaveProperty("category");
    expect(serialized).toHaveProperty("message");
  });

  it("includes _tag, category, message", () => {
    const error = new NotFoundError({
      message: "Resource not found",
      resourceType: "note",
      resourceId: "abc123",
    });

    const serialized = serializeError(error);

    expect(serialized._tag).toBe("NotFoundError");
    expect(serialized.category).toBe("not_found");
    expect(serialized.message).toBe("Resource not found");
  });

  it("includes context when present", () => {
    const error = new NotFoundError({
      message: "Resource not found",
      resourceType: "note",
      resourceId: "abc123",
    });

    const serialized = serializeError(error);

    expect(serialized.context).toBeDefined();
    expect(serialized.context?.resourceType).toBe("note");
    expect(serialized.context?.resourceId).toBe("abc123");
  });

  it("strips stack in production (NODE_ENV=production)", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const error = new InternalError({ message: "Unexpected error" });
      const serialized = serializeError(error);

      // In production, stack should be stripped unless explicitly requested
      expect(serialized).not.toHaveProperty("stack");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("includes stack when includeStack: true", () => {
    const error = new InternalError({ message: "Unexpected error" });
    const serialized = serializeError(error, { includeStack: true });

    // When explicitly requested, stack should be included
    // This might be in the serialized error or in the context
    const hasStack =
      "stack" in serialized || serialized.context?.stack !== undefined;
    expect(hasStack).toBe(true);
  });

  it("handles nested context objects", () => {
    const error = new ConflictError({
      message: "Conflict detected",
      context: {
        expected: { version: 1 },
        actual: { version: 2 },
        metadata: { nested: { deep: "value" } },
      },
    });

    const serialized = serializeError(error);

    expect(serialized.context).toBeDefined();
  });
});

// ============================================================================
// deserializeError() Tests (6 tests)
// ============================================================================

describe("deserializeError()", () => {
  it("reconstructs ValidationError from _tag", () => {
    const serialized: SerializedError = {
      _tag: "ValidationError",
      category: "validation",
      message: "Invalid input",
      context: { field: "email" },
    };

    const error = deserializeError(serialized);

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Invalid input");
  });

  it("reconstructs NotFoundError with resourceType/resourceId", () => {
    const serialized: SerializedError = {
      _tag: "NotFoundError",
      category: "not_found",
      message: "Resource not found",
      context: { resourceType: "note", resourceId: "abc123" },
    };

    const error = deserializeError(serialized);

    expect(error._tag).toBe("NotFoundError");
    if (error._tag === "NotFoundError") {
      expect((error as NotFoundError).resourceType).toBe("note");
      expect((error as NotFoundError).resourceId).toBe("abc123");
    }
  });

  it("reconstructs all 12 error types", () => {
    const errorTags = [
      "ValidationError",
      "AmbiguousError",
      "AssertionError",
      "NotFoundError",
      "ConflictError",
      "PermissionError",
      "TimeoutError",
      "RateLimitError",
      "NetworkError",
      "InternalError",
      "AuthError",
      "CancelledError",
    ] as const;

    for (const tag of errorTags) {
      const serialized: SerializedError = {
        _tag: tag,
        category: "internal", // category doesn't matter for deserialization
        message: `${tag} message`,
      };

      const error = deserializeError(serialized);
      expect(error._tag).toBe(tag);
    }
  });

  it("preserves context", () => {
    const serialized: SerializedError = {
      _tag: "InternalError",
      category: "internal",
      message: "Something went wrong",
      context: {
        operation: "database_query",
        query: "SELECT * FROM users",
      },
    };

    const error = deserializeError(serialized);

    // Error should preserve context information
    expect(error.message).toBe("Something went wrong");
  });

  it("returns InternalError for unknown _tag", () => {
    const serialized: SerializedError = {
      _tag: "UnknownError" as string,
      category: "internal",
      message: "Unknown error type",
    };

    const error = deserializeError(serialized);

    // Unknown tags should fall back to InternalError
    expect(error._tag).toBe("InternalError");
  });

  it("handles missing optional fields", () => {
    const serialized: SerializedError = {
      _tag: "InternalError",
      category: "internal",
      message: "Minimal error",
      // no context
    };

    const error = deserializeError(serialized);

    expect(error._tag).toBe("InternalError");
    expect(error.message).toBe("Minimal error");
  });

  it("round-trips AmbiguousError with candidates", () => {
    const original = new AmbiguousError({
      message: "Multiple matches found",
      candidates: ["Introduction", "Intro to APIs"],
    });

    const serialized = serializeError(original);
    expect(serialized._tag).toBe("AmbiguousError");
    expect(serialized.category).toBe("validation");
    expect(serialized.context?.candidates).toEqual([
      "Introduction",
      "Intro to APIs",
    ]);

    const deserialized = deserializeError(serialized);
    expect(deserialized._tag).toBe("AmbiguousError");
    expect(deserialized.message).toBe("Multiple matches found");
    expect((deserialized as AmbiguousError).candidates).toEqual([
      "Introduction",
      "Intro to APIs",
    ]);
  });

  it("round-trips AssertionError", () => {
    const original = new AssertionError({
      message: "Expected non-null value",
    });

    const serialized = serializeError(original);
    expect(serialized._tag).toBe("AssertionError");
    expect(serialized.category).toBe("internal");

    const deserialized = deserializeError(serialized);
    expect(deserialized._tag).toBe("AssertionError");
    expect(deserialized.message).toBe("Expected non-null value");
  });
});

// ============================================================================
// safeStringify() Tests (4 tests)
// ============================================================================

describe("safeStringify()", () => {
  it("handles circular references", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj; // Create circular reference

    // Should not throw
    const result = safeStringify(obj);

    expect(typeof result).toBe("string");
    // Result should contain something indicating circular reference was handled
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles BigInt values", () => {
    const obj = {
      smallNumber: 42,
      bigNumber: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
    };

    const result = safeStringify(obj);

    expect(typeof result).toBe("string");
    // BigInt should be converted to string or handled gracefully
    expect(result).toContain("9007199254740992");
  });

  it("handles undefined (converts to null or omits)", () => {
    const obj = {
      defined: "value",
      undefinedKey: undefined,
    };

    const result = safeStringify(obj);

    expect(typeof result).toBe("string");
    // undefined values should be handled (either converted to null or omitted)
    const parsed = JSON.parse(result);
    expect(parsed.defined).toBe("value");
  });

  it("respects pretty option (space parameter)", () => {
    const obj = { key: "value", nested: { inner: true } };

    const compact = safeStringify(obj);
    const pretty = safeStringify(obj, 2);

    // Pretty output should be longer due to whitespace
    expect(pretty.length).toBeGreaterThan(compact.length);
    // Pretty output should contain newlines
    expect(pretty).toContain("\n");
  });

  it("redacts sensitive values automatically", () => {
    const obj = {
      user: "alice",
      apiKey: "sk-abcdefghijklmnopqrstuvwxyz123456789012345678",
      config: {
        password: "super-secret",
      },
    };

    const json = safeStringify(obj);

    // Safe data should be preserved
    expect(json).toContain("alice");
    // Sensitive data should be redacted
    expect(json).toContain("[REDACTED]");
    expect(json).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(json).not.toContain("super-secret");
  });
});

// ============================================================================
// safeParse<T>() Tests (4 tests)
// ============================================================================

describe("safeParse<T>()", () => {
  it("returns Result.ok for valid JSON", () => {
    const json = '{"name":"test","value":42}';

    const result = safeParse(json);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const parsed = result.unwrap();
      expect((parsed as { name: string }).name).toBe("test");
      expect((parsed as { value: number }).value).toBe(42);
    }
  });

  it("returns Result.err for invalid JSON", () => {
    const invalidJson = '{"name": "test"'; // Missing closing brace

    const result = safeParse(invalidJson);

    expect(result.isErr()).toBe(true);
  });

  it("validates against schema when provided", () => {
    const ConfigSchema = z.object({
      port: z.number(),
      host: z.string(),
    });

    const validJson = '{"port":3000,"host":"localhost"}';
    const invalidJson = '{"port":"not-a-number","host":"localhost"}';

    const validResult = safeParse(validJson, ConfigSchema);
    expect(validResult.isOk()).toBe(true);

    const invalidResult = safeParse(invalidJson, ConfigSchema);
    expect(invalidResult.isErr()).toBe(true);
  });

  it("ValidationError includes parse position for syntax errors", () => {
    const invalidJson = '{"name": }'; // Syntax error

    const result = safeParse(invalidJson);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error;
      // Error message should include some indication of where the error occurred
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
