/**
 * Tests for `outfitter update --apply` behavior.
 *
 * These tests mock `getLatestVersion` (npm queries) and `Bun.spawn` (bun install)
 * to verify the apply logic without hitting the network.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpdate } from "../commands/update.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-update-apply-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    JSON.stringify(
      {
        name: "test-project",
        version: "0.1.0",
        dependencies: deps,
        devDependencies: devDeps ?? {},
      },
      null,
      2
    )
  );
}

function readPackageJson(dir: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;

// Track Bun.spawn calls for verification
let spawnCalls: Array<{ cmd: string[]; cwd?: string }> = [];
const originalSpawn = Bun.spawn;

beforeEach(() => {
  tempDir = createTempDir();
  spawnCalls = [];
});

afterEach(() => {
  cleanupTempDir(tempDir);
  mock.restore();
});

/**
 * Mock both npm version queries and bun install.
 *
 * `versionMap` maps package names to their "latest" version.
 * If a package is not in the map, the npm query returns null (failure).
 */
function mockNpmAndInstall(versionMap: Record<string, string>): void {
  const mockSpawn = (
    cmd: string[],
    opts?: { cwd?: string; stdout?: string; stderr?: string }
  ) => {
    const cmdArray = Array.isArray(cmd) ? cmd : [cmd];

    // Mock npm view <pkg> version
    if (
      cmdArray[0] === "npm" &&
      cmdArray[1] === "view" &&
      cmdArray[3] === "version"
    ) {
      const pkgName = cmdArray[2] ?? "";
      const version = versionMap[pkgName];

      spawnCalls.push({ cmd: cmdArray, cwd: opts?.cwd });

      if (version) {
        return {
          stdout: new Response(version).body,
          stderr: new Response("").body,
          exited: Promise.resolve(0),
        };
      }
      return {
        stdout: new Response("").body,
        stderr: new Response("Not found").body,
        exited: Promise.resolve(1),
      };
    }

    // Mock bun install
    if (cmdArray[0] === "bun" && cmdArray[1] === "install") {
      spawnCalls.push({ cmd: cmdArray, cwd: opts?.cwd });
      return {
        stdout: new Response("").body,
        stderr: new Response("").body,
        exited: Promise.resolve(0),
      };
    }

    // Fallback to original for anything else
    return originalSpawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
  };

  Object.assign(Bun, { spawn: mockSpawn });
}

// =============================================================================
// --apply with non-breaking updates
// =============================================================================

describe("update --apply with non-breaking updates", () => {
  test("writes correct versions to package.json", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "~0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.1.3",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/contracts");
    expect(result.value.appliedPackages).toContain("@outfitter/cli");

    // Verify package.json was updated with correct prefixes
    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.1.5");
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("~0.1.3");
  });

  test("preserves version prefix (^ ~ >= etc.)", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": ">=0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe(">=0.1.5");
  });

  test("updates devDependencies correctly", async () => {
    writePackageJson(tempDir, {}, { "@outfitter/testing": "^0.1.0" });

    mockNpmAndInstall({
      "@outfitter/testing": "0.1.2",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/testing");

    const pkg = readPackageJson(tempDir);
    expect(pkg.devDependencies?.["@outfitter/testing"]).toBe("^0.1.2");
  });
});

// =============================================================================
// --apply runs bun install
// =============================================================================

describe("update --apply runs bun install", () => {
  test("invokes bun install after writing package.json", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);

    // Verify bun install was called
    const installCall = spawnCalls.find(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCall).toBeDefined();
    expect(installCall?.cwd).toBe(tempDir);
  });

  test("bun install is called exactly once", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.1.3",
    });

    await runUpdate({ cwd: tempDir, apply: true });

    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(1);
  });
});

// =============================================================================
// --apply skips breaking updates
// =============================================================================

describe("update --apply skips breaking updates", () => {
  test("skips breaking updates and reports them", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    // contracts: 0.1.0 -> 0.2.0 is breaking (pre-1.0 minor bump)
    // cli: 0.1.0 -> 0.1.3 is non-breaking
    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.3",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/cli");
    expect(result.value.appliedPackages).not.toContain("@outfitter/contracts");
    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");

    // Verify package.json: cli updated, contracts unchanged
    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("^0.1.3");
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.1.0");
  });

  test("only breaking updates available results in no apply", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    // 0.1.0 -> 0.2.0 is breaking (pre-1.0 minor bump)
    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.appliedPackages).toHaveLength(0);
    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");

    // Verify package.json unchanged
    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.1.0");
  });

  test("major version bump is detected as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^1.0.0",
    });

    // 1.0.0 -> 2.0.0 is breaking (major bump)
    mockNpmAndInstall({
      "@outfitter/contracts": "2.0.0",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");
  });
});

// =============================================================================
// --apply with nothing to update
// =============================================================================

describe("update --apply with no updates available", () => {
  test("does nothing when all packages are up to date", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.5",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.appliedPackages).toHaveLength(0);
    expect(result.value.skippedBreaking).toHaveLength(0);

    // Verify bun install was NOT called
    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(0);
  });

  test("does nothing when no @outfitter/* packages exist", async () => {
    writePackageJson(tempDir, { zod: "^3.0.0" });

    mockNpmAndInstall({});

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.total).toBe(0);
  });
});

// =============================================================================
// Without --apply, behavior is unchanged (read-only)
// =============================================================================

describe("update without --apply is read-only", () => {
  test("does not modify package.json", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.appliedPackages).toHaveLength(0);

    // Verify package.json unchanged
    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.1.0");
  });

  test("does not call bun install", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    await runUpdate({ cwd: tempDir });

    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(0);
  });

  test("still reports available updates in result", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.updatesAvailable).toBe(1);
    expect(result.value.packages[0]?.updateAvailable).toBe(true);
  });

  test("result includes skippedBreaking even without --apply", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");
  });
});
