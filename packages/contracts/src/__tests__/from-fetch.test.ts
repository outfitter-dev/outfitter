import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import type { ErrorCategory, OutfitterError } from "../errors.js";
import { RateLimitError } from "../errors.js";
import { fromFetch } from "../from-fetch.js";

/**
 * Helper to create a minimal Response with a given status and statusText.
 */
function makeResponse(status: number, statusText?: string): Response {
  return new Response(null, { status, statusText: statusText ?? "" });
}

describe("fromFetch", () => {
  describe("2xx status codes return Ok with the Response", () => {
    test("200 OK", () => {
      const response = makeResponse(200, "OK");
      const result = fromFetch(response);
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(response);
    });

    test("201 Created", () => {
      const response = makeResponse(201, "Created");
      const result = fromFetch(response);
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(response);
    });

    test("204 No Content", () => {
      const response = makeResponse(204, "No Content");
      const result = fromFetch(response);
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(response);
    });

    test("299 edge case", () => {
      const response = makeResponse(299);
      const result = fromFetch(response);
      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(response);
    });
  });

  describe("maps specific HTTP status codes to error categories", () => {
    const specificMappings: Array<[number, ErrorCategory]> = [
      [401, "auth"],
      [403, "permission"],
      [404, "not_found"],
      [408, "timeout"],
      [409, "conflict"],
      [429, "rate_limit"],
      [502, "network"],
      [503, "network"],
      [504, "timeout"],
    ];

    for (const [status, expectedCategory] of specificMappings) {
      test(`${status} -> ${expectedCategory}`, () => {
        const response = makeResponse(status);
        const result = fromFetch(response);
        expect(result.isErr()).toBe(true);
        const error = result.error as OutfitterError;
        expect(error.category).toBe(expectedCategory);
      });
    }
  });

  describe("rate limit metadata", () => {
    test("maps Retry-After header (delta-seconds) into retryAfterSeconds", () => {
      const response = new Response(null, {
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          "Retry-After": "120",
        },
      });

      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(RateLimitError);
      expect((result.error as RateLimitError).retryAfterSeconds).toBe(120);
    });

    test("ignores invalid Retry-After header values", () => {
      const response = new Response(null, {
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          "Retry-After": "definitely-not-a-number",
        },
      });

      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(RateLimitError);
      expect(
        (result.error as RateLimitError).retryAfterSeconds
      ).toBeUndefined();
    });
  });

  describe("error messages include HTTP status information", () => {
    test("includes status code in error message", () => {
      const response = makeResponse(404, "Not Found");
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.message).toContain("404");
    });

    test("includes status text in error message", () => {
      const response = makeResponse(404, "Not Found");
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.message).toContain("Not Found");
    });
  });

  describe("fallback 5xx -> internal", () => {
    test("500 Internal Server Error", () => {
      const response = makeResponse(500, "Internal Server Error");
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.category).toBe("internal");
    });

    test("501 Not Implemented", () => {
      const response = makeResponse(501, "Not Implemented");
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.category).toBe("internal");
    });

    test("599 unknown 5xx", () => {
      const response = makeResponse(599);
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.category).toBe("internal");
    });
  });

  describe("fallback 4xx -> validation", () => {
    test("400 Bad Request", () => {
      const response = makeResponse(400, "Bad Request");
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.category).toBe("validation");
    });

    test("422 Unprocessable Entity", () => {
      const response = makeResponse(422, "Unprocessable Entity");
      const result = fromFetch(response);
      expect(result.isErr()).toBe(true);
      const error = result.error as OutfitterError;
      expect(error.category).toBe("validation");
    });
  });

  describe("edge cases", () => {
    test("returns Err for 3xx status codes", () => {
      const response = makeResponse(301, "Moved Permanently");
      const result = fromFetch(response);
      // 3xx are not 2xx success — should be Err
      expect(result.isErr()).toBe(true);
    });

    test("returns correct type narrowing on Ok path", () => {
      const response = makeResponse(200);
      const result = fromFetch(response);
      if (result.isOk()) {
        // Type should be Response
        const _r: Response = result.value;
        expect(_r).toBeInstanceOf(Response);
      } else {
        throw new Error("Expected Ok");
      }
    });
  });
});
