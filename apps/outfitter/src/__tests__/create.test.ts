/**
 * Tests for `outfitter create` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-create-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

describe("create command", () => {
  test("scaffolds a single-package preset", async () => {
    const { runCreate } = await import("../commands/create.js");

    const result = await runCreate({
      targetDir: tempDir,
      name: "my-cli",
      preset: "cli",
      structure: "single",
      yes: true,
      force: false,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const packageJsonPath = join(tempDir, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("my-cli");
    expect(packageJson.dependencies["@outfitter/kit"]).toBeDefined();
    expect(result.value.structure).toBe("single");
  });

  test("scaffolds a workspace layout with project under packages/", async () => {
    const { runCreate } = await import("../commands/create.js");

    const result = await runCreate({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
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
    expect(rootPackageJson.workspaces).toEqual(["packages/*"]);

    const projectPackageJsonPath = join(
      tempDir,
      "packages",
      "my-mcp",
      "package.json"
    );
    expect(existsSync(projectPackageJsonPath)).toBe(true);

    const projectPackageJson = JSON.parse(
      readFileSync(projectPackageJsonPath, "utf-8")
    );
    expect(projectPackageJson.name).toBe("@acme/my-mcp");
    expect(result.value.structure).toBe("workspace");
  });

  test("supports local workspace dependency rewriting", async () => {
    const { runCreate } = await import("../commands/create.js");

    const result = await runCreate({
      targetDir: tempDir,
      name: "local-cli",
      preset: "cli",
      structure: "single",
      local: true,
      yes: true,
      force: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.dependencies["@outfitter/kit"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/cli"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/logging"]).toBe("workspace:*");
  });

  test("does not overwrite existing template files without force", async () => {
    const { runCreate } = await import("../commands/create.js");

    const existingReadmePath = join(tempDir, "README.md");
    writeFileSync(existingReadmePath, "existing README\n", "utf-8");

    const result = await runCreate({
      targetDir: tempDir,
      name: "existing-files",
      preset: "cli",
      structure: "single",
      yes: true,
      force: false,
    });

    expect(result.isErr()).toBe(true);
    expect(readFileSync(existingReadmePath, "utf-8")).toBe("existing README\n");
  });
});
