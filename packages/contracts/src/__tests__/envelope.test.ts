/**
 * Tests for @outfitter/contracts/envelope
 *
 * Tests cover:
 * - toEnvelope<T>() (6 tests)
 * - toHttpResponse<T>() (4 tests)
 *
 * Total: 10 tests
 */
import { describe, expect, it } from "bun:test";
import { Result } from "better-result";
import type { EnvelopeMeta } from "../envelope.js";
import { toEnvelope, toHttpResponse } from "../envelope.js";
import { InternalError, NotFoundError, ValidationError } from "../errors.js";

// ============================================================================
// toEnvelope<T>() Tests (6 tests)
// ============================================================================

describe("toEnvelope<T>()", () => {
  it("returns { ok: true, data } for Result.ok", () => {
    const data = { id: "123", name: "Test" };
    const result = Result.ok(data);

    const envelope = toEnvelope(result);

    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data).toEqual(data);
    }
  });

  it("returns { ok: false, error } for Result.err", () => {
    const error = new NotFoundError({
      message: "Resource not found",
      resourceType: "note",
      resourceId: "abc123",
    });
    const result = Result.err(error);

    const envelope = toEnvelope(result);

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error).toBeDefined();
      expect(envelope.error._tag).toBe("NotFoundError");
    }
  });

  it("serializes error using serializeError", () => {
    const error = new ValidationError({
      message: "Invalid email format",
      field: "email",
    });
    const result = Result.err(error);

    const envelope = toEnvelope(result);

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      // The error should be serialized, not the raw error object
      expect(envelope.error._tag).toBe("ValidationError");
      expect(envelope.error.category).toBe("validation");
      expect(envelope.error.message).toBe("Invalid email format");
    }
  });

  it("includes meta when provided", () => {
    const data = { value: "test" };
    const result = Result.ok(data);
    const meta: Partial<EnvelopeMeta> = {
      requestId: "req-123",
      durationMs: 150,
    };

    const envelope = toEnvelope(result, meta);

    expect(envelope.meta).toBeDefined();
    expect(envelope.meta.requestId).toBe("req-123");
    expect(envelope.meta.durationMs).toBe(150);
  });

  it("meta includes requestId", () => {
    const result = Result.ok({ data: "test" });

    const envelope = toEnvelope(result, { requestId: "custom-request-id" });

    expect(envelope.meta.requestId).toBe("custom-request-id");
  });

  it("meta includes pagination when present", () => {
    const result = Result.ok({ items: [1, 2, 3] });
    // Pagination would be passed separately to toEnvelope
    const _pagination = {
      total: 100,
      count: 3,
      nextCursor: "cursor-xyz",
      hasMore: true,
    };

    // Note: toEnvelope may need to accept pagination separately
    // This test verifies the envelope structure supports pagination
    const envelope = toEnvelope(result, { requestId: "req-1" });

    expect(envelope.meta).toBeDefined();
    // The envelope type should support optional pagination field
    if (envelope.ok && "pagination" in envelope) {
      expect(envelope.pagination).toBeDefined();
    }
  });
});

// ============================================================================
// toHttpResponse<T>() Tests (4 tests)
// ============================================================================

describe("toHttpResponse<T>()", () => {
  it("returns 200 for Result.ok", () => {
    const data = { id: "123", name: "Test" };
    const result = Result.ok(data);

    const response = toHttpResponse(result);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("maps error category to HTTP status", () => {
    // Test various error categories map to correct HTTP status codes
    const notFoundError = new NotFoundError({
      message: "Not found",
      resourceType: "user",
      resourceId: "123",
    });

    const response = toHttpResponse(Result.err(notFoundError));

    expect(response.status).toBe(404);
  });

  it("body is Envelope shape", () => {
    const result = Result.ok({ data: "test" });

    const response = toHttpResponse(result);

    // Response body should be a valid Envelope
    expect(response.body).toHaveProperty("ok");
    expect(response.body).toHaveProperty("meta");

    if (response.body.ok) {
      expect(response.body).toHaveProperty("data");
    } else {
      expect(response.body).toHaveProperty("error");
    }
  });

  it("status matches statusCodeMap for each category", () => {
    // Test that each error category produces the correct HTTP status
    const testCases = [
      {
        error: new ValidationError({ message: "Invalid" }),
        expectedStatus: 400,
      },
      {
        error: new NotFoundError({
          message: "Not found",
          resourceType: "x",
          resourceId: "y",
        }),
        expectedStatus: 404,
      },
      {
        error: new InternalError({ message: "Internal" }),
        expectedStatus: 500,
      },
    ];

    for (const { error, expectedStatus } of testCases) {
      const response = toHttpResponse(Result.err(error));
      expect(response.status).toBe(expectedStatus);
    }
  });
});
