/**
 * Tests for codemod runner and discovery.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CodemodResult,
  discoverCodemods,
  findCodemodsDir,
  runCodemod,
} from "../commands/upgrade-codemods.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-codemods-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
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
// findCodemodsDir
// =============================================================================

describe("findCodemodsDir", () => {
  test("finds codemods dir relative to cwd", () => {
    const codemodsDir = join(tempDir, "plugins/outfitter/shared/codemods");
    mkdirSync(codemodsDir, { recursive: true });

    const result = findCodemodsDir(tempDir);

    expect(result).toBe(codemodsDir);
  });

  test("walks up parent directories to find monorepo root", () => {
    const monoRoot = join(tempDir, "monorepo");
    const codemodsDir = join(monoRoot, "plugins/outfitter/shared/codemods");
    mkdirSync(codemodsDir, { recursive: true });

    const childDir = join(monoRoot, "packages/my-app/src");
    mkdirSync(childDir, { recursive: true });

    const result = findCodemodsDir(childDir);

    expect(result).toBe(codemodsDir);
  });

  test("returns null when no codemods dir found", () => {
    const isolatedDir = join(tempDir, "isolated/deep/path");
    mkdirSync(isolatedDir, { recursive: true });

    const result = findCodemodsDir(isolatedDir, join(tempDir, "no-binary"));

    expect(result).toBeNull();
  });
});

// =============================================================================
// discoverCodemods
// =============================================================================

describe("discoverCodemods", () => {
  test("discovers codemods referenced in migration frontmatter", () => {
    const migrationsDir = join(tempDir, "migrations");
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(join(codemodsDir, "cli"), { recursive: true });

    // Create migration doc with codemod reference
    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.4.0.md"),
      `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "cli/0.4.0-move-tui-imports.ts"
---

# Content`
    );

    // Create the codemod file
    writeFileSync(
      join(codemodsDir, "cli/0.4.0-move-tui-imports.ts"),
      "export async function transform() { return { changedFiles: [], skippedFiles: [], errors: [] }; }"
    );

    const codemods = discoverCodemods(
      migrationsDir,
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toHaveLength(1);
    expect(codemods[0]?.relativePath).toBe("cli/0.4.0-move-tui-imports.ts");
    expect(codemods[0]?.absolutePath).toBe(
      join(codemodsDir, "cli/0.4.0-move-tui-imports.ts")
    );
  });

  test("deduplicates codemods referenced multiple times", () => {
    const migrationsDir = join(tempDir, "migrations");
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(join(codemodsDir, "cli"), { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.4.0.md"),
      `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "cli/0.4.0-move-tui-imports.ts"
  - type: moved
    from: "@outfitter/cli/streaming"
    to: "@outfitter/tui/streaming"
    codemod: "cli/0.4.0-move-tui-imports.ts"
---

# Content`
    );

    writeFileSync(
      join(codemodsDir, "cli/0.4.0-move-tui-imports.ts"),
      "export async function transform() { return { changedFiles: [], skippedFiles: [], errors: [] }; }"
    );

    const codemods = discoverCodemods(
      migrationsDir,
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toHaveLength(1);
  });

  test("returns empty array when no codemods referenced", () => {
    const migrationsDir = join(tempDir, "migrations");
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(codemodsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.4.0.md"),
      `---\npackage: "@outfitter/cli"\nversion: 0.4.0\nbreaking: true\n---\n\n# No codemods`
    );

    const codemods = discoverCodemods(
      migrationsDir,
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toHaveLength(0);
  });

  test("skips codemods whose files don't exist on disk", () => {
    const migrationsDir = join(tempDir, "migrations");
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(codemodsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.4.0.md"),
      `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "cli/nonexistent.ts"
---

# Content`
    );

    const codemods = discoverCodemods(
      migrationsDir,
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toHaveLength(0);
  });

  test("skips codemod paths that resolve outside the codemods directory", () => {
    const migrationsDir = join(tempDir, "migrations");
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(codemodsDir, { recursive: true });

    // File exists outside codemodsDir, but traversal reference should be rejected.
    writeFileSync(
      join(tempDir, "outside-codemod.ts"),
      "export async function transform() { return { changedFiles: [], skippedFiles: [], errors: [] }; }"
    );

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.4.0.md"),
      `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "../outside-codemod.ts"
---

# Content`
    );

    const codemods = discoverCodemods(
      migrationsDir,
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toHaveLength(0);
  });

  test("returns empty array when migrations directory cannot be read", () => {
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(codemodsDir, { recursive: true });

    const codemods = discoverCodemods(
      join(tempDir, "missing-migrations"),
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toEqual([]);
  });
});

// =============================================================================
// runCodemod
// =============================================================================

describe("runCodemod", () => {
  test("executes a codemod and returns result", async () => {
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(codemodsDir, { recursive: true });

    const targetDir = join(tempDir, "target");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "test.ts"), 'import { x } from "old";');

    // Create a simple codemod that reports files
    const codemodContent = `
export async function transform(options) {
  return {
    changedFiles: ["test.ts"],
    skippedFiles: [],
    errors: [],
  };
}`;
    writeFileSync(join(codemodsDir, "test-codemod.ts"), codemodContent);

    const result = await runCodemod(
      join(codemodsDir, "test-codemod.ts"),
      targetDir,
      false
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toEqual(["test.ts"]);
      expect(result.value.skippedFiles).toEqual([]);
      expect(result.value.errors).toEqual([]);
    }
  });

  test("passes dryRun flag to codemod", async () => {
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(codemodsDir, { recursive: true });

    const targetDir = join(tempDir, "target");
    mkdirSync(targetDir, { recursive: true });

    const codemodContent = `
export async function transform(options) {
  return {
    changedFiles: options.dryRun ? [] : ["file.ts"],
    skippedFiles: options.dryRun ? ["file.ts"] : [],
    errors: [],
  };
}`;
    writeFileSync(join(codemodsDir, "dry-codemod.ts"), codemodContent);

    const result = await runCodemod(
      join(codemodsDir, "dry-codemod.ts"),
      targetDir,
      true
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toEqual([]);
      expect(result.value.skippedFiles).toEqual(["file.ts"]);
    }
  });

  test("returns error for non-existent codemod", async () => {
    const result = await runCodemod(
      join(tempDir, "nonexistent.ts"),
      tempDir,
      false
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Failed to load codemod");
    }
  });

  test("returns error when codemod has no transform export", async () => {
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(codemodsDir, { recursive: true });

    writeFileSync(
      join(codemodsDir, "no-transform.ts"),
      "export const version = 1;"
    );

    const result = await runCodemod(
      join(codemodsDir, "no-transform.ts"),
      tempDir,
      false
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("no transform export");
    }
  });

  test("returns error when codemod transform result shape is invalid", async () => {
    const codemodsDir = join(tempDir, "codemods");
    mkdirSync(codemodsDir, { recursive: true });

    writeFileSync(
      join(codemodsDir, "invalid-result.ts"),
      `export async function transform() {
  return { changedFiles: "src/index.ts", skippedFiles: [], errors: [] };
}`
    );

    const result = await runCodemod(
      join(codemodsDir, "invalid-result.ts"),
      tempDir,
      false
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("invalid result shape");
    }
  });
});

// =============================================================================
// CodemodResult shape
// =============================================================================

describe("CodemodResult type", () => {
  test("has expected shape", () => {
    const result: CodemodResult = {
      changedFiles: ["src/index.ts", "src/utils.ts"],
      skippedFiles: ["src/test.ts"],
      errors: ["Could not parse src/broken.ts"],
    };

    expect(result.changedFiles).toHaveLength(2);
    expect(result.skippedFiles).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
