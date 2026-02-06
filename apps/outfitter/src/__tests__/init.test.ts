/**
 * Tests for `outfitter init` command.
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

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a temporary directory for testing.
 */
function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up a temporary directory.
 */
function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;
let originalIsTTY: boolean | undefined;

beforeEach(() => {
  originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    writable: true,
    configurable: true,
  });
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    writable: true,
    configurable: true,
  });
});

// =============================================================================
// Init Command File Creation Tests
// =============================================================================

describe("init command file creation", () => {
  test("creates package.json in target directory", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("test-project");
  });

  test("creates tsconfig.json extending @outfitter/tooling preset", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    const tsconfigPath = join(tempDir, "tsconfig.json");
    expect(existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.extends).toBe(
      "@outfitter/tooling/tsconfig.preset.bun.json"
    );
    expect(tsconfig.compilerOptions).toBeDefined();
  });

  test("creates src directory structure", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    const srcDir = join(tempDir, "src");
    expect(existsSync(srcDir)).toBe(true);
  });

  test("creates src/index.ts entry point", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    const indexPath = join(tempDir, "src", "index.ts");
    expect(existsSync(indexPath)).toBe(true);
  });
});

// =============================================================================
// Init Command Placeholder Replacement Tests
// =============================================================================

describe("init command placeholder replacement", () => {
  test("replaces {{packageName}} placeholder in package.json", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "my-awesome-project",
      template: "basic",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.name).toBe("my-awesome-project");
    // Ensure no unreplaced placeholders
    const content = readFileSync(packageJsonPath, "utf-8");
    expect(content).not.toContain("{{packageName}}");
  });

  test("replaces {{version}} placeholder with default version", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.version).toBe("0.1.0-rc.0");
    const content = readFileSync(packageJsonPath, "utf-8");
    expect(content).not.toContain("{{version}}");
  });

  test("replaces {{description}} placeholder", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");

    expect(content).not.toContain("{{description}}");
  });

  test("replaces legacy {{name}} placeholder in source files", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "my-awesome-project",
      template: "basic",
      force: false,
    });

    const indexPath = join(tempDir, "src", "index.ts");
    const content = readFileSync(indexPath, "utf-8");

    expect(content).toContain("my-awesome-project");
    expect(content).not.toContain("{{name}}");
  });
});

// =============================================================================
// Init Command Default Behavior Tests
// =============================================================================

describe("init command default behavior", () => {
  test("uses directory name as project name when not specified", async () => {
    const { runInit } = await import("../commands/init.js");

    const projectDir = join(tempDir, "my-project-dir");
    mkdirSync(projectDir, { recursive: true });

    await runInit({
      targetDir: projectDir,
      name: undefined,
      template: "basic",
      force: false,
    });

    const packageJsonPath = join(projectDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.name).toBe("my-project-dir");
  });

  test("uses 'basic' template by default", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: undefined,
      force: false,
    });

    // Should succeed without error using basic template
    const packageJsonPath = join(tempDir, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);
  });

  test("derives project name from scoped package name", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "@outfitter/scoped-project",
      template: "basic",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("@outfitter/scoped-project");

    const indexPath = join(tempDir, "src", "index.ts");
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("scoped-project");
    expect(content).toContain("@outfitter/scoped-project");
  });
});

// =============================================================================
// Init Command Local Dependency Rewrite Tests
// =============================================================================

describe("init command local dependency rewriting", () => {
  test("rewrites @outfitter dependencies to workspace:* when local is enabled", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "cli",
      local: true,
      force: false,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.dependencies["@outfitter/cli"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/config"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/contracts"]).toBe(
      "workspace:*"
    );
    expect(packageJson.dependencies["@outfitter/logging"]).toBe("workspace:*");
    expect(packageJson.dependencies.commander).toBe("^12.0.0");
  });
});

// =============================================================================
// Init Command Force Flag Tests
// =============================================================================

describe("init command --force flag", () => {
  test("fails without --force when directory has existing files", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("already has a package.json");
    }
  });

  test("overwrites existing files with --force flag", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      template: "basic",
      force: true,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("new-project");
  });
});

// =============================================================================
// Init Command Error Handling Tests
// =============================================================================

describe("init command error handling", () => {
  test("returns error for invalid template name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "nonexistent-template",
      force: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("template");
    }
  });

  test("returns error when target directory does not exist and cannot be created", async () => {
    const { runInit } = await import("../commands/init.js");

    // Use a path that cannot be created (under a file instead of a directory)
    const invalidPath = join(tempDir, "file.txt", "nested");
    writeFileSync(join(tempDir, "file.txt"), "content");

    const result = await runInit({
      targetDir: invalidPath,
      name: "test-project",
      template: "basic",
      force: false,
    });

    expect(result.isErr()).toBe(true);
  });
});

// =============================================================================
// Init Command Result Type Tests
// =============================================================================

describe("init command result type", () => {
  test("returns Ok result on success", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    expect(result.isOk()).toBe(true);
  });

  test("returns Err result on failure", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file without force flag
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
    });

    expect(result.isErr()).toBe(true);
  });
});

// =============================================================================
// Init Command Registry Blocks Tests
// =============================================================================

describe("init command registry blocks", () => {
  test("adds scaffolding by default in non-interactive mode", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      // No --with or --no-tooling specified, non-interactive mode
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Should have scaffolding files
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain("biome.json");
    }
  });

  test("does not add tooling when noTooling is true", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeUndefined();
    }
  });

  test("adds claude block when specified", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      with: "claude",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
    }

    // Verify file was actually created
    const settingsPath = join(tempDir, ".claude/settings.json");
    expect(existsSync(settingsPath)).toBe(true);
  });

  test("adds biome block with biome.json file", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      with: "biome",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      expect(result.value.blocksAdded?.created).toContain("biome.json");
      // Note: ultracite is already in SHARED_DEV_DEPS so it won't be in the added list
    }

    // Verify biome.json was created
    const biomePath = join(tempDir, "biome.json");
    expect(existsSync(biomePath)).toBe(true);
  });

  test("adds multiple blocks from comma-separated list", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      with: "claude,biome",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Should have files from both blocks
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain("biome.json");
    }
  });

  test("adds scaffolding block which extends all other blocks", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      with: "scaffolding",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Scaffolding creates files that don't exist in the template
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain("biome.json");
      expect(result.value.blocksAdded?.created).toContain(
        "scripts/bootstrap.sh"
      );
      // .lefthook.yml is skipped because template already creates it
      expect(result.value.blocksAdded?.skipped).toContain(".lefthook.yml");
    }
  });

  test("returns error for invalid block name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: "basic",
      force: false,
      with: "nonexistent-block",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("nonexistent-block");
    }
  });
});
