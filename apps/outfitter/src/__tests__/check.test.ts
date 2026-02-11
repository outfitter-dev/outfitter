import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { runCheck } from "../commands/check.js";
import type { Manifest } from "../manifest.js";

/**
 * Helper: writes a manifest file into the test directory.
 */
function writeTestManifest(testDir: string, manifest: Manifest): void {
  const outfitterDir = join(testDir, ".outfitter");
  mkdirSync(outfitterDir, { recursive: true });
  writeFileSync(
    join(outfitterDir, "manifest.json"),
    JSON.stringify(manifest, null, "\t")
  );
}

/**
 * Helper: resolves the registry.json path via the tooling package.json location.
 */
function getRegistryPath(): string {
  const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
  return join(dirname(toolingPkgPath), "registry", "registry.json");
}

/**
 * Helper: loads the real registry and returns the canonical content for a block's file.
 */
function getRegistryFileContent(blockName: string, filePath: string): string {
  const registryPath = getRegistryPath();
  const registryRaw = readFileSync(registryPath, "utf-8");
  const registry = JSON.parse(registryRaw);
  const block = registry.blocks[blockName];
  if (!block?.files) {
    throw new Error(`Block ${blockName} has no files`);
  }
  const file = block.files.find(
    (f: { path: string; content: string }) => f.path === filePath
  );
  if (!file) {
    throw new Error(`File ${filePath} not found in block ${blockName}`);
  }
  return file.content;
}

describe("runCheck", () => {
  const testDir = join(import.meta.dirname, ".test-check-output");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  // =========================================================================
  // All blocks current
  // =========================================================================

  test("all blocks current returns 0 drift count", async () => {
    // Write the canonical registry content for biome
    const biomeContent = getRegistryFileContent("biome", "biome.json");
    writeFileSync(join(testDir, "biome.json"), biomeContent);

    // Get tooling version
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.driftedCount).toBe(0);
      expect(result.value.currentCount).toBe(1);
      expect(result.value.totalChecked).toBe(1);
      expect(result.value.blocks[0]?.status).toBe("current");
    }
  });

  // =========================================================================
  // Drifted block detection
  // =========================================================================

  test("drifted block detected returns correct classification", async () => {
    // Write modified content for biome
    writeFileSync(join(testDir, "biome.json"), '{"modified": true}');

    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.driftedCount).toBe(1);
      expect(result.value.currentCount).toBe(0);
      const biomeBlock = result.value.blocks.find((b) => b.name === "biome");
      expect(biomeBlock?.status).toBe("drifted");
    }
  });

  // =========================================================================
  // Missing block (file deleted)
  // =========================================================================

  test("missing block classified correctly when file deleted", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // Manifest says biome is installed, but no biome.json file exists
    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.missingCount).toBe(1);
      const biomeBlock = result.value.blocks.find((b) => b.name === "biome");
      expect(biomeBlock?.status).toBe("missing");
    }
  });

  // =========================================================================
  // No manifest — fallback to file-presence heuristic
  // =========================================================================

  test("no manifest falls back to file-presence heuristic", async () => {
    // Write a biome.json with canonical content but no manifest
    const biomeContent = getRegistryFileContent("biome", "biome.json");
    writeFileSync(join(testDir, "biome.json"), biomeContent);

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should detect biome block via file presence
      const biomeBlock = result.value.blocks.find((b) => b.name === "biome");
      expect(biomeBlock).toBeDefined();
      expect(biomeBlock?.status).toBe("current");
      expect(result.value.totalChecked).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // JSON structural comparison ignores formatting
  // =========================================================================

  test("JSON structural comparison ignores formatting differences", async () => {
    // Write biome.json with different formatting but same structure
    const biomeContent = getRegistryFileContent("biome", "biome.json");
    const parsed = JSON.parse(biomeContent);
    // Re-serialize with different formatting (spaces instead of tabs, sorted differently)
    const reformatted = JSON.stringify(parsed, null, "  ");
    writeFileSync(join(testDir, "biome.json"), reformatted);

    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const biomeBlock = result.value.blocks.find((b) => b.name === "biome");
      // Should be current because structurally identical
      expect(biomeBlock?.status).toBe("current");
      expect(result.value.driftedCount).toBe(0);
    }
  });

  // =========================================================================
  // --block flag filters to specific block
  // =========================================================================

  test("block filter checks only specified block", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // Write canonical content for biome
    const biomeContent = getRegistryFileContent("biome", "biome.json");
    writeFileSync(join(testDir, "biome.json"), biomeContent);

    // Write drifted content for lefthook
    writeFileSync(join(testDir, ".lefthook.yml"), "modified: true");

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
        lefthook: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir, block: "biome" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should only check biome, not lefthook
      expect(result.value.totalChecked).toBe(1);
      expect(result.value.blocks).toHaveLength(1);
      expect(result.value.blocks[0]?.name).toBe("biome");
      expect(result.value.blocks[0]?.status).toBe("current");
    }
  });

  // =========================================================================
  // Verbose mode includes diff information
  // =========================================================================

  test("verbose mode includes diff for drifted blocks", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // Write modified content
    writeFileSync(join(testDir, "biome.json"), '{"custom": "config"}');

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir, verbose: true });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const biomeBlock = result.value.blocks.find((b) => b.name === "biome");
      expect(biomeBlock?.status).toBe("drifted");
      // In verbose mode, drifted files should have a populated driftedFiles array
      expect(biomeBlock?.driftedFiles).toBeDefined();
      expect(biomeBlock?.driftedFiles?.length).toBeGreaterThan(0);
      expect(biomeBlock?.driftedFiles?.[0]?.path).toBe("biome.json");
    }
  });

  // =========================================================================
  // Mixed statuses across multiple blocks
  // =========================================================================

  test("handles mix of current, drifted, and missing blocks", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // biome: current (canonical content)
    const biomeContent = getRegistryFileContent("biome", "biome.json");
    writeFileSync(join(testDir, "biome.json"), biomeContent);

    // lefthook: drifted (modified content)
    writeFileSync(join(testDir, ".lefthook.yml"), "modified: true");

    // claude: missing (no files written)

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        biome: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
        lefthook: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
        claude: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.totalChecked).toBe(3);
      expect(result.value.currentCount).toBe(1);
      expect(result.value.driftedCount).toBe(1);
      expect(result.value.missingCount).toBe(1);

      const biomeBlock = result.value.blocks.find((b) => b.name === "biome");
      const lefthookBlock = result.value.blocks.find(
        (b) => b.name === "lefthook"
      );
      const claudeBlock = result.value.blocks.find((b) => b.name === "claude");

      expect(biomeBlock?.status).toBe("current");
      expect(lefthookBlock?.status).toBe("drifted");
      expect(claudeBlock?.status).toBe("missing");
    }
  });

  // =========================================================================
  // Block not in registry
  // =========================================================================

  test("block in manifest but not in registry is classified as missing", async () => {
    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        nonexistent: {
          installedFrom: "1.0.0",
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.missingCount).toBe(1);
      const block = result.value.blocks.find((b) => b.name === "nonexistent");
      expect(block?.status).toBe("missing");
    }
  });

  // =========================================================================
  // String comparison for non-JSON files
  // =========================================================================

  test("uses string comparison for non-JSON files", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // Write the exact canonical lefthook content
    const lefthookContent = getRegistryFileContent("lefthook", ".lefthook.yml");
    writeFileSync(join(testDir, ".lefthook.yml"), lefthookContent);

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        lefthook: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const lefthookBlock = result.value.blocks.find(
        (b) => b.name === "lefthook"
      );
      expect(lefthookBlock?.status).toBe("current");
    }
  });
});
