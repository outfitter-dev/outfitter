/**
 * Tests for `outfitter init --skip-existing` flag.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { setupInitTestHarness, tempDir } from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init command --skip-existing flag", () => {
  test("skips files that already exist without error", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create an existing package.json
    const existingContent = JSON.stringify({ name: "existing-project" });
    writeFileSync(join(tempDir, "package.json"), existingContent);

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      preset: "minimal",
      force: false,
      skipExisting: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    // The existing file should NOT be overwritten
    const packageJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    );
    expect(packageJson.name).toBe("existing-project");
  });

  test("writes new files that don't exist yet", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create only package.json — other preset files should still be written
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing-project" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      preset: "minimal",
      force: false,
      skipExisting: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    // tsconfig.json should be created since it didn't exist before
    expect(existsSync(join(tempDir, "tsconfig.json"))).toBe(true);
  });

  test("reports skipped files in the result", async () => {
    const { runInit } = await import("../commands/init.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      preset: "minimal",
      force: false,
      skipExisting: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.skippedFiles).toBeDefined();
    expect(Array.isArray(result.value.skippedFiles)).toBe(true);

    // package.json should appear in the skipped list
    const skippedBasenames = (result.value.skippedFiles ?? []).map((f) =>
      f.split("/").pop()
    );
    expect(skippedBasenames).toContain("package.json");
  });

  test("fails when existing files are present and --skip-existing is not set", async () => {
    const { runInit } = await import("../commands/init.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      preset: "minimal",
      force: false,
      skipExisting: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("already has a package.json");
    }
  });
});
