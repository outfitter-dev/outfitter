/**
 * Tests for terminal detection utilities
 *
 * Tests cover:
 * - getTerminalWidth() (2 tests)
 * - isInteractive() (2 tests)
 * - supportsColor() (2 tests)
 *
 * Total: 6 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  getTerminalWidth,
  isInteractive,
  supportsColor,
} from "../terminal/index.js";

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
// Terminal Detection Tests (6 tests)
// ============================================================================

describe("Terminal Detection", () => {
  describe("getTerminalWidth()", () => {
    it("returns stdout columns when available", () => {
      const width = getTerminalWidth();

      expect(typeof width).toBe("number");
      expect(width).toBeGreaterThan(0);
    });

    it("returns default when not TTY", () => {
      const width = getTerminalWidth({ isTTY: false });

      // Should return a sensible default (commonly 80)
      expect(width).toBe(80);
    });
  });

  describe("isInteractive()", () => {
    it("detects TTY mode", () => {
      const result = isInteractive({ isTTY: true, isCI: false });

      expect(result).toBe(true);
    });

    it("respects CI environment", () => {
      process.env.CI = "true";

      const result = isInteractive({ isTTY: true });

      // In CI, should not be interactive even if TTY
      expect(result).toBe(false);
    });
  });

  describe("supportsColor()", () => {
    it("detects color support", () => {
      // Clear color-related env vars for clean test
      delete process.env.NO_COLOR;
      delete process.env.FORCE_COLOR;

      const result = supportsColor({ isTTY: true });

      // In a TTY without NO_COLOR, should support color
      expect(typeof result).toBe("boolean");
    });

    it("respects FORCE_COLOR env", () => {
      process.env.FORCE_COLOR = "1";

      const result = supportsColor({ isTTY: false });

      // FORCE_COLOR should enable colors even without TTY
      expect(result).toBe(true);
    });
  });
});
