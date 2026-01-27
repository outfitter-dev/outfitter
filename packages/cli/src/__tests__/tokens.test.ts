/**
 * Tests for createTokens() semantic token layer
 *
 * TDD RED PHASE: These tests define expected behavior for the semantic token layer.
 *
 * Tests cover:
 * - Token structure (2 tests)
 * - NO_COLOR environment handling (2 tests)
 * - FORCE_COLOR environment handling (2 tests)
 * - TokenOptions (2 tests)
 * - Integration with createTheme() (1 test)
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTheme, createTokens } from "../render/index.js";

// ============================================================================
// Test Helpers
// ============================================================================

/** Save original environment state for restoration */
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = { ...process.env };
  // Clear color-related env vars for clean tests
  delete process.env.NO_COLOR;
  delete process.env.FORCE_COLOR;
});

afterEach(() => {
  // Restore environment
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

// ============================================================================
// Token Structure Tests
// ============================================================================

describe("createTokens()", () => {
  describe("token structure", () => {
    it("returns object with all 8 token properties", () => {
      const tokens = createTokens({ forceColor: true });

      // Semantic colors
      expect(tokens.success).toBeDefined();
      expect(tokens.warning).toBeDefined();
      expect(tokens.error).toBeDefined();
      expect(tokens.info).toBeDefined();

      // Text colors
      expect(tokens.muted).toBeDefined();
      expect(tokens.accent).toBeDefined();
      expect(tokens.primary).toBeDefined();
      expect(tokens.secondary).toBeDefined();
    });

    it("each token is a string (ANSI code or empty)", () => {
      const tokens = createTokens({ forceColor: true });

      // All tokens should be strings
      expect(typeof tokens.success).toBe("string");
      expect(typeof tokens.warning).toBe("string");
      expect(typeof tokens.error).toBe("string");
      expect(typeof tokens.info).toBe("string");
      expect(typeof tokens.muted).toBe("string");
      expect(typeof tokens.accent).toBe("string");
      expect(typeof tokens.primary).toBe("string");
      expect(typeof tokens.secondary).toBe("string");

      // When colors are enabled, semantic tokens should have ANSI codes
      expect(tokens.success).toContain("\x1b[");
      expect(tokens.warning).toContain("\x1b[");
      expect(tokens.error).toContain("\x1b[");
      expect(tokens.info).toContain("\x1b[");
    });
  });

  // ============================================================================
  // NO_COLOR Environment Handling
  // ============================================================================

  describe("NO_COLOR environment handling", () => {
    it("with NO_COLOR=1 env, all tokens are empty strings", () => {
      process.env.NO_COLOR = "1";

      const tokens = createTokens();

      expect(tokens.success).toBe("");
      expect(tokens.warning).toBe("");
      expect(tokens.error).toBe("");
      expect(tokens.info).toBe("");
      expect(tokens.muted).toBe("");
      expect(tokens.accent).toBe("");
      expect(tokens.primary).toBe("");
      expect(tokens.secondary).toBe("");
    });

    it("with FORCE_COLOR=1 env, tokens have ANSI codes even with NO_COLOR", () => {
      process.env.NO_COLOR = "1";
      process.env.FORCE_COLOR = "1";

      const tokens = createTokens();

      // FORCE_COLOR should take precedence over NO_COLOR
      expect(tokens.success).toContain("\x1b[");
      expect(tokens.error).toContain("\x1b[");
    });
  });

  // ============================================================================
  // TokenOptions Tests
  // ============================================================================

  describe("TokenOptions", () => {
    it("forceColor option overrides environment", () => {
      process.env.NO_COLOR = "1";

      const tokens = createTokens({ forceColor: true });

      // forceColor should override NO_COLOR
      expect(tokens.success).toContain("\x1b[");
      expect(tokens.error).toContain("\x1b[");
    });

    it("colorLevel: 0 returns empty strings", () => {
      const tokens = createTokens({ colorLevel: 0 });

      expect(tokens.success).toBe("");
      expect(tokens.warning).toBe("");
      expect(tokens.error).toBe("");
      expect(tokens.info).toBe("");
      expect(tokens.muted).toBe("");
      expect(tokens.accent).toBe("");
      expect(tokens.primary).toBe("");
      expect(tokens.secondary).toBe("");
    });

    it("colorLevel: 1 returns basic ANSI codes", () => {
      const tokens = createTokens({ colorLevel: 1 });

      // Basic ANSI should have color codes
      expect(tokens.success).toContain("\x1b[");
      expect(tokens.error).toContain("\x1b[");
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("integration", () => {
    it("tokens integrate with createTheme() semantics", () => {
      const tokens = createTokens({ forceColor: true });
      // Verify createTheme exists and tokens use compatible semantics
      const _theme = createTheme();

      // Tokens should use the same color semantics as theme
      // success = green, error = red, warning = yellow, info = blue
      expect(tokens.success).toContain("32"); // ANSI green
      expect(tokens.error).toContain("31"); // ANSI red
      expect(tokens.warning).toContain("33"); // ANSI yellow
      expect(tokens.info).toContain("34"); // ANSI blue
    });

    it("tokens can be used in template strings", () => {
      const tokens = createTokens({ forceColor: true });
      const reset = "\x1b[0m";

      const message = `${tokens.success}Operation completed${reset}`;

      expect(message).toContain("\x1b[32m"); // Green start
      expect(message).toContain("Operation completed");
      expect(message).toContain(reset);
    });
  });
});
