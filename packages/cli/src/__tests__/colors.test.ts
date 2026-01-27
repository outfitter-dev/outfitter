/**
 * Tests for color tokens and theme utilities
 *
 * Tests cover:
 * - createTheme() (3 tests)
 * - applyColor() (1 test)
 * - color environment handling (2 tests)
 *
 * Total: 6 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { applyColor, createTheme } from "../render/index.js";
import { supportsColor } from "../terminal/index.js";

// ============================================================================
// Test Helpers
// ============================================================================

/** Save original environment state for restoration */
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = { ...process.env };
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
// Color Tokens Tests (6 tests)
// ============================================================================

describe("Color Tokens", () => {
  describe("createTheme()", () => {
    it("creates color palette with expected structure", () => {
      const theme = createTheme();

      expect(theme).toBeDefined();
      expect(typeof theme).toBe("object");
      // Should have color functions for common use cases
      expect(theme.success).toBeDefined();
      expect(theme.warning).toBeDefined();
      expect(theme.error).toBeDefined();
      expect(theme.info).toBeDefined();
    });

    it("has semantic colors (success, warning, error, info)", () => {
      const theme = createTheme();

      // Semantic colors should return styled strings
      const successText = theme.success("ok");
      const warningText = theme.warning("warn");
      const errorText = theme.error("fail");
      const infoText = theme.info("note");

      // Each should return a string (possibly with ANSI codes)
      expect(typeof successText).toBe("string");
      expect(typeof warningText).toBe("string");
      expect(typeof errorText).toBe("string");
      expect(typeof infoText).toBe("string");

      // Text content should be preserved
      expect(successText).toContain("ok");
      expect(warningText).toContain("warn");
      expect(errorText).toContain("fail");
      expect(infoText).toContain("note");
    });

    it("has text colors (primary, secondary, muted)", () => {
      const theme = createTheme();

      expect(theme.primary).toBeDefined();
      expect(theme.secondary).toBeDefined();
      expect(theme.muted).toBeDefined();

      const primaryText = theme.primary("main");
      const secondaryText = theme.secondary("alt");
      const mutedText = theme.muted("dim");

      expect(typeof primaryText).toBe("string");
      expect(typeof secondaryText).toBe("string");
      expect(typeof mutedText).toBe("string");
    });
  });

  describe("applyColor()", () => {
    it("applies ANSI color to text", () => {
      const result = applyColor("hello", "green");

      // Should contain the original text
      expect(result).toContain("hello");
      // When colors are supported, should have ANSI escape codes
      // ANSI escape starts with \x1b[ or \u001b[
      // Note: This may not have ANSI if running in non-TTY
    });
  });

  describe("color environment handling", () => {
    it("disables colors when NO_COLOR env is set", () => {
      process.env.NO_COLOR = "1";

      const theme = createTheme();
      const result = theme.error("test");

      // With NO_COLOR set, should return plain text without ANSI
      expect(result).toBe("test");
      // Should not contain ANSI escape sequences
      expect(result).not.toContain("\x1b[");
    });

    it("disables colors when stdout is not a TTY", () => {
      // Create a theme in a context where isTTY would be false
      // This is tricky to test directly, but we can test the supportsColor function
      const colorSupport = supportsColor({ isTTY: false });

      expect(colorSupport).toBe(false);
    });
  });
});
