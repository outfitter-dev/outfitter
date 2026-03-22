/**
 * Tests for `outfitter init --skip-existing` flag.
 *
 * Verifies that existing files are preserved (not overwritten) when
 * `--skip-existing` is used, while new files are still written.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { setupInitTestHarness, tempDir } from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init --skip-existing", () => {
  test("skips existing files and writes new ones", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create a pre-existing file that should be preserved
    const existingContent = "# My Custom CLAUDE.md\n";
    writeFileSync(join(tempDir, "CLAUDE.md"), existingContent, "utf-8");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-skip",
      preset: "minimal",
      force: false,
      skipExisting: true,
      skipInstall: true,
      skipGit: true,
      yes: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    // Pre-existing file should be preserved
    const claudeContent = readFileSync(join(tempDir, "CLAUDE.md"), "utf-8");
    expect(claudeContent).toBe(existingContent);

    // New files from the preset should still be written
    expect(existsSync(join(tempDir, "tsconfig.json"))).toBe(true);
  });

  test("succeeds in directory with existing package.json", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create a pre-existing package.json
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" }),
      "utf-8"
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-skip",
      preset: "minimal",
      force: false,
      skipExisting: true,
      skipInstall: true,
      skipGit: true,
      yes: true,
    });

    // Should succeed, not error about existing package.json
    expect(result.isOk()).toBe(true);
  });

  test("fails without --skip-existing or --force when files exist", async () => {
    const { runInit } = await import("../commands/init.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" }),
      "utf-8"
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-fail",
      preset: "minimal",
      force: false,
      skipInstall: true,
      skipGit: true,
      yes: true,
    });

    expect(result.isErr()).toBe(true);
  });

  test("workspace structure with --skip-existing skips workspace root files", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create workspace root package.json
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "my-workspace", workspaces: ["apps/*"] }),
      "utf-8"
    );
    mkdirSync(join(tempDir, "apps"), { recursive: true });

    const result = await runInit({
      targetDir: tempDir,
      name: "test-ws-skip",
      preset: "minimal",
      structure: "workspace",
      workspaceName: "my-workspace",
      force: false,
      skipExisting: true,
      skipInstall: true,
      skipGit: true,
      yes: true,
    });

    expect(result.isOk()).toBe(true);

    // Original package.json should be preserved
    const pkgJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    );
    expect(pkgJson.workspaces).toEqual(["apps/*"]);
  });

  test("dry-run with --skip-existing annotates existing files as skipped", async () => {
    const { runInit } = await import("../commands/init.js");

    writeFileSync(join(tempDir, "CLAUDE.md"), "# existing\n", "utf-8");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-dry-skip",
      preset: "minimal",
      force: false,
      skipExisting: true,
      dryRun: true,
      skipInstall: true,
      skipGit: true,
      yes: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const skipped = (
      result.value.dryRunPlan?.operations as { type: string }[] | undefined
    )?.filter((op) => op.type === "file-skip");
    expect(skipped?.length).toBeGreaterThan(0);
  });
});
