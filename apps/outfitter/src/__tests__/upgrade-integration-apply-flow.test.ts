/**
 * Integration tests for `outfitter upgrade` apply-flow behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { runUpgrade } from "../commands/upgrade.js";
import {
  mockNpmAndInstall,
  readPackageJson,
  setupUpgradeIntegrationHarness,
  spawnCalls,
  tempDir,
  writeJson,
  writePackageJson,
} from "./helpers/upgrade-integration-harness.js";

setupUpgradeIntegrationHarness();

describe("integration: apply flow with mocked Bun.spawn", () => {
  test("runUpgrade({ yes: true }) writes package.json and invokes bun install", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.1.5",
      "@outfitter/cli": "0.1.3",
    });

    const result = await runUpgrade({ cwd: tempDir, yes: true });

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

    const result = await runUpgrade({ cwd: tempDir, yes: true });

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

  test("apply --all includes breaking updates in the apply set", async () => {
    writePackageJson(tempDir, {
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "^0.1.0",
    });

    mockNpmAndInstall({
      "@outfitter/contracts": "0.2.0", // breaking
      "@outfitter/cli": "0.1.3", // non-breaking
    });

    const result = await runUpgrade({
      cwd: tempDir,
      yes: true,
      all: true,
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

    const result = await runUpgrade({ cwd: tempDir, yes: true });

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

  test("apply from nested cwd runs codemods against the workspace root", async () => {
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
      dependencies: { "@outfitter/cli": "^0.1.0" },
    });

    const targetFile = join(tempDir, "packages", "pkg-b", "src", "feature.ts");
    mkdirSync(join(targetFile, ".."), { recursive: true });
    writeFileSync(targetFile, 'export const marker = "legacy-token";\n');

    const migrationsDir = join(tempDir, "plugins/outfitter/shared/migrations");
    const codemodsDir = join(tempDir, "plugins/outfitter/shared/codemods/cli");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(codemodsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.1.5.md"),
      `---
package: "@outfitter/cli"
version: 0.1.5
breaking: false
changes:
  - type: moved
    from: "legacy-token"
    to: "new-token"
    codemod: "cli/test-codemod.ts"
---

# Migration`
    );

    writeFileSync(
      join(codemodsDir, "test-codemod.ts"),
      `export async function transform(options) {
  const { readFileSync, writeFileSync } = require("node:fs");
  const { join } = require("node:path");
  const changedFiles = [];
  const glob = new Bun.Glob("**/*.ts");
  for (const entry of glob.scanSync({ cwd: options.targetDir })) {
    const absPath = join(options.targetDir, entry);
    const content = readFileSync(absPath, "utf-8");
    if (!content.includes("legacy-token")) continue;
    const updated = content.replaceAll("legacy-token", "new-token");
    if (!options.dryRun) writeFileSync(absPath, updated);
    changedFiles.push(entry);
  }
  return { changedFiles, skippedFiles: [], errors: [] };
}`
    );

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    const nestedCwd = join(tempDir, "packages", "pkg-a");
    const result = await runUpgrade({ cwd: nestedCwd, yes: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.codemods?.codemodCount).toBe(1);
    expect(result.value.codemods?.changedFiles).toContain(
      "packages/pkg-b/src/feature.ts"
    );

    const updated = readFileSync(targetFile, "utf-8");
    expect(updated).toContain("new-token");
    expect(updated).not.toContain("legacy-token");
  });

  test("apply with noCodemods skips codemod execution", async () => {
    writePackageJson(tempDir, {
      "@outfitter/cli": "^0.1.0",
    });

    const targetFile = join(tempDir, "src", "feature.ts");
    mkdirSync(join(targetFile, ".."), { recursive: true });
    writeFileSync(targetFile, 'export const marker = "legacy-token";\n');

    const migrationsDir = join(tempDir, "plugins/outfitter/shared/migrations");
    const codemodsDir = join(tempDir, "plugins/outfitter/shared/codemods/cli");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(codemodsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.1.5.md"),
      `---
package: "@outfitter/cli"
version: 0.1.5
breaking: false
changes:
  - type: moved
    from: "legacy-token"
    to: "new-token"
    codemod: "cli/test-codemod.ts"
---

# Migration`
    );

    writeFileSync(
      join(codemodsDir, "test-codemod.ts"),
      `export async function transform(options) {
  const { readFileSync, writeFileSync } = require("node:fs");
  const { join } = require("node:path");
  const file = join(options.targetDir, "src/feature.ts");
  const content = readFileSync(file, "utf-8");
  if (!options.dryRun) {
    writeFileSync(file, content.replaceAll("legacy-token", "new-token"));
  }
  return { changedFiles: ["src/feature.ts"], skippedFiles: [], errors: [] };
}`
    );

    mockNpmAndInstall({
      "@outfitter/cli": "0.1.5",
    });

    const result = await runUpgrade({
      cwd: tempDir,
      yes: true,
      noCodemods: true,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.applied).toBe(true);
    expect(result.value.codemods).toBeUndefined();

    const pkg = readPackageJson(tempDir);
    expect(pkg.dependencies?.["@outfitter/cli"]).toBe("^0.1.5");

    const unchanged = readFileSync(targetFile, "utf-8");
    expect(unchanged).toContain("legacy-token");
    expect(unchanged).not.toContain("new-token");
  });
});

// =============================================================================
// Breaking Classification — pre-1.0 semver convention
// =============================================================================
