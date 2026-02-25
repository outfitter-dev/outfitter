/**
 * Tests for `outfitter init` workspace and dependency rewriting behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Manifest } from "../manifest.js";
import {
  setupInitTestHarness,
  tempDir,
  workspaceVersion,
} from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init command local dependency rewriting", () => {
  test("rewrites @outfitter dependencies to workspace:* when local is enabled", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "cli",
      local: true,
      force: false,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.dependencies["@outfitter/contracts"]).toBe(
      "workspace:*"
    );
    expect(packageJson.dependencies["@outfitter/cli"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/logging"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/config"]).toBeUndefined();
    expect(packageJson.dependencies.commander).toBe("^14.0.2");
  });
});

// =============================================================================
// Init Command Workspace Scaffolding Tests
// =============================================================================

describe("init command workspace scaffolding", () => {
  test("rejects path traversal in workspace project name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "../escaped",
      preset: "cli",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Invalid package name");
    }
    expect(existsSync(join(tempDir, "apps", "escaped"))).toBe(false);
  });

  test("rejects absolute path style workspace project names", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "/tmp/outside-root",
      preset: "cli",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Invalid package name");
    }
  });

  test("scaffolds workspace root and places runnable preset under apps/", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const rootPackageJsonPath = join(tempDir, "package.json");
    expect(existsSync(rootPackageJsonPath)).toBe(true);
    const rootPackageJson = JSON.parse(
      readFileSync(rootPackageJsonPath, "utf-8")
    );
    expect(rootPackageJson.name).toBe("acme-workspace");
    expect(rootPackageJson.private).toBe(true);
    expect(rootPackageJson.workspaces).toEqual(["apps/*", "packages/*"]);

    // Workspace root README
    const readmePath = join(tempDir, "README.md");
    expect(existsSync(readmePath)).toBe(true);
    const readme = readFileSync(readmePath, "utf-8");
    expect(readme).toContain("acme-workspace");
    expect(readme).toContain("apps/");
    expect(readme).toContain("packages/");

    const projectPackageJsonPath = join(
      tempDir,
      "apps",
      "my-mcp",
      "package.json"
    );
    expect(existsSync(projectPackageJsonPath)).toBe(true);

    const projectPackageJson = JSON.parse(
      readFileSync(projectPackageJsonPath, "utf-8")
    );
    expect(projectPackageJson.name).toBe("@acme/my-mcp");
    expect(result.value.structure).toBe("workspace");
    expect(result.value.projectDir).toBe(join(tempDir, "apps", "my-mcp"));
  });

  test("renders scoped workspace README examples without double @", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "@acme/workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const readmePath = join(tempDir, "README.md");
    const readme = readFileSync(readmePath, "utf-8");

    expect(readme).toContain("outfitter init --name @acme/my-app --preset cli");
    expect(readme).toContain(
      "outfitter init --name @acme/my-lib --preset library"
    );
    expect(readme).not.toContain("@@acme");
  });

  test("renders workspace README examples with npm-safe scope for unsanitized workspace names", async () => {
    const { buildWorkspaceRootReadme } = await import("../engine/workspace.js");

    const readme = buildWorkspaceRootReadme("My Cool Project");

    expect(readme).toContain(
      "outfitter init --name @my-cool-project/my-app --preset cli"
    );
    expect(readme).toContain(
      "outfitter init --name @my-cool-project/my-lib --preset library"
    );
    expect(readme).not.toContain("@My Cool Project/");
  });

  test("stamps manifest inside workspace project directory", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-tool",
      preset: "minimal",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);

    const projectDir = join(tempDir, "packages", "my-tool");
    const manifestPath = join(projectDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["scaffolding"]).toBeDefined();
  });

  test("dry-run workspace init does not write workspace root files", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      dryRun: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.dryRunPlan).toBeDefined();
    expect(existsSync(join(tempDir, "package.json"))).toBe(false);
    expect(existsSync(join(tempDir, "apps"))).toBe(false);
    expect(existsSync(join(tempDir, "packages"))).toBe(false);

    const operations = result.value.dryRunPlan?.operations ?? [];
    const readmeOp = operations.find((op) => {
      if (!op || typeof op !== "object") {
        return false;
      }
      const candidate = op as { type?: string; path?: string };
      return (
        candidate.path === join(tempDir, "README.md") &&
        (candidate.type === "file-create" ||
          candidate.type === "file-overwrite")
      );
    });
    expect(readmeOp).toBeDefined();
  });
});
