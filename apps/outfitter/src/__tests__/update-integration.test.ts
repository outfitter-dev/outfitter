/**
 * Integration tests for `outfitter update` — exercises the full `runUpdate()` flow.
 *
 * These tests wire together workspace scanning, npm version querying (mocked),
 * semver analysis, apply logic, and migration guide generation to verify
 * the end-to-end command behavior.
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
import { join, resolve } from "node:path";
import { runUpdate } from "../commands/update.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-update-integration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readPackageJson(dir: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
}

function writeMigrationDoc(
  dir: string,
  shortName: string,
  version: string,
  body: string
): void {
  const filename = `outfitter-${shortName}-${version}.md`;
  const content = `---\npackage: "@outfitter/${shortName}"\nversion: ${version}\nbreaking: true\n---\n\n${body}\n`;
  writeFileSync(join(dir, filename), content);
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;
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
// Full Flow — Result Shape Validation
// =============================================================================

describe("integration: full runUpdate() flow — result shape", () => {
  test("returns well-formed UpdateResult with all expected fields", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
      "@outfitter/config": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.2.0",
      "@outfitter/config": "0.1.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const val = result.value;

    // Shape: all required fields exist with correct types
    expect(typeof val.total).toBe("number");
    expect(typeof val.updatesAvailable).toBe("number");
    expect(typeof val.hasBreaking).toBe("boolean");
    expect(typeof val.applied).toBe("boolean");
    expect(Array.isArray(val.packages)).toBe(true);
    expect(Array.isArray(val.appliedPackages)).toBe(true);
    expect(Array.isArray(val.skippedBreaking)).toBe(true);

    // Counts are consistent
    expect(val.total).toBe(3);
    expect(val.packages).toHaveLength(3);

    // Each package has the expected shape
    for (const pkg of val.packages) {
      expect(typeof pkg.name).toBe("string");
      expect(typeof pkg.current).toBe("string");
      expect(typeof pkg.updateAvailable).toBe("boolean");
      expect(typeof pkg.breaking).toBe("boolean");
      expect(pkg.latest === null || typeof pkg.latest === "string").toBe(true);
    }
  });

  test("counts match the package states correctly", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0", // 0.1.0 -> 0.2.0 breaking
      "@outfitter/cli": "^0.1.0", // 0.1.0 -> 0.1.5 non-breaking
      "@outfitter/config": "^0.1.0", // 0.1.0 -> 0.1.0 up-to-date
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.5",
      "@outfitter/config": "0.1.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const val = result.value;

    expect(val.total).toBe(3);
    expect(val.updatesAvailable).toBe(2);
    expect(val.hasBreaking).toBe(true);

    // Non-applied in read-only mode
    expect(val.applied).toBe(false);
    expect(val.appliedPackages).toHaveLength(0);

    // Breaking updates are still tracked in skippedBreaking
    expect(val.skippedBreaking).toContain("@outfitter/contracts");
  });

  test("handles npm lookup failures gracefully", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    // Only provide a version for contracts; cli lookup will "fail"
    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Both packages should be in the result
    expect(result.value.total).toBe(2);

    // The package with a failed lookup should have latest: null
    const cli = result.value.packages.find((p) => p.name === "@outfitter/cli");
    expect(cli).toBeDefined();
    expect(cli?.latest).toBeNull();
    expect(cli?.updateAvailable).toBe(false);
  });
});

// =============================================================================
// Apply Flow — end-to-end with Bun.spawn mock
// =============================================================================

describe("integration: apply flow with mocked Bun.spawn", () => {
  test("runUpdate({ apply: true }) writes package.json and invokes bun install", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.1.3",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Verify apply was performed
    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/contracts");
    expect(result.value.appliedPackages).toContain("@outfitter/cli");

    // Verify package.json was mutated
    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.1.5");
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("^0.1.3");

    // Verify bun install was called exactly once
    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(1);
  });

  test("apply skips breaking updates and only applies non-breaking ones", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
      "@outfitter/config": "^0.1.0",
    });

    // contracts: 0.1.0 -> 0.2.0 (breaking: pre-1.0 minor bump)
    // cli: 0.1.0 -> 0.1.3 (non-breaking: patch)
    // config: 0.1.0 -> 0.1.0 (no update)
    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.3",
      "@outfitter/config": "0.1.0",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toEqual(["@outfitter/cli"]);
    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");

    // Verify selective update in package.json
    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("^0.1.3");
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.1.0"); // unchanged
    expect(pkg.dependencies?.["@outfitter/config"]).toBe("^0.1.0"); // unchanged
  });

  test("apply --breaking includes breaking updates in the apply set", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0", // breaking
      "@outfitter/cli": "0.1.3", // non-breaking
    });

    const result = await runUpdate({
      cwd: tempDir,
      apply: true,
      breaking: true,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/contracts");
    expect(result.value.appliedPackages).toContain("@outfitter/cli");
    expect(result.value.skippedBreaking).toHaveLength(0);

    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/contracts"]).toBe("^0.2.0");
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("^0.1.3");
  });

  test("apply with workspace updates all manifests and runs install once at root", async () => {
    // Set up a monorepo workspace
    writeJson(join(tempDir, "package.json"), {
      name: "monorepo",
      workspaces: ["packages/*"],
    });

    writeJson(join(tempDir, "packages", "pkg-a", "package.json"), {
      name: "pkg-a",
      version: "1.0.0",
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    writeJson(join(tempDir, "packages", "pkg-b", "package.json"), {
      name: "pkg-b",
      version: "1.0.0",
      dependencies: {
        "@outfitter/cli": "^0.1.0",
        "@outfitter/config": "^0.1.0",
      },
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
      "@outfitter/config": "0.1.2",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/cli");
    expect(result.value.appliedPackages).toContain("@outfitter/config");

    // Both manifests should have updated versions
    const pkgA = readPackageJson(join(tempDir, "packages", "pkg-a"));
    const pkgB = readPackageJson(join(tempDir, "packages", "pkg-b"));

    expect(pkgA.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");
    expect(pkgB.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");
    expect(pkgB.dependencies?.["@outfitter/config"]).toBe("^0.1.2");

    // bun install runs once at the workspace root
    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(1);
    expect(installCalls[0]?.cwd).toBe(resolve(tempDir));
  });
});

// =============================================================================
// Breaking Classification — pre-1.0 semver convention
// =============================================================================

describe("integration: breaking classification for pre-1.0 packages", () => {
  test("pre-1.0 minor bump (0.1.0 -> 0.2.0) is classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts).toBeDefined();
    expect(contracts?.breaking).toBe(true);
    expect(contracts?.updateAvailable).toBe(true);
    expect(result.value.hasBreaking).toBe(true);
  });

  test("pre-1.0 patch bump (0.1.0 -> 0.1.5) is NOT classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts).toBeDefined();
    expect(contracts?.breaking).toBe(false);
    expect(contracts?.updateAvailable).toBe(true);
    expect(result.value.hasBreaking).toBe(false);
  });

  test("major bump (1.0.0 -> 2.0.0) is classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^1.0.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "2.0.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts?.breaking).toBe(true);
    expect(result.value.hasBreaking).toBe(true);
  });

  test("stable minor bump (1.0.0 -> 1.1.0) is NOT classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^1.0.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "1.1.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const contracts = result.value.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    expect(contracts?.breaking).toBe(false);
    expect(contracts?.updateAvailable).toBe(true);
  });

  test("0.x to 1.0.0 jump is classified as breaking", async () => {
    writePackageJson(tempDir, {
      "@outfitter/cli": "^0.5.0",
    });

    mockNpmAndInstall({
      "@outfitter/cli": "1.0.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const cli = result.value.packages.find((p) => p.name === "@outfitter/cli");
    expect(cli?.breaking).toBe(true);
  });

  test("mixed breaking and non-breaking across multiple packages", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
      "@outfitter/config": "^1.0.0",
      "@outfitter/logging": "^1.0.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0", // breaking (pre-1.0 minor)
      "@outfitter/cli": "0.1.5", // non-breaking (patch)
      "@outfitter/config": "2.0.0", // breaking (major)
      "@outfitter/logging": "1.1.0", // non-breaking (stable minor)
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const val = result.value;
    expect(val.total).toBe(4);
    expect(val.updatesAvailable).toBe(4);
    expect(val.hasBreaking).toBe(true);

    // Check individual classifications
    const contracts = val.packages.find(
      (p) => p.name === "@outfitter/contracts"
    );
    const cli = val.packages.find((p) => p.name === "@outfitter/cli");
    const config = val.packages.find((p) => p.name === "@outfitter/config");
    const logging = val.packages.find((p) => p.name === "@outfitter/logging");

    expect(contracts?.breaking).toBe(true);
    expect(cli?.breaking).toBe(false);
    expect(config?.breaking).toBe(true);
    expect(logging?.breaking).toBe(false);

    // skippedBreaking should list both breaking packages
    expect(val.skippedBreaking).toContain("@outfitter/contracts");
    expect(val.skippedBreaking).toContain("@outfitter/config");
    expect(val.skippedBreaking).not.toContain("@outfitter/cli");
    expect(val.skippedBreaking).not.toContain("@outfitter/logging");
  });
});

// =============================================================================
// Guide Output — structured migration guides
// =============================================================================

describe("integration: guide output via runUpdate({ guide: true })", () => {
  test("returns migration guides when guide option is set", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toBeInstanceOf(Array);
    expect(result.value.guides?.length).toBeGreaterThan(0);

    // Both packages have updates, so both should have guides
    const contractsGuide = result.value.guides?.find(
      (g) => g.packageName === "@outfitter/contracts"
    );
    const cliGuide = result.value.guides?.find(
      (g) => g.packageName === "@outfitter/cli"
    );

    expect(contractsGuide).toBeDefined();
    expect(contractsGuide?.fromVersion).toBe("0.1.0");
    expect(contractsGuide?.toVersion).toBe("0.2.0");
    expect(contractsGuide?.breaking).toBe(true);

    expect(cliGuide).toBeDefined();
    expect(cliGuide?.fromVersion).toBe("0.1.0");
    expect(cliGuide?.toVersion).toBe("0.1.5");
    expect(cliGuide?.breaking).toBe(false);
  });

  test("guides include correct metadata even without local migration docs", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpdate({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(1);

    expect(result.value.guides?.[0]?.packageName).toBe("@outfitter/contracts");
    expect(result.value.guides?.[0]?.fromVersion).toBe("0.1.0");
    expect(result.value.guides?.[0]?.toVersion).toBe("0.2.0");
    expect(result.value.guides?.[0]?.breaking).toBe(true);
    // steps may or may not be populated depending on whether migration
    // docs are discoverable via parent directory walk
    expect(Array.isArray(result.value.guides?.[0]?.steps)).toBe(true);
  });

  test("guides include migration doc content when docs directory exists", async () => {
    // Create a migration docs directory in the temp project
    const migrationsDir = join(tempDir, "plugins/outfitter/shared/migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeMigrationDoc(
      migrationsDir,
      "contracts",
      "0.2.0",
      "Step 1: Update all import paths\n\nStep 2: Run the codemod"
    );

    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpdate({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(1);

    expect(result.value.guides?.[0]?.packageName).toBe("@outfitter/contracts");
    expect(result.value.guides?.[0]?.breaking).toBe(true);
    expect(result.value.guides?.[0]?.steps.length).toBeGreaterThan(0);
    expect(result.value.guides?.[0]?.steps[0]).toContain(
      "Update all import paths"
    );
  });

  test("guides are not included when guide option is not set", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeUndefined();
  });

  test("guides are empty when no packages have updates", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.5",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir, guide: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.guides).toBeDefined();
    expect(result.value.guides).toHaveLength(0);
  });

  test("guide combined with apply returns both guides and apply result", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0", // breaking — skipped by apply
      "@outfitter/cli": "0.1.3", // non-breaking — applied
    });

    const result = await runUpdate({
      cwd: tempDir,
      apply: true,
      guide: true,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Apply results
    expect(result.value.applied).toBe(true);
    expect(result.value.appliedPackages).toContain("@outfitter/cli");
    expect(result.value.skippedBreaking).toContain("@outfitter/contracts");

    // Guide results
    expect(result.value.guides).toBeDefined();
    expect(result.value.guides?.length).toBeGreaterThan(0);

    const contractsGuide = result.value.guides?.find(
      (g) => g.packageName === "@outfitter/contracts"
    );
    expect(contractsGuide?.breaking).toBe(true);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("integration: edge cases", () => {
  test("empty project with no @outfitter/* deps returns zero counts", async () => {
    writePackageJson(tempDir, { zod: "^3.0.0", commander: "^14.0.0" });

    mockNpmAndInstall({});

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.total).toBe(0);
    expect(result.value.updatesAvailable).toBe(0);
    expect(result.value.hasBreaking).toBe(false);
    expect(result.value.packages).toHaveLength(0);
    expect(result.value.applied).toBe(false);
  });

  test("no package.json returns an error result", async () => {
    mockNpmAndInstall({});

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("No package.json found");
    }
  });

  test("all packages up to date with --apply is a no-op", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.5",
      "@outfitter/cli": "^0.1.3",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.1.3",
    });

    const result = await runUpdate({ cwd: tempDir, apply: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(false);
    expect(result.value.appliedPackages).toHaveLength(0);
    expect(result.value.updatesAvailable).toBe(0);

    // bun install should NOT be called
    const installCalls = spawnCalls.filter(
      (c) => c.cmd[0] === "bun" && c.cmd[1] === "install"
    );
    expect(installCalls).toHaveLength(0);
  });

  test("workspace:* protocol deps are excluded from scanning", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "workspace:*",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpdate({ cwd: tempDir });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // workspace:* should be excluded, only cli should appear
    expect(result.value.total).toBe(1);
    expect(result.value.packages[0]?.name).toBe("@outfitter/cli");
  });
});
