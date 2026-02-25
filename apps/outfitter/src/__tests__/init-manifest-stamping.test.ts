/**
 * Tests for `outfitter init` manifest stamping behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Manifest } from "../manifest.js";
import { setupInitTestHarness, tempDir } from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init command manifest stamping", () => {
  test("stamps manifest with installed blocks after successful init", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude",
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["claude"]).toBeDefined();
    expect(manifest.blocks["claude"]?.installedFrom).toMatch(/^\d+\.\d+\.\d+/);
    expect(manifest.blocks["claude"]?.installedAt).toBeDefined();
  });

  test("stamps manifest for default scaffolding block", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      // Default: adds "scaffolding" block
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["scaffolding"]).toBeDefined();
    expect(manifest.blocks["scaffolding"]?.installedFrom).toMatch(
      /^\d+\.\d+\.\d+/
    );
  });

  test("does not create manifest when noTooling is true", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(false);
  });

  test("stamps manifest with multiple blocks from comma-separated list", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude,linter",
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["claude"]).toBeDefined();
    expect(manifest.blocks["linter"]).toBeDefined();
  });
});
