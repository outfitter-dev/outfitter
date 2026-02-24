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

/**
 * Helper: writes all canonical files for a registry block into the test directory.
 */
function writeAllBlockFiles(testDir: string, blockName: string): void {
  const registryPath = getRegistryPath();
  const registryRaw = readFileSync(registryPath, "utf-8");
  const registry = JSON.parse(registryRaw);
  const block = registry.blocks[blockName];
  if (!block?.files) {
    throw new Error(`Block ${blockName} has no files`);
  }
  for (const file of block.files as { path: string; content: string }[]) {
    const dir = dirname(join(testDir, file.path));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(testDir, file.path), file.content);
  }
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
    // Write all canonical registry files for linter block
    writeAllBlockFiles(testDir, "linter");

    // Get tooling version
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
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
    // Write modified content for linter
    writeFileSync(join(testDir, ".oxlintrc.json"), '{"modified": true}');

    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
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
      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      expect(linterBlock?.status).toBe("drifted");
    }
  });

  // =========================================================================
  // Missing block (file deleted)
  // =========================================================================

  test("missing block classified correctly when file deleted", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // Manifest says linter is installed, but no linter files exist
    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.missingCount).toBe(1);
      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      expect(linterBlock?.status).toBe("missing");
    }
  });

  // =========================================================================
  // No manifest — fallback to file-presence heuristic
  // =========================================================================

  test("no manifest falls back to file-presence heuristic", async () => {
    // Write all canonical linter files but no manifest
    writeAllBlockFiles(testDir, "linter");

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should detect linter block via file presence
      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      expect(linterBlock).toBeDefined();
      expect(linterBlock?.status).toBe("current");
      expect(result.value.totalChecked).toBeGreaterThan(0);
    }
  });

  test("no manifest detects linter from oxfmt marker and reports drift", async () => {
    const oxfmtContent = getRegistryFileContent("linter", ".oxfmtrc.jsonc");
    writeFileSync(join(testDir, ".oxfmtrc.jsonc"), oxfmtContent);

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      expect(linterBlock).toBeDefined();
      expect(linterBlock?.status).toBe("drifted");
      expect(result.value.totalChecked).toBeGreaterThan(0);
    }
  });

  // =========================================================================
  // JSON structural comparison ignores formatting
  // =========================================================================

  test("JSON structural comparison ignores formatting differences", async () => {
    // Write all canonical linter files first
    writeAllBlockFiles(testDir, "linter");
    // Overwrite .oxlintrc.json with different formatting but same structure
    const linterContent = getRegistryFileContent("linter", ".oxlintrc.json");
    const parsed = JSON.parse(linterContent);
    // Re-serialize with different formatting (spaces instead of tabs, sorted differently)
    const reformatted = JSON.stringify(parsed, null, "  ");
    writeFileSync(join(testDir, ".oxlintrc.json"), reformatted);

    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      // Should be current because structurally identical
      expect(linterBlock?.status).toBe("current");
      expect(result.value.driftedCount).toBe(0);
    }
  });

  // =========================================================================
  // --block flag filters to specific block
  // =========================================================================

  test("block filter checks only specified block", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // Write all canonical linter files
    writeAllBlockFiles(testDir, "linter");

    // Write drifted content for lefthook
    writeFileSync(join(testDir, ".lefthook.yml"), "modified: true");

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
        lefthook: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir, block: "linter" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should only check linter, not lefthook
      expect(result.value.totalChecked).toBe(1);
      expect(result.value.blocks).toHaveLength(1);
      expect(result.value.blocks[0]?.name).toBe("linter");
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
    writeFileSync(join(testDir, ".oxlintrc.json"), '{"custom": "config"}');

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
          installedFrom: toolingPkg.version,
          installedAt: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const result = await runCheck({ cwd: testDir, verbose: true });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      expect(linterBlock?.status).toBe("drifted");
      // In verbose mode, drifted files should have a populated driftedFiles array
      expect(linterBlock?.driftedFiles).toBeDefined();
      expect(linterBlock?.driftedFiles?.length).toBeGreaterThan(0);
      expect(
        linterBlock?.driftedFiles?.some(
          (file) => file.path === ".oxlintrc.json"
        )
      ).toBe(true);
    }
  });

  // =========================================================================
  // Mixed statuses across multiple blocks
  // =========================================================================

  test("handles mix of current, drifted, and missing blocks", async () => {
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8"));

    // linter: current (all canonical files)
    writeAllBlockFiles(testDir, "linter");

    // lefthook: drifted (modified content)
    writeFileSync(join(testDir, ".lefthook.yml"), "modified: true");

    // claude: missing (no files written)

    writeTestManifest(testDir, {
      version: 1,
      blocks: {
        linter: {
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

      const linterBlock = result.value.blocks.find((b) => b.name === "linter");
      const lefthookBlock = result.value.blocks.find(
        (b) => b.name === "lefthook"
      );
      const claudeBlock = result.value.blocks.find((b) => b.name === "claude");

      expect(linterBlock?.status).toBe("current");
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
  // Empty result at workspace root (no blocks detected)
  // =========================================================================

  test("empty directory with no manifest returns 0 blocks", async () => {
    const result = await runCheck({ cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.totalChecked).toBe(0);
      expect(result.value.currentCount).toBe(0);
      expect(result.value.driftedCount).toBe(0);
      expect(result.value.missingCount).toBe(0);
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
