/**
 * Tests for ErrorCategory enrichment: JSON-RPC codes, retryable flags,
 * and the unified errorCategoryMeta() helper.
 *
 * Tests cover:
 * - jsonRpcCodeMap (5 tests)
 * - retryableMap (5 tests)
 * - errorCategoryMeta() (6 tests)
 *
 * Total: 16 tests
 */
import { describe, expect, it } from "bun:test";

import {
  type ErrorCategory,
  errorCategoryMeta,
  exitCodeMap,
  jsonRpcCodeMap,
  retryableMap,
  statusCodeMap,
} from "../errors.js";

// All 10 categories for exhaustive testing
const ALL_CATEGORIES: ErrorCategory[] = [
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

// ============================================================================
// jsonRpcCodeMap Tests
// ============================================================================

describe("jsonRpcCodeMap", () => {
  it("maps all 10 ErrorCategory values to JSON-RPC codes", () => {
    expect(Object.keys(jsonRpcCodeMap)).toHaveLength(10);
    for (const category of ALL_CATEGORIES) {
      expect(jsonRpcCodeMap[category]).toBeDefined();
      expect(typeof jsonRpcCodeMap[category]).toBe("number");
    }
  });

  it("uses standard JSON-RPC protocol codes for direct mappings", () => {
    // validation → -32602 (Invalid params)
    expect(jsonRpcCodeMap.validation).toBe(-32_602);
    // internal → -32603 (Internal error)
    expect(jsonRpcCodeMap.internal).toBe(-32_603);
  });

  it("uses implementation-defined server code for not_found", () => {
    expect(jsonRpcCodeMap.not_found).toBe(-32_007);
  });

  it("uses custom server error codes (-32000 to -32099) for domain categories", () => {
    // Domain-specific categories use the implementation-defined range
    const domainCategories: ErrorCategory[] = [
      "auth",
      "not_found",
      "timeout",
      "conflict",
      "permission",
      "rate_limit",
      "network",
      "cancelled",
    ];
    for (const category of domainCategories) {
      const code = jsonRpcCodeMap[category];
      expect(code).toBeGreaterThanOrEqual(-32_099);
      expect(code).toBeLessThanOrEqual(-32_000);
    }
  });

  it("has unique JSON-RPC codes for each category", () => {
    const codes = Object.values(jsonRpcCodeMap);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("all codes are negative integers (JSON-RPC convention)", () => {
    for (const [_category, code] of Object.entries(jsonRpcCodeMap)) {
      expect(code).toBeLessThan(0);
      expect(Number.isInteger(code)).toBe(true);
    }
  });
});

// ============================================================================
// retryableMap Tests
// ============================================================================

describe("retryableMap", () => {
  it("maps all 10 ErrorCategory values to boolean retryable flag", () => {
    expect(Object.keys(retryableMap)).toHaveLength(10);
    for (const category of ALL_CATEGORIES) {
      expect(retryableMap[category]).toBeDefined();
      expect(typeof retryableMap[category]).toBe("boolean");
    }
  });

  it("marks transient errors as retryable", () => {
    // These are transient — may succeed on retry
    expect(retryableMap.timeout).toBe(true);
    expect(retryableMap.rate_limit).toBe(true);
    expect(retryableMap.network).toBe(true);
  });

  it("marks permanent errors as not retryable", () => {
    // These won't change on retry without human intervention
    expect(retryableMap.validation).toBe(false);
    expect(retryableMap.not_found).toBe(false);
    expect(retryableMap.permission).toBe(false);
    expect(retryableMap.internal).toBe(false);
    expect(retryableMap.auth).toBe(false);
    expect(retryableMap.cancelled).toBe(false);
  });

  it("marks conflict as not retryable (needs resolution)", () => {
    // Conflicts require explicit user resolution, not blind retry
    expect(retryableMap.conflict).toBe(false);
  });

  it("exactly 3 categories are retryable", () => {
    const retryableCount = Object.values(retryableMap).filter(Boolean).length;
    expect(retryableCount).toBe(3);
  });
});

// ============================================================================
// errorCategoryMeta() Tests
// ============================================================================

describe("errorCategoryMeta()", () => {
  it("returns object with all 4 fields for any category", () => {
    for (const category of ALL_CATEGORIES) {
      const meta = errorCategoryMeta(category);
      expect(meta).toHaveProperty("exitCode");
      expect(meta).toHaveProperty("statusCode");
      expect(meta).toHaveProperty("jsonRpcCode");
      expect(meta).toHaveProperty("retryable");
    }
  });

  it("returns correct meta for validation category", () => {
    const meta = errorCategoryMeta("validation");
    expect(meta).toEqual({
      exitCode: 1,
      statusCode: 400,
      jsonRpcCode: -32_602,
      retryable: false,
    });
  });

  it("returns correct meta for timeout category (retryable)", () => {
    const meta = errorCategoryMeta("timeout");
    expect(meta).toEqual({
      exitCode: 5,
      statusCode: 504,
      jsonRpcCode: jsonRpcCodeMap.timeout,
      retryable: true,
    });
  });

  it("returns correct meta for cancelled category", () => {
    const meta = errorCategoryMeta("cancelled");
    expect(meta).toEqual({
      exitCode: 130,
      statusCode: 499,
      jsonRpcCode: jsonRpcCodeMap.cancelled,
      retryable: false,
    });
  });

  it("meta values match individual maps for every category", () => {
    for (const category of ALL_CATEGORIES) {
      const meta = errorCategoryMeta(category);
      expect(meta.exitCode).toBe(exitCodeMap[category]);
      expect(meta.statusCode).toBe(statusCodeMap[category]);
      expect(meta.jsonRpcCode).toBe(jsonRpcCodeMap[category]);
      expect(meta.retryable).toBe(retryableMap[category]);
    }
  });

  it("returns consistent values on repeated calls", () => {
    const first = errorCategoryMeta("internal");
    const second = errorCategoryMeta("internal");
    expect(first).toEqual(second);
  });
});

// ============================================================================
// Existing maps unchanged
// ============================================================================

describe("existing maps unchanged", () => {
  it("exitCodeMap is unchanged", () => {
    expect(exitCodeMap).toEqual({
      validation: 1,
      not_found: 2,
      conflict: 3,
      permission: 4,
      timeout: 5,
      rate_limit: 6,
      network: 7,
      internal: 8,
      auth: 9,
      cancelled: 130,
    });
  });

  it("statusCodeMap is unchanged", () => {
    expect(statusCodeMap).toEqual({
      validation: 400,
      not_found: 404,
      conflict: 409,
      permission: 403,
      timeout: 504,
      rate_limit: 429,
      network: 502,
      internal: 500,
      auth: 401,
      cancelled: 499,
    });
  });
});
