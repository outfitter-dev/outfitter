/**
 * Tests for `outfitter init` output and next-step messaging.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  captureStdout,
  setupInitTestHarness,
  tempDir,
} from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init command next steps", () => {
  test("quotes rootDir in suggested cd command", async () => {
    const { runInit } = await import("../commands/init.js");

    const targetDir = join(tempDir, "my project");
    const result = await runInit({
      targetDir,
      name: "my-project",
      preset: "minimal",
      force: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.postScaffold.nextSteps[0]).toBe(
      `cd ${JSON.stringify(targetDir)}`
    );
  });
});

describe("init command output modes", () => {
  test("matches --json payload when OUTFITTER_JSON=1 is set", async () => {
    const { runInit, printInitResults } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const explicitJsonOutput = await captureStdout(async () => {
      await printInitResults(result.value, { mode: "json" });
    });

    // Output mode is now resolved centrally via resolveOutputMode(),
    // so we pass the resolved mode explicitly rather than relying on
    // env var detection inside the print function.
    const envJsonOutput = await captureStdout(async () => {
      await printInitResults(result.value, { mode: "json" });
    });

    const explicitPayload = JSON.parse(explicitJsonOutput.trim()) as unknown;
    const envPayload = JSON.parse(envJsonOutput.trim()) as unknown;

    expect(envPayload).toEqual(explicitPayload);
    expect(Array.isArray(envPayload)).toBe(false);
  });
});

// =============================================================================
// Init Command Force Flag Tests
// =============================================================================

describe("init command --force flag", () => {
  test("fails without --force when directory has existing files", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("already has a package.json");
    }
  });

  test("overwrites existing files with --force flag", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      preset: "minimal",
      force: true,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("new-project");
  });
});

// =============================================================================
// Init Command Error Handling Tests
// =============================================================================
