/**
 * Tests for color tokens and theme utilities
 *
 * Tests cover:
 * - createTheme() (3 tests)
 * - New semantic colors (2 tests)
 * - Utility methods (2 tests)
 * - applyColor() (1 test)
 * - createTokens() (2 tests)
 * - color environment handling (2 tests)
 *
 * Total: 12 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  ANSI,
  applyColor,
  createTheme,
  createTokens,
} from "../colors/index.js";
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

  // ============================================================================
  // New Semantic Colors Tests (2 tests)
  // ============================================================================

  describe("new semantic colors", () => {
    it("has extended semantic colors (accent, highlight, link, destructive, subtle)", () => {
      const theme = createTheme();

      // New semantic colors
      expect(theme.accent).toBeDefined();
      expect(theme.highlight).toBeDefined();
      expect(theme.link).toBeDefined();
      expect(theme.destructive).toBeDefined();
      expect(theme.subtle).toBeDefined();

      // Each should return a string with text preserved
      const accentText = theme.accent("interactive");
      const highlightText = theme.highlight("important");
      const linkText = theme.link("https://example.com");
      const destructiveText = theme.destructive("delete");
      const subtleText = theme.subtle("timestamp");

      expect(accentText).toContain("interactive");
      expect(highlightText).toContain("important");
      expect(linkText).toContain("https://example.com");
      expect(destructiveText).toContain("delete");
      expect(subtleText).toContain("timestamp");
    });

    it("new semantic colors respect NO_COLOR", () => {
      process.env.NO_COLOR = "1";
      const theme = createTheme();

      // With NO_COLOR, all colors should be plain text
      expect(theme.accent("text")).toBe("text");
      expect(theme.highlight("text")).toBe("text");
      expect(theme.link("text")).toBe("text");
      expect(theme.destructive("text")).toBe("text");
      expect(theme.subtle("text")).toBe("text");
    });
  });

  // ============================================================================
  // Utility Methods Tests (2 tests)
  // ============================================================================

  describe("utility methods", () => {
    it("has utility methods (bold, italic, underline, dim, inverse)", () => {
      const theme = createTheme();

      // Utility methods
      expect(theme.bold).toBeDefined();
      expect(theme.italic).toBeDefined();
      expect(theme.underline).toBeDefined();
      expect(theme.dim).toBeDefined();
      expect(theme.inverse).toBeDefined();

      // Each should return a string with text preserved
      const boldText = theme.bold("strong");
      const italicText = theme.italic("emphasis");
      const underlineText = theme.underline("underlined");
      const dimText = theme.dim("faded");
      const inverseText = theme.inverse("inverted");

      expect(boldText).toContain("strong");
      expect(italicText).toContain("emphasis");
      expect(underlineText).toContain("underlined");
      expect(dimText).toContain("faded");
      expect(inverseText).toContain("inverted");
    });

    it("utility methods compose with semantic colors", () => {
      const theme = createTheme();

      // Should be able to compose utilities with semantic colors
      const composed = theme.bold(theme.accent("text"));
      expect(composed).toContain("text");
    });
  });

  // ============================================================================
  // createTokens() Tests (2 tests)
  // ============================================================================

  describe("createTokens()", () => {
    it("creates tokens with new semantic colors", () => {
      const tokens = createTokens({ forceColor: true });

      // New tokens should be defined
      expect(tokens.accent).toBeDefined();
      expect(tokens.highlight).toBeDefined();
      expect(tokens.link).toBeDefined();
      expect(tokens.destructive).toBeDefined();
      expect(tokens.subtle).toBeDefined();

      // Utility tokens
      expect(tokens.bold).toBeDefined();
      expect(tokens.italic).toBeDefined();
      expect(tokens.underline).toBeDefined();
      expect(tokens.dim).toBeDefined();
    });

    it("tokens are empty strings when colors disabled", () => {
      const tokens = createTokens({ colorLevel: 0 });

      // All tokens should be empty
      expect(tokens.accent).toBe("");
      expect(tokens.highlight).toBe("");
      expect(tokens.link).toBe("");
      expect(tokens.destructive).toBe("");
      expect(tokens.subtle).toBe("");
      expect(tokens.bold).toBe("");
      expect(tokens.italic).toBe("");
      expect(tokens.underline).toBe("");
      expect(tokens.dim).toBe("");
      expect(tokens.inverse).toBe("");
    });
  });

  // ============================================================================
  // ANSI Constants Tests (1 test)
  // ============================================================================

  describe("ANSI constants", () => {
    it("includes new ANSI codes for extended colors", () => {
      // New ANSI codes should be defined
      expect(ANSI.underline).toBe("\x1b[4m");
      expect(ANSI.brightCyan).toBe("\x1b[96m");
      expect(ANSI.brightRed).toBe("\x1b[91m");
      expect(ANSI.brightYellow).toBe("\x1b[93m");
      expect(ANSI.brightGreen).toBe("\x1b[92m");
      expect(ANSI.brightBlue).toBe("\x1b[94m");
      expect(ANSI.inverse).toBe("\x1b[7m");
    });
  });
});
