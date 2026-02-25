/**
 * Tests for `outfitter init` error paths and registry block handling.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import {
  setupInitTestHarness,
  tempDir,
  workspaceVersion,
} from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init command error handling", () => {
  test("returns error for invalid explicit package name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "App Space",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Invalid package name");
    }
  });

  test("returns error when target directory does not exist and cannot be created", async () => {
    const { runInit } = await import("../commands/init.js");

    // Use a path that cannot be created (under a file instead of a directory)
    const invalidPath = join(tempDir, "file.txt", "nested");
    writeFileSync(join(tempDir, "file.txt"), "content");

    const result = await runInit({
      targetDir: invalidPath,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
  });
});

// =============================================================================
// Init Command Result Type Tests
// =============================================================================

describe("init command result type", () => {
  test("returns Ok result on success", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isOk()).toBe(true);
  });

  test("returns Err result on failure", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file without force flag
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
  });
});

// =============================================================================
// Init Command Registry Blocks Tests
// =============================================================================

describe("init command registry blocks", () => {
  test("adds scaffolding by default in non-interactive mode", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      // No --with or --no-tooling specified, non-interactive mode
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Should have scaffolding files
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain(".oxlintrc.json");
    }
  });

  test("does not add tooling when noTooling is true", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeUndefined();
    }
    expect(existsSync(join(tempDir, ".oxlintrc.json"))).toBe(false);
    expect(existsSync(join(tempDir, ".lefthook.yml"))).toBe(false);
    expect(existsSync(join(tempDir, ".claude"))).toBe(false);
  });

  test("adds claude block when specified", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
    }

    // Verify file was actually created
    const settingsPath = join(tempDir, ".claude/settings.json");
    expect(existsSync(settingsPath)).toBe(true);
  });

  test("adds linter block with oxlint config files", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "linter",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      expect(result.value.blocksAdded?.created).toContain(".oxlintrc.json");
      expect(result.value.blocksAdded?.created).toContain(".oxfmtrc.jsonc");
      // Note: ultracite is already in SHARED_DEV_DEPS so it won't be in the added list
    }

    // Verify both linter config files were created
    const oxlintPath = join(tempDir, ".oxlintrc.json");
    expect(existsSync(oxlintPath)).toBe(true);
    const oxfmtPath = join(tempDir, ".oxfmtrc.jsonc");
    expect(existsSync(oxfmtPath)).toBe(true);
  });

  test("adds multiple blocks from comma-separated list", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude,linter",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Should have files from both blocks
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain(".oxlintrc.json");
    }
  });

  test("adds scaffolding block which extends all other blocks", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "scaffolding",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Blocks are the canonical source for tooling files — no template duplicates.
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain(".oxlintrc.json");
      expect(result.value.blocksAdded?.created).toContain(
        "scripts/bootstrap.sh"
      );
      // .lefthook.yml is provided by both the preset template and the block.
      // Since the template is copied first, the block's version is skipped.
      // OS-302 will remove tooling files from presets so blocks are canonical.
      const allBlockFiles = [
        ...(result.value.blocksAdded?.created ?? []),
        ...(result.value.blocksAdded?.skipped ?? []),
      ];
      expect(allBlockFiles).toContain(".lefthook.yml");
    }
  });

  test("returns error for invalid block name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "nonexistent-block",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("nonexistent-block");
    }
  });
});

// =============================================================================
// Init Command Manifest Stamping Tests
// =============================================================================
