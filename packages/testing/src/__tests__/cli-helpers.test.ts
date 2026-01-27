/**
 * @outfitter/testing - CLI Helpers Test Suite
 */

import { describe, expect, it } from "bun:test";
import { captureCLI, mockStdin } from "../cli-helpers.js";

describe("captureCLI()", () => {
  it("captures stdout, stderr, and exit code", async () => {
    const result = await captureCLI(async () => {
      console.log("hello");
      console.error("oops");
      process.exit(2);
    });

    expect(result.stdout).toContain("hello");
    expect(result.stderr).toContain("oops");
    expect(result.exitCode).toBe(2);
  });

  it("returns exit code 1 on thrown errors", async () => {
    const result = await captureCLI(() => {
      throw new Error("boom");
    });

    expect(result.exitCode).toBe(1);
  });
});

describe("mockStdin()", () => {
  it("provides input via stdin", async () => {
    const { restore } = mockStdin("test-input");
    let collected = "";
    for await (const chunk of process.stdin) {
      collected += Buffer.from(chunk).toString("utf-8");
    }
    restore();

    expect(collected).toBe("test-input");
  });
});
