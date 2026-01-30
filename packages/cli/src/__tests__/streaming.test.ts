/**
 * Tests for streaming primitives
 *
 * Tests cover:
 * - ANSI escape sequences (3 tests)
 * - StreamWriter (4 tests)
 * - Spinner (4 tests)
 *
 * Total: 11 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  ANSI,
  createSpinner,
  createStreamWriter,
  type Spinner,
  type StreamWriter,
} from "../streaming/index.js";

// ============================================================================
// ANSI Escape Sequences Tests
// ============================================================================

describe("ANSI", () => {
  it("provides cursor movement sequences", () => {
    expect(ANSI.cursorUp(1)).toBe("\x1b[1A");
    expect(ANSI.cursorUp(5)).toBe("\x1b[5A");
    expect(ANSI.cursorDown(2)).toBe("\x1b[2B");
    expect(ANSI.cursorDown(10)).toBe("\x1b[10B");
  });

  it("provides line clearing sequences", () => {
    expect(ANSI.clearLine).toBe("\x1b[2K");
    expect(ANSI.clearToEnd).toBe("\x1b[0J");
  });

  it("provides cursor visibility sequences", () => {
    expect(ANSI.hideCursor).toBe("\x1b[?25l");
    expect(ANSI.showCursor).toBe("\x1b[?25h");
    expect(ANSI.saveCursor).toBe("\x1b[s");
    expect(ANSI.restoreCursor).toBe("\x1b[u");
  });
});

// ============================================================================
// StreamWriter Tests
// ============================================================================

describe("createStreamWriter()", () => {
  let writer: StreamWriter;
  let output: string[];

  beforeEach(() => {
    output = [];
    writer = createStreamWriter({
      stream: {
        write: (str: string) => {
          output.push(str);
          return true;
        },
        isTTY: true,
      },
    });
  });

  afterEach(() => {
    writer.clear();
  });

  it("writes content to stream", () => {
    writer.write("Hello");
    expect(output.join("")).toContain("Hello");
  });

  it("updates content in place", () => {
    writer.write("First");
    writer.update("Second");
    // Should contain cursor movement for in-place update
    expect(output.some((s) => s.includes("\x1b["))).toBe(true);
    expect(output.join("")).toContain("Second");
  });

  it("persists content and moves to new line", () => {
    writer.write("Line 1");
    writer.persist();
    writer.write("Line 2");
    // After persist, should be on a new line
    expect(output.join("")).toContain("\n");
  });

  it("clears current content", () => {
    writer.write("Content");
    writer.clear();
    // Should have clear sequence
    expect(output.some((s) => s.includes(ANSI.clearLine))).toBe(true);
  });
});

// ============================================================================
// Spinner Tests
// ============================================================================

describe("createSpinner()", () => {
  let spinner: Spinner;
  let output: string[];

  beforeEach(() => {
    output = [];
    spinner = createSpinner("Loading", {
      stream: {
        write: (str: string) => {
          output.push(str);
          return true;
        },
        isTTY: true,
      },
    });
  });

  afterEach(() => {
    spinner.stop();
  });

  it("starts with initial message", () => {
    spinner.start();
    expect(output.join("")).toContain("Loading");
  });

  it("updates message while spinning", () => {
    spinner.start();
    spinner.update("Processing");
    expect(output.join("")).toContain("Processing");
  });

  it("succeeds with custom message", () => {
    spinner.start();
    spinner.succeed("Done!");
    const outputStr = output.join("");
    expect(outputStr).toContain("Done!");
    // Should show success indicator
    expect(outputStr).toMatch(/[✔✓]/);
  });

  it("fails with custom message", () => {
    spinner.start();
    spinner.fail("Error occurred");
    const outputStr = output.join("");
    expect(outputStr).toContain("Error occurred");
    // Should show error indicator
    expect(outputStr).toMatch(/[✖✗]/);
  });
});

// ============================================================================
// Non-TTY Fallback Tests
// ============================================================================

describe("non-TTY fallback", () => {
  it("StreamWriter writes static content without ANSI", () => {
    const output: string[] = [];
    const writer = createStreamWriter({
      stream: {
        write: (str: string) => {
          output.push(str);
          return true;
        },
        isTTY: false,
      },
    });

    writer.write("Static content");
    // Should not contain ANSI escape sequences for cursor
    expect(output.join("")).not.toContain("\x1b[");
    writer.clear();
  });

  it("Spinner shows static message without animation in non-TTY", () => {
    const output: string[] = [];
    const spinner = createSpinner("Loading", {
      stream: {
        write: (str: string) => {
          output.push(str);
          return true;
        },
        isTTY: false,
      },
    });

    spinner.start();
    spinner.succeed("Done!");
    // Should contain the message
    expect(output.join("")).toContain("Done!");
    spinner.stop();
  });
});
