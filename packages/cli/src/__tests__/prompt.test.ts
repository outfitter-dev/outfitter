/**
 * Tests for prompt utilities
 *
 * Tests cover:
 * - Validators (5 tests)
 * - Type exports (1 test)
 *
 * Total: 6 tests
 */
import { describe, expect, it } from "bun:test";
import { validators } from "../prompt/validators.js";

// ============================================================================
// Validator Tests
// ============================================================================

describe("validators", () => {
  describe("required()", () => {
    it("fails on empty string", () => {
      const validate = validators.required();
      const result = validate("");
      expect(result).toBe("Required");
    });

    it("passes on non-empty string", () => {
      const validate = validators.required();
      const result = validate("hello");
      expect(result).toBeUndefined();
    });

    it("uses custom error message", () => {
      const validate = validators.required("Please enter a value");
      const result = validate("");
      expect(result).toBe("Please enter a value");
    });
  });

  describe("minLength()", () => {
    it("fails when too short", () => {
      const validate = validators.minLength(5);
      const result = validate("abc");
      expect(result).toBe("Minimum 5 characters");
    });

    it("passes when long enough", () => {
      const validate = validators.minLength(5);
      const result = validate("hello");
      expect(result).toBeUndefined();
    });
  });

  describe("maxLength()", () => {
    it("fails when too long", () => {
      const validate = validators.maxLength(5);
      const result = validate("hello world");
      expect(result).toBe("Maximum 5 characters");
    });

    it("passes when short enough", () => {
      const validate = validators.maxLength(5);
      const result = validate("hi");
      expect(result).toBeUndefined();
    });
  });

  describe("pattern()", () => {
    it("fails when pattern does not match", () => {
      const validate = validators.pattern(/^\d+$/, "Numbers only");
      const result = validate("abc");
      expect(result).toBe("Numbers only");
    });

    it("passes when pattern matches", () => {
      const validate = validators.pattern(/^\d+$/, "Numbers only");
      const result = validate("123");
      expect(result).toBeUndefined();
    });
  });

  describe("email()", () => {
    it("fails on invalid email", () => {
      const validate = validators.email();
      const result = validate("not-an-email");
      expect(result).toBe("Invalid email");
    });

    it("passes on valid email", () => {
      const validate = validators.email();
      const result = validate("test@example.com");
      expect(result).toBeUndefined();
    });
  });

  describe("compose()", () => {
    it("runs validators in order and returns first error", () => {
      const validate = validators.compose(
        validators.required(),
        validators.minLength(5)
      );
      const result = validate("");
      expect(result).toBe("Required");
    });

    it("passes when all validators pass", () => {
      const validate = validators.compose(
        validators.required(),
        validators.minLength(3),
        validators.maxLength(10)
      );
      const result = validate("hello");
      expect(result).toBeUndefined();
    });
  });
});
