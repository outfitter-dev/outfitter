/**
 * Tests for layout render utilities
 *
 * Tests cover:
 * - joinHorizontal (6 tests)
 * - joinVertical (4 tests)
 * - getTerminalWidth (2 tests)
 * - getContentWidth (6 tests)
 * - getBoxOverhead (4 tests)
 *
 * Total: 22 tests
 */
import { describe, expect, it } from "bun:test";
import {
  getBoxOverhead,
  getContentWidth,
  getTerminalWidth,
  joinHorizontal,
  joinVertical,
} from "../render/layout.js";

// ============================================================================
// joinHorizontal Tests
// ============================================================================

describe("joinHorizontal", () => {
  describe("basic functionality", () => {
    it("joins two single-line blocks side by side", () => {
      const result = joinHorizontal(["Left", "Right"]);
      expect(result).toBe("LeftRight");
    });

    it("joins multiline blocks side by side", () => {
      const left = "A\nB";
      const right = "1\n2";
      const result = joinHorizontal([left, right]);
      expect(result).toBe("A1\nB2");
    });

    it("handles blocks of different heights (top alignment)", () => {
      const short = "A";
      const tall = "1\n2\n3";
      const result = joinHorizontal([short, tall], { align: "top" });
      expect(result).toBe("A1\n 2\n 3");
    });
  });

  describe("gap option", () => {
    it("adds gap between blocks", () => {
      const result = joinHorizontal(["Left", "Right"], { gap: 2 });
      expect(result).toBe("Left  Right");
    });

    it("adds gap between multiline blocks", () => {
      const left = "A\nB";
      const right = "1\n2";
      const result = joinHorizontal([left, right], { gap: 2 });
      expect(result).toBe("A  1\nB  2");
    });
  });

  describe("alignment options", () => {
    it("aligns blocks to center", () => {
      const short = "A";
      const tall = "1\n2\n3";
      const result = joinHorizontal([short, tall], { align: "center" });
      expect(result).toBe(" 1\nA2\n 3");
    });

    it("aligns blocks to bottom", () => {
      const short = "A";
      const tall = "1\n2\n3";
      const result = joinHorizontal([short, tall], { align: "bottom" });
      expect(result).toBe(" 1\n 2\nA3");
    });
  });

  describe("edge cases", () => {
    it("handles empty array", () => {
      const result = joinHorizontal([]);
      expect(result).toBe("");
    });

    it("handles single block", () => {
      const result = joinHorizontal(["Only"]);
      expect(result).toBe("Only");
    });
  });
});

// ============================================================================
// joinVertical Tests
// ============================================================================

describe("joinVertical", () => {
  describe("basic functionality", () => {
    it("stacks blocks vertically", () => {
      const result = joinVertical(["Top", "Bottom"]);
      expect(result).toBe("Top\nBottom");
    });

    it("stacks multiline blocks", () => {
      const first = "A\nB";
      const second = "1\n2";
      const result = joinVertical([first, second]);
      expect(result).toBe("A\nB\n1\n2");
    });
  });

  describe("gap option", () => {
    it("adds gap between blocks", () => {
      const result = joinVertical(["Top", "Bottom"], { gap: 1 });
      expect(result).toBe("Top\n\nBottom");
    });

    it("adds larger gap between blocks", () => {
      const result = joinVertical(["Top", "Bottom"], { gap: 2 });
      expect(result).toBe("Top\n\n\nBottom");
    });
  });

  describe("edge cases", () => {
    it("handles empty array", () => {
      const result = joinVertical([]);
      expect(result).toBe("");
    });

    it("handles single block", () => {
      const result = joinVertical(["Only"]);
      expect(result).toBe("Only");
    });
  });
});

// ============================================================================
// getTerminalWidth Tests (2 tests)
// ============================================================================

describe("getTerminalWidth", () => {
  it("returns a positive number", () => {
    const result = getTerminalWidth();
    expect(result).toBeGreaterThan(0);
  });

  it("returns at least 80 (fallback or actual terminal)", () => {
    // In test environment, should be at least the fallback of 80
    // or the actual terminal width if running in a terminal
    const result = getTerminalWidth();
    expect(result).toBeGreaterThanOrEqual(80);
  });
});

// ============================================================================
// getContentWidth Tests (6 tests)
// ============================================================================

describe("getContentWidth", () => {
  describe("with fixed width", () => {
    it("subtracts border and padding overhead from fixed width", () => {
      // width: 40, default padding: 1 (horizontal only), default borders: all sides
      // Expected: 40 - 2 (borders) - 2 (padding) = 36
      const result = getContentWidth({ width: 40 });
      expect(result).toBe(36);
    });

    it("handles asymmetric padding", () => {
      // width: 50, padding: { left: 2, right: 3 }, default borders: all sides
      // Expected: 50 - 2 (borders) - 5 (padding) = 43
      const result = getContentWidth({
        width: 50,
        padding: { left: 2, right: 3 },
      });
      expect(result).toBe(43);
    });

    it("handles partial borders (no left/right)", () => {
      // width: 30, no side borders, default padding: 1
      // Expected: 30 - 0 (no left/right borders) - 2 (padding) = 28
      const result = getContentWidth({
        width: 30,
        borders: { top: true, bottom: true, left: false, right: false },
      });
      expect(result).toBe(28);
    });
  });

  describe("without fixed width", () => {
    it("uses terminal width minus overhead", () => {
      // No width specified, should use terminal width minus default overhead (4)
      const terminalWidth = getTerminalWidth();
      const result = getContentWidth({});
      expect(result).toBe(terminalWidth - 4);
    });
  });

  describe("edge cases", () => {
    it("handles no padding (padding: 0)", () => {
      // width: 20, padding: 0, default borders
      // Expected: 20 - 2 (borders) - 0 (no padding) = 18
      const result = getContentWidth({ width: 20, padding: 0 });
      expect(result).toBe(18);
    });

    it("clamps to zero for very small widths", () => {
      // width: 4, default padding: 1, borders: all
      // Would be 4 - 4 = 0, should not go negative
      const result = getContentWidth({ width: 4 });
      expect(result).toBe(0);
    });
  });
});

// ============================================================================
// getBoxOverhead Tests (4 tests)
// ============================================================================

describe("getBoxOverhead", () => {
  it("calculates horizontal overhead with default options", () => {
    // Default: borders all sides (2) + padding left/right (2) = 4
    const result = getBoxOverhead({});
    expect(result.horizontal).toBe(4);
  });

  it("calculates vertical overhead with default options", () => {
    // Default: borders top/bottom (2) + padding top/bottom (0) = 2
    const result = getBoxOverhead({});
    expect(result.vertical).toBe(2);
  });

  it("handles custom padding per side", () => {
    // padding: { top: 2, right: 3, bottom: 1, left: 2 }, default borders
    // horizontal: borders(2) + left(2) + right(3) = 7
    // vertical: borders(2) + top(2) + bottom(1) = 5
    const result = getBoxOverhead({
      padding: { top: 2, right: 3, bottom: 1, left: 2 },
    });
    expect(result.horizontal).toBe(7);
    expect(result.vertical).toBe(5);
  });

  it("handles partial borders", () => {
    // borders: only left and right, default padding
    // horizontal: 2 (borders) + 2 (padding) = 4
    // vertical: 0 (no top/bottom borders) + 0 (no vertical padding by default) = 0
    const result = getBoxOverhead({
      borders: { top: false, bottom: false, left: true, right: true },
    });
    expect(result.horizontal).toBe(4);
    expect(result.vertical).toBe(0);
  });
});
