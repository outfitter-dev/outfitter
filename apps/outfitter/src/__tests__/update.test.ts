/**
 * Tests for `outfitter update` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpdate } from "../commands/update.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writePackageJson(
  dir: string,
  deps: Record<string, string>,
  devDeps?: Record<string, string>
): void {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "test-project",
      version: "0.1.0",
      dependencies: deps,
      devDependencies: devDeps ?? {},
    })
  );
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

// =============================================================================
// Version Detection Tests
// =============================================================================

describe("update command version detection", () => {
  test("returns empty packages when no @outfitter deps found", async () => {
    writePackageJson(tempDir, { zod: "^3.0.0" });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.packages).toEqual([]);
      expect(result.value.total).toBe(0);
      expect(result.value.updatesAvailable).toBe(0);
    }
  });

  test("returns error when no package.json exists", async () => {
    const result = await runUpdate({ cwd: tempDir });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("No package.json found");
    }
  });

  test("skips workspace:* versions", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "workspace:*",
      zod: "^3.0.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.packages).toEqual([]);
      expect(result.value.total).toBe(0);
    }
  });

  test("detects @outfitter/* packages from dependencies", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "~0.1.0",
      zod: "^3.0.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.total).toBe(2);
      const names = result.value.packages.map((p) => p.name);
      expect(names).toContain("@outfitter/contracts");
      expect(names).toContain("@outfitter/cli");
    }
  });

  test("detects packages from devDependencies", async () => {
    writePackageJson(tempDir, {}, { "@outfitter/testing": "^0.1.0" });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.total).toBe(1);
      expect(result.value.packages[0]?.name).toBe("@outfitter/testing");
    }
  });

  test("strips version range prefixes for current version", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": ">=0.1.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.packages[0]?.current).toBe("0.1.0");
    }
  });
});

// =============================================================================
// Output Structure Tests
// =============================================================================

describe("update command output structure", () => {
  test("result has expected shape", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const val = result.value;
      expect(typeof val.total).toBe("number");
      expect(typeof val.updatesAvailable).toBe("number");
      expect(typeof val.hasBreaking).toBe("boolean");
      expect(Array.isArray(val.packages)).toBe(true);

      for (const pkg of val.packages) {
        expect(typeof pkg.name).toBe("string");
        expect(typeof pkg.current).toBe("string");
        expect(typeof pkg.updateAvailable).toBe("boolean");
        expect(typeof pkg.breaking).toBe("boolean");
      }
    }
  });
});
