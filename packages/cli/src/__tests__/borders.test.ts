/**
 * Tests for box-drawing border utilities
 *
 * Tests cover:
 * - Border character sets (5 tests)
 * - getBorderCharacters() (2 tests)
 * - drawHorizontalLine() (5 tests)
 *
 * Total: 12 tests
 */
import { describe, expect, it } from "bun:test";
import {
  BORDERS,
  type BorderCharacters,
  type BorderStyle,
  drawHorizontalLine,
  getBorderCharacters,
} from "../render/borders.js";

// ============================================================================
// Border Character Sets Tests
// ============================================================================

describe("Border Character Sets", () => {
  it("defines single border style with all characters", () => {
    const single = BORDERS.single;

    expect(single.topLeft).toBe("┌");
    expect(single.topRight).toBe("┐");
    expect(single.bottomLeft).toBe("└");
    expect(single.bottomRight).toBe("┘");
    expect(single.horizontal).toBe("─");
    expect(single.vertical).toBe("│");
    expect(single.topT).toBe("┬");
    expect(single.bottomT).toBe("┴");
    expect(single.leftT).toBe("├");
    expect(single.rightT).toBe("┤");
    expect(single.cross).toBe("┼");
  });

  it("defines double border style with all characters", () => {
    const double = BORDERS.double;

    expect(double.topLeft).toBe("╔");
    expect(double.topRight).toBe("╗");
    expect(double.bottomLeft).toBe("╚");
    expect(double.bottomRight).toBe("╝");
    expect(double.horizontal).toBe("═");
    expect(double.vertical).toBe("║");
    expect(double.topT).toBe("╦");
    expect(double.bottomT).toBe("╩");
    expect(double.leftT).toBe("╠");
    expect(double.rightT).toBe("╣");
    expect(double.cross).toBe("╬");
  });

  it("defines rounded border style with rounded corners", () => {
    const rounded = BORDERS.rounded;

    expect(rounded.topLeft).toBe("╭");
    expect(rounded.topRight).toBe("╮");
    expect(rounded.bottomLeft).toBe("╰");
    expect(rounded.bottomRight).toBe("╯");
    // Rounded uses single-line characters for edges
    expect(rounded.horizontal).toBe("─");
    expect(rounded.vertical).toBe("│");
  });

  it("defines heavy border style with thick characters", () => {
    const heavy = BORDERS.heavy;

    expect(heavy.topLeft).toBe("┏");
    expect(heavy.topRight).toBe("┓");
    expect(heavy.bottomLeft).toBe("┗");
    expect(heavy.bottomRight).toBe("┛");
    expect(heavy.horizontal).toBe("━");
    expect(heavy.vertical).toBe("┃");
    expect(heavy.topT).toBe("┳");
    expect(heavy.bottomT).toBe("┻");
    expect(heavy.leftT).toBe("┣");
    expect(heavy.rightT).toBe("┫");
    expect(heavy.cross).toBe("╋");
  });

  it("defines none border style with empty strings", () => {
    const none = BORDERS.none;

    expect(none.topLeft).toBe("");
    expect(none.topRight).toBe("");
    expect(none.bottomLeft).toBe("");
    expect(none.bottomRight).toBe("");
    expect(none.horizontal).toBe("");
    expect(none.vertical).toBe("");
    expect(none.topT).toBe("");
    expect(none.bottomT).toBe("");
    expect(none.leftT).toBe("");
    expect(none.rightT).toBe("");
    expect(none.cross).toBe("");
  });
});

// ============================================================================
// getBorderCharacters() Tests
// ============================================================================

describe("getBorderCharacters()", () => {
  it("returns correct character set for each style", () => {
    const styles: BorderStyle[] = [
      "single",
      "double",
      "rounded",
      "heavy",
      "none",
    ];

    for (const style of styles) {
      const chars = getBorderCharacters(style);
      expect(chars).toBe(BORDERS[style]);
    }
  });

  it("returns object with all required properties", () => {
    const chars = getBorderCharacters("single");

    // Verify all properties exist
    const requiredKeys: (keyof BorderCharacters)[] = [
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
      "horizontal",
      "vertical",
      "topT",
      "bottomT",
      "leftT",
      "rightT",
      "cross",
    ];

    for (const key of requiredKeys) {
      expect(chars[key]).toBeDefined();
      expect(typeof chars[key]).toBe("string");
    }
  });
});

// ============================================================================
// drawHorizontalLine() Tests
// ============================================================================

describe("drawHorizontalLine()", () => {
  it("draws top line without columns", () => {
    const chars = getBorderCharacters("single");
    const line = drawHorizontalLine(10, chars, "top");

    expect(line).toBe("┌──────────┐");
  });

  it("draws middle line without columns", () => {
    const chars = getBorderCharacters("single");
    const line = drawHorizontalLine(10, chars, "middle");

    expect(line).toBe("├──────────┤");
  });

  it("draws bottom line without columns", () => {
    const chars = getBorderCharacters("single");
    const line = drawHorizontalLine(10, chars, "bottom");

    expect(line).toBe("└──────────┘");
  });

  it("draws line with column intersections", () => {
    const chars = getBorderCharacters("single");
    // columnWidths [5, 7] = 12 + 1 intersection = 13 inner chars
    // width 14 means last column is padded to make 14 inner chars total
    const line = drawHorizontalLine(14, chars, "top", [5, 7]);

    // 5 dashes + T + 8 dashes (7+1 to reach width 14) = ┌─────┬────────┐
    expect(line).toBe("┌─────┬────────┐");
  });

  it("draws middle line with column intersections", () => {
    const chars = getBorderCharacters("single");
    // columnWidths [5, 7] = 12 + 1 intersection = 13 inner chars
    // width 14 means last column is padded to make 14 inner chars total
    const line = drawHorizontalLine(14, chars, "middle", [5, 7]);

    // 5 dashes + intersection + 8 dashes (7+1 to reach width 14) = ├─────┼────────┤
    expect(line).toBe("├─────┼────────┤");
  });

  it("handles zero width gracefully", () => {
    const chars = getBorderCharacters("single");
    const line = drawHorizontalLine(0, chars, "top");

    expect(line).toBe("┌┐");
  });

  it("handles single column width", () => {
    const chars = getBorderCharacters("single");
    const line = drawHorizontalLine(5, chars, "top", [5]);

    expect(line).toBe("┌─────┐");
  });

  it("works with different border styles", () => {
    const doubleChars = getBorderCharacters("double");
    const line = drawHorizontalLine(10, doubleChars, "top");

    expect(line).toBe("╔══════════╗");
  });

  it("returns empty for none style", () => {
    const noneChars = getBorderCharacters("none");
    const line = drawHorizontalLine(10, noneChars, "top");

    expect(line).toBe("");
  });
});
