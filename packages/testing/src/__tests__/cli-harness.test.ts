/**
 * @outfitter/testing - CLI Harness Test Suite
 *
 * TDD RED PHASE: These tests document expected behavior and WILL FAIL
 * until implementation is complete.
 *
 * Test categories:
 * 1. createCliHarness basic functionality (4 tests)
 * 2. Output capturing (3 tests)
 * 3. Error handling (2 tests)
 */

import { describe, expect, it } from "bun:test";
import { createCliHarness } from "../cli-harness.js";

// ============================================================================
// 1. createCliHarness Basic Functionality
// ============================================================================

describe("createCliHarness()", () => {
  it("creates a harness for a given command", () => {
    const harness = createCliHarness("echo");

    expect(harness).toBeDefined();
    expect(typeof harness.run).toBe("function");
  });

  it("runs the command with provided arguments", async () => {
    const harness = createCliHarness("echo");
    const result = await harness.run(["hello", "world"]);

    expect(result.stdout.trim()).toBe("hello world");
    expect(result.exitCode).toBe(0);
  });

  it("returns CliResult with stdout, stderr, and exitCode", async () => {
    const harness = createCliHarness("echo");
    const result = await harness.run(["test"]);

    expect(typeof result.stdout).toBe("string");
    expect(typeof result.stderr).toBe("string");
    expect(typeof result.exitCode).toBe("number");
  });

  it("handles commands with no arguments", async () => {
    const harness = createCliHarness("pwd");
    const result = await harness.run([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 2. Output Capturing
// ============================================================================

describe("CliHarness output capturing", () => {
  it("captures stdout correctly", async () => {
    const harness = createCliHarness("echo");
    const result = await harness.run(["output to stdout"]);

    expect(result.stdout).toContain("output to stdout");
  });

  it("captures stderr correctly", async () => {
    // Use a shell command that writes to stderr
    const harness = createCliHarness("sh");
    const result = await harness.run(["-c", "echo error >&2"]);

    expect(result.stderr).toContain("error");
  });

  it("handles multi-line output", async () => {
    const harness = createCliHarness("sh");
    const result = await harness.run([
      "-c",
      "echo line1; echo line2; echo line3",
    ]);

    expect(result.stdout).toContain("line1");
    expect(result.stdout).toContain("line2");
    expect(result.stdout).toContain("line3");
  });
});

// ============================================================================
// 3. Error Handling
// ============================================================================

describe("CliHarness error handling", () => {
  it("captures non-zero exit codes", async () => {
    const harness = createCliHarness("sh");
    const result = await harness.run(["-c", "exit 42"]);

    expect(result.exitCode).toBe(42);
  });

  it("handles commands that output to both stdout and stderr", async () => {
    const harness = createCliHarness("sh");
    const result = await harness.run(["-c", "echo out; echo err >&2; exit 1"]);

    expect(result.stdout).toContain("out");
    expect(result.stderr).toContain("err");
    expect(result.exitCode).toBe(1);
  });
});
