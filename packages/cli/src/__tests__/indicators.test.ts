/**
 * Tests for indicator primitives
 *
 * Tests cover:
 * - INDICATORS constant structure
 * - getIndicator function
 * - isUnicodeSupported function
 */
import { describe, expect, it } from "bun:test";
import {
  getIndicator,
  getProgressIndicator,
  INDICATORS,
  type IndicatorCategory,
  isUnicodeSupported,
} from "../render/indicators.js";

// ============================================================================
// INDICATORS Constant Tests
// ============================================================================

describe("INDICATORS", () => {
  it("exports all expected categories", () => {
    expect(INDICATORS).toHaveProperty("status");
    expect(INDICATORS).toHaveProperty("marker");
    expect(INDICATORS).toHaveProperty("progress");
    expect(INDICATORS).toHaveProperty("triangle");
    expect(INDICATORS).toHaveProperty("special");
    expect(INDICATORS).toHaveProperty("directional");
    expect(INDICATORS).toHaveProperty("math");
  });

  it("each indicator has unicode, fallback, and optional color", () => {
    const categories: IndicatorCategory[] = [
      "status",
      "marker",
      "progress",
      "triangle",
      "special",
      "directional",
      "math",
    ];

    for (const category of categories) {
      const indicators = INDICATORS[category];
      for (const [_name, indicator] of Object.entries(indicators)) {
        expect(indicator).toHaveProperty("unicode");
        expect(indicator).toHaveProperty("fallback");
        expect(typeof indicator.unicode).toBe("string");
        expect(typeof indicator.fallback).toBe("string");
        // color is optional
        if (indicator.color !== undefined) {
          expect(typeof indicator.color).toBe("string");
        }
      }
    }
  });
});

// ============================================================================
// getIndicator Function Tests
// ============================================================================

describe("getIndicator()", () => {
  it("returns unicode when supported", () => {
    const result = getIndicator("status", "success", true);
    expect(result).toBe("✔");
  });

  it("returns fallback when unicode not supported", () => {
    const result = getIndicator("status", "success", false);
    expect(result).toBe("[ok]");
  });

  it("returns all status indicators correctly", () => {
    expect(getIndicator("status", "success", true)).toBe("✔");
    expect(getIndicator("status", "error", true)).toBe("✖");
    expect(getIndicator("status", "warning", true)).toBe("⚠");
    expect(getIndicator("status", "info", true)).toBe("ℹ");
  });
});

// ============================================================================
// isUnicodeSupported Function Tests
// ============================================================================

describe("isUnicodeSupported()", () => {
  it("returns a boolean", () => {
    const result = isUnicodeSupported();
    expect(typeof result).toBe("boolean");
  });
});

// ============================================================================
// Specific Indicator Category Tests
// ============================================================================

describe("indicator categories", () => {
  it("status category has all expected indicators", () => {
    const statusIndicators = INDICATORS.status;
    expect(statusIndicators).toHaveProperty("success");
    expect(statusIndicators).toHaveProperty("error");
    expect(statusIndicators).toHaveProperty("warning");
    expect(statusIndicators).toHaveProperty("info");
  });

  it("marker category has circle variants", () => {
    const markerIndicators = INDICATORS.marker;
    expect(markerIndicators).toHaveProperty("circle");
    expect(markerIndicators).toHaveProperty("circleOutline");
    expect(markerIndicators).toHaveProperty("circleDotted");
    expect(markerIndicators).toHaveProperty("circleSmall");
    expect(markerIndicators).toHaveProperty("circleDot");
    expect(markerIndicators).toHaveProperty("circleDotOutline");
  });

  it("marker category has square variants", () => {
    const markerIndicators = INDICATORS.marker;
    expect(markerIndicators).toHaveProperty("square");
    expect(markerIndicators).toHaveProperty("squareOutline");
    expect(markerIndicators).toHaveProperty("squareSmall");
    expect(markerIndicators).toHaveProperty("squareSmallOutline");
  });

  it("marker category has lozenge variants", () => {
    const markerIndicators = INDICATORS.marker;
    expect(markerIndicators).toHaveProperty("lozenge");
    expect(markerIndicators).toHaveProperty("lozengeOutline");
  });

  it("marker category has lines and pointers", () => {
    const markerIndicators = INDICATORS.marker;
    expect(markerIndicators).toHaveProperty("dash");
    expect(markerIndicators).toHaveProperty("pointer");
    expect(markerIndicators).toHaveProperty("pointerSmall");
  });

  it("marker category has checkboxes", () => {
    const markerIndicators = INDICATORS.marker;
    expect(markerIndicators).toHaveProperty("checkbox");
    expect(markerIndicators).toHaveProperty("checkboxChecked");
    expect(markerIndicators).toHaveProperty("checkboxCross");
  });

  it("progress category has circle indicators", () => {
    const progressIndicators = INDICATORS.progress;
    expect(progressIndicators).toHaveProperty("circleEmpty");
    expect(progressIndicators).toHaveProperty("circleQuarter");
    expect(progressIndicators).toHaveProperty("circleHalf");
    expect(progressIndicators).toHaveProperty("circleThree");
    expect(progressIndicators).toHaveProperty("circleFull");
  });

  it("progress category has vertical block indicators", () => {
    const progressIndicators = INDICATORS.progress;
    expect(progressIndicators).toHaveProperty("vertical1");
    expect(progressIndicators).toHaveProperty("vertical2");
    expect(progressIndicators).toHaveProperty("vertical3");
    expect(progressIndicators).toHaveProperty("vertical4");
    expect(progressIndicators).toHaveProperty("vertical5");
    expect(progressIndicators).toHaveProperty("vertical6");
    expect(progressIndicators).toHaveProperty("vertical7");
    expect(progressIndicators).toHaveProperty("verticalFull");
  });

  it("progress category has horizontal block indicators", () => {
    const progressIndicators = INDICATORS.progress;
    expect(progressIndicators).toHaveProperty("horizontal1");
    expect(progressIndicators).toHaveProperty("horizontal4");
    expect(progressIndicators).toHaveProperty("horizontalFull");
  });

  it("progress category has shade indicators", () => {
    const progressIndicators = INDICATORS.progress;
    expect(progressIndicators).toHaveProperty("shadeLight");
    expect(progressIndicators).toHaveProperty("shadeMedium");
    expect(progressIndicators).toHaveProperty("shadeDark");
  });

  it("triangle category has all expected indicators", () => {
    const triangleIndicators = INDICATORS.triangle;
    expect(triangleIndicators).toHaveProperty("up");
    expect(triangleIndicators).toHaveProperty("upSmall");
    expect(triangleIndicators).toHaveProperty("upOutline");
    expect(triangleIndicators).toHaveProperty("down");
    expect(triangleIndicators).toHaveProperty("downSmall");
    expect(triangleIndicators).toHaveProperty("downOutline");
    expect(triangleIndicators).toHaveProperty("left");
    expect(triangleIndicators).toHaveProperty("leftSmall");
    expect(triangleIndicators).toHaveProperty("leftOutline");
    expect(triangleIndicators).toHaveProperty("right");
    expect(triangleIndicators).toHaveProperty("rightSmall");
    expect(triangleIndicators).toHaveProperty("rightOutline");
  });

  it("marker indicators return correct unicode values", () => {
    expect(getIndicator("marker", "circle", true)).toBe("●");
    expect(getIndicator("marker", "circleOutline", true)).toBe("○");
    expect(getIndicator("marker", "circleDot", true)).toBe("◉");
    expect(getIndicator("marker", "lozenge", true)).toBe("◆");
  });

  it("special category has all expected indicators", () => {
    const specialIndicators = INDICATORS.special;
    expect(specialIndicators).toHaveProperty("star");
    expect(specialIndicators).toHaveProperty("starOutline");
    expect(specialIndicators).toHaveProperty("heart");
    expect(specialIndicators).toHaveProperty("heartOutline");
    expect(specialIndicators).toHaveProperty("flag");
    expect(specialIndicators).toHaveProperty("flagOutline");
    expect(specialIndicators).toHaveProperty("gear");
  });

  it("directional category has all expected indicators", () => {
    const directionalIndicators = INDICATORS.directional;
    expect(directionalIndicators).toHaveProperty("arrowUp");
    expect(directionalIndicators).toHaveProperty("arrowDown");
    expect(directionalIndicators).toHaveProperty("arrowLeft");
    expect(directionalIndicators).toHaveProperty("arrowRight");
    expect(directionalIndicators).toHaveProperty("arrowLeftRight");
    expect(directionalIndicators).toHaveProperty("arrowUpDown");
  });

  it("math category has all expected indicators", () => {
    const mathIndicators = INDICATORS.math;
    expect(mathIndicators).toHaveProperty("almostEqual");
    expect(mathIndicators).toHaveProperty("notEqual");
    expect(mathIndicators).toHaveProperty("lessOrEqual");
    expect(mathIndicators).toHaveProperty("greaterOrEqual");
    expect(mathIndicators).toHaveProperty("identical");
    expect(mathIndicators).toHaveProperty("infinity");
  });
});

// ============================================================================
// getProgressIndicator Function Tests
// ============================================================================

describe("getProgressIndicator()", () => {
  it("returns correct circle indicators at different percentages", () => {
    expect(getProgressIndicator("circle", 0, 100, true)).toBe("○"); // 0%
    expect(getProgressIndicator("circle", 25, 100, true)).toBe("◔"); // 25%
    expect(getProgressIndicator("circle", 50, 100, true)).toBe("◑"); // 50%
    expect(getProgressIndicator("circle", 75, 100, true)).toBe("◕"); // 75%
    expect(getProgressIndicator("circle", 100, 100, true)).toBe("●"); // 100%
  });

  it("returns correct vertical block indicators", () => {
    expect(getProgressIndicator("vertical", 0, 8, true)).toBe("▁"); // 0%
    expect(getProgressIndicator("vertical", 4, 8, true)).toBe("▅"); // 50% → step 5 of 8
    expect(getProgressIndicator("vertical", 8, 8, true)).toBe("█"); // 100%
  });

  it("returns correct horizontal block indicators", () => {
    expect(getProgressIndicator("horizontal", 0, 8, true)).toBe("▏"); // 0%
    expect(getProgressIndicator("horizontal", 4, 8, true)).toBe("▋"); // 50% → step 5 of 8
    expect(getProgressIndicator("horizontal", 8, 8, true)).toBe("█"); // 100%
  });

  it("returns correct shade indicators", () => {
    expect(getProgressIndicator("shade", 0, 100, true)).toBe("░"); // light
    expect(getProgressIndicator("shade", 50, 100, true)).toBe("▒"); // medium
    expect(getProgressIndicator("shade", 100, 100, true)).toBe("▓"); // dark
  });

  it("clamps values to valid range", () => {
    expect(getProgressIndicator("circle", -10, 100, true)).toBe("○"); // clamped to 0%
    expect(getProgressIndicator("circle", 200, 100, true)).toBe("●"); // clamped to 100%
  });

  it("handles edge case of max=0", () => {
    expect(getProgressIndicator("circle", 50, 0, true)).toBe("○"); // treat as 0%
  });
});
