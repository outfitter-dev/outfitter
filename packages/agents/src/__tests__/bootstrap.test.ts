import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrap } from "../bootstrap.js";

describe("bootstrap", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  test("calls extend callback when provided (with force)", async () => {
    let extendCalled = false;

    // Create node_modules and package.json
    await Bun.write(join(tempDir, "node_modules/.keep"), "");
    await Bun.write(join(tempDir, "package.json"), "{}");

    await bootstrap({
      quiet: true,
      force: true, // Force full bootstrap to test extend
      extend: async () => {
        extendCalled = true;
      },
    });

    expect(extendCalled).toBe(true);
  });

  test("fast-path exits early when all tools and node_modules present", async () => {
    // Create node_modules to satisfy the check
    await Bun.write(join(tempDir, "node_modules/.keep"), "");

    // Check if all tools exist on this system
    const toolsExist =
      Bun.spawnSync(["which", "bun"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gh"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gt"]).exitCode === 0 &&
      Bun.spawnSync(["which", "markdownlint-cli2"]).exitCode === 0;

    if (!toolsExist) {
      // Skip test if tools aren't installed - can't test fast-path
      return;
    }

    let extendCalled = false;

    await bootstrap({
      quiet: true,
      force: false,
      extend: async () => {
        extendCalled = true;
      },
    });

    // Fast-path should exit before calling extend
    expect(extendCalled).toBe(false);
  });

  test("force bypasses fast-path", async () => {
    let extendCalled = false;

    // Create node_modules
    await Bun.write(join(tempDir, "node_modules/.keep"), "");
    await Bun.write(join(tempDir, "package.json"), "{}");

    await bootstrap({
      quiet: true,
      force: true,
      extend: async () => {
        extendCalled = true;
      },
    });

    // With force, extend should always be called
    expect(extendCalled).toBe(true);
  });

  test("completes without error in quiet mode", async () => {
    await Bun.write(join(tempDir, "node_modules/.keep"), "");
    await Bun.write(join(tempDir, "package.json"), "{}");

    // Should not throw
    await expect(
      bootstrap({ quiet: true, force: true })
    ).resolves.toBeUndefined();
  });

  test("additional tools in list are checked for fast-path", async () => {
    // Create node_modules
    await Bun.write(join(tempDir, "node_modules/.keep"), "");

    // Check if core tools exist
    const coreToolsExist =
      Bun.spawnSync(["which", "bun"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gh"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gt"]).exitCode === 0 &&
      Bun.spawnSync(["which", "markdownlint-cli2"]).exitCode === 0;

    if (!coreToolsExist) {
      return;
    }

    // With core tools present, fast-path would normally succeed
    // But adding a nonexistent tool to the list should prevent fast-path
    // We can verify this by catching the error when it tries to install

    await expect(
      bootstrap({
        quiet: true,
        tools: ["nonexistent-tool-xyz-123"],
      })
    ).rejects.toThrow();
  });
});
