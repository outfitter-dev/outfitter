/**
 * Tests for spinner animations
 *
 * Tests cover:
 * - Spinner presets (4 tests)
 * - Frame cycling (3 tests)
 * - Static rendering (2 tests)
 * - Message handling (2 tests)
 *
 * Total: 11 tests
 */
import { describe, expect, it } from "bun:test";
import {
  getSpinnerFrame,
  renderSpinner,
  SPINNERS,
  type SpinnerStyle,
} from "../render/index.js";

// ============================================================================
// Spinner Presets Tests (4 tests)
// ============================================================================

describe("SPINNERS", () => {
  it("has dots style with braille characters", () => {
    expect(SPINNERS.dots).toBeDefined();
    expect(SPINNERS.dots.frames.length).toBeGreaterThan(0);
    // Braille dots characters
    expect(SPINNERS.dots.frames[0]).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    expect(SPINNERS.dots.interval).toBeGreaterThan(0);
  });

  it("has line style with ASCII characters", () => {
    expect(SPINNERS.line).toBeDefined();
    expect(SPINNERS.line.frames).toEqual(["-", "\\", "|", "/"]);
    expect(SPINNERS.line.interval).toBeGreaterThan(0);
  });

  it("has arc style with arc characters", () => {
    expect(SPINNERS.arc).toBeDefined();
    expect(SPINNERS.arc.frames.length).toBeGreaterThan(0);
    // Arc characters
    expect(SPINNERS.arc.frames[0]).toMatch(/[◜◠◝◞◡◟]/);
    expect(SPINNERS.arc.interval).toBeGreaterThan(0);
  });

  it("has bounce style with braille characters", () => {
    expect(SPINNERS.bounce).toBeDefined();
    expect(SPINNERS.bounce.frames.length).toBeGreaterThan(0);
    expect(SPINNERS.bounce.interval).toBeGreaterThan(0);
  });
});

// ============================================================================
// Frame Cycling Tests (3 tests)
// ============================================================================

describe("getSpinnerFrame()", () => {
  it("returns first frame at elapsed 0", () => {
    const frame = getSpinnerFrame("dots", 0);
    expect(frame).toBe(SPINNERS.dots.frames[0]);
  });

  it("cycles through frames based on elapsed time", () => {
    const style: SpinnerStyle = "line";
    const interval = SPINNERS.line.interval;

    // At interval * 0, should be frame 0
    expect(getSpinnerFrame(style, 0)).toBe("-");
    // At interval * 1, should be frame 1
    expect(getSpinnerFrame(style, interval)).toBe("\\");
    // At interval * 2, should be frame 2
    expect(getSpinnerFrame(style, interval * 2)).toBe("|");
    // At interval * 3, should be frame 3
    expect(getSpinnerFrame(style, interval * 3)).toBe("/");
  });

  it("wraps around when elapsed exceeds full cycle", () => {
    const style: SpinnerStyle = "line";
    const interval = SPINNERS.line.interval;
    const frameCount = SPINNERS.line.frames.length;

    // After full cycle, should wrap to frame 0
    expect(getSpinnerFrame(style, interval * frameCount)).toBe("-");
    // After full cycle + 1, should be frame 1
    expect(getSpinnerFrame(style, interval * (frameCount + 1))).toBe("\\");
  });
});

// ============================================================================
// Static Rendering Tests (2 tests)
// ============================================================================

describe("renderSpinner()", () => {
  it("renders spinner frame without message", () => {
    const result = renderSpinner("dots");

    // Should contain a braille character
    expect(result).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("renders spinner frame with message", () => {
    const result = renderSpinner("dots", "Loading...");

    // Should contain spinner character and message
    expect(result).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    expect(result).toContain("Loading...");
  });
});

// ============================================================================
// Message Handling Tests (2 tests)
// ============================================================================

describe("renderSpinner() message handling", () => {
  it("separates spinner and message with space", () => {
    const result = renderSpinner("line", "Processing");

    // Format should be "spinner message"
    expect(result).toMatch(/^[\\|/-] Processing$/);
  });

  it("handles empty message gracefully", () => {
    const result = renderSpinner("dots", "");

    // Should just be the spinner character, no trailing space
    expect(result).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]$/);
  });
});
