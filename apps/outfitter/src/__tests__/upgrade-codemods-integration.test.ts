/**
 * Integration tests for codemod execution with outfitter upgrade.
 *
 * Tests the full flow: discover codemods from migration docs,
 * execute them against target code, and verify transformations.
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
import { discoverCodemods, runCodemod } from "../commands/upgrade-codemods.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-codemod-int-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
// Reference Codemod: TUI Import Migration
// =============================================================================

describe("TUI import migration codemod", () => {
  test("rewrites @outfitter/cli/render to @outfitter/tui/render", async () => {
    const targetDir = join(tempDir, "project");
    mkdirSync(join(targetDir, "src"), { recursive: true });

    writeFileSync(
      join(targetDir, "src/index.ts"),
      `import { renderTable } from "@outfitter/cli/render";
import { output } from "@outfitter/cli";

renderTable(data);
output(result);
`
    );

    // Use the real codemod from the repo
    const codemodPath = join(
      import.meta.dir,
      "../../../../plugins/outfitter/shared/codemods/cli/0.4.0-move-tui-imports.ts"
    );

    const result = await runCodemod(codemodPath, targetDir, false);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/index.ts");
    }

    const updated = readFileSync(join(targetDir, "src/index.ts"), "utf-8");
    expect(updated).toContain("@outfitter/tui/render");
    expect(updated).not.toContain("@outfitter/cli/render");
    // Core CLI import should be untouched
    expect(updated).toContain("@outfitter/cli");
  });

  test("rewrites multiple import paths in one file", async () => {
    const targetDir = join(tempDir, "project");
    mkdirSync(join(targetDir, "src"), { recursive: true });

    writeFileSync(
      join(targetDir, "src/app.ts"),
      `import { renderTable } from "@outfitter/cli/render";
import { createSpinner } from "@outfitter/cli/streaming";
import { confirmDestructive } from "@outfitter/cli/input";
`
    );

    const codemodPath = join(
      import.meta.dir,
      "../../../../plugins/outfitter/shared/codemods/cli/0.4.0-move-tui-imports.ts"
    );

    const result = await runCodemod(codemodPath, targetDir, false);

    expect(result.isOk()).toBe(true);

    const updated = readFileSync(join(targetDir, "src/app.ts"), "utf-8");
    expect(updated).toContain("@outfitter/tui/render");
    expect(updated).toContain("@outfitter/tui/streaming");
    expect(updated).toContain("@outfitter/tui/confirm");
    expect(updated).not.toContain("@outfitter/cli/render");
    expect(updated).not.toContain("@outfitter/cli/streaming");
    expect(updated).not.toContain("@outfitter/cli/input");
  });

  test("dry run does not modify files", async () => {
    const targetDir = join(tempDir, "project");
    mkdirSync(join(targetDir, "src"), { recursive: true });

    const originalContent = `import { renderTable } from "@outfitter/cli/render";\n`;
    writeFileSync(join(targetDir, "src/index.ts"), originalContent);

    const codemodPath = join(
      import.meta.dir,
      "../../../../plugins/outfitter/shared/codemods/cli/0.4.0-move-tui-imports.ts"
    );

    const result = await runCodemod(codemodPath, targetDir, true);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/index.ts");
    }

    // File should NOT be modified in dry run
    const content = readFileSync(join(targetDir, "src/index.ts"), "utf-8");
    expect(content).toBe(originalContent);
  });

  test("skips files without matching imports", async () => {
    const targetDir = join(tempDir, "project");
    mkdirSync(join(targetDir, "src"), { recursive: true });

    writeFileSync(
      join(targetDir, "src/utils.ts"),
      `import { something } from "other-package";\n`
    );

    const codemodPath = join(
      import.meta.dir,
      "../../../../plugins/outfitter/shared/codemods/cli/0.4.0-move-tui-imports.ts"
    );

    const result = await runCodemod(codemodPath, targetDir, false);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toHaveLength(0);
    }
  });

  test("does not rewrite plain string literals outside import statements", async () => {
    const targetDir = join(tempDir, "project");
    mkdirSync(join(targetDir, "src"), { recursive: true });

    const source = `const docsRef = "@outfitter/cli/render";
const message = "replace @outfitter/cli/streaming manually";
`;
    writeFileSync(join(targetDir, "src/notes.ts"), source);

    const codemodPath = join(
      import.meta.dir,
      "../../../../plugins/outfitter/shared/codemods/cli/0.4.0-move-tui-imports.ts"
    );

    const result = await runCodemod(codemodPath, targetDir, false);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toHaveLength(0);
    }

    const updated = readFileSync(join(targetDir, "src/notes.ts"), "utf-8");
    expect(updated).toBe(source);
  });

  test("skips node_modules and dist directories", async () => {
    const targetDir = join(tempDir, "project");
    mkdirSync(join(targetDir, "src"), { recursive: true });
    mkdirSync(join(targetDir, "node_modules/pkg"), { recursive: true });
    mkdirSync(join(targetDir, "dist"), { recursive: true });

    writeFileSync(
      join(targetDir, "src/index.ts"),
      `import { renderTable } from "@outfitter/cli/render";\n`
    );
    writeFileSync(
      join(targetDir, "node_modules/pkg/index.ts"),
      `import { renderTable } from "@outfitter/cli/render";\n`
    );
    writeFileSync(
      join(targetDir, "dist/index.js"),
      `import { renderTable } from "@outfitter/cli/render";\n`
    );

    const codemodPath = join(
      import.meta.dir,
      "../../../../plugins/outfitter/shared/codemods/cli/0.4.0-move-tui-imports.ts"
    );

    const result = await runCodemod(codemodPath, targetDir, false);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Only src/index.ts should be changed
      expect(result.value.changedFiles).toEqual(["src/index.ts"]);
    }
  });
});

// =============================================================================
// Discovery + Execution Integration
// =============================================================================

describe("codemod discovery and execution integration", () => {
  test("discovers and runs codemods from migration frontmatter", async () => {
    const migrationsDir = join(tempDir, "migrations");
    const codemodsDir = join(tempDir, "codemods");
    const targetDir = join(tempDir, "target/src");
    mkdirSync(migrationsDir, { recursive: true });
    mkdirSync(join(codemodsDir, "cli"), { recursive: true });
    mkdirSync(targetDir, { recursive: true });

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
    codemod: "cli/test-codemod.ts"
---

# Content`
    );

    // Create a simple test codemod
    writeFileSync(
      join(codemodsDir, "cli/test-codemod.ts"),
      `export async function transform(options) {
  const { readFileSync, writeFileSync } = require("node:fs");
  const { join } = require("node:path");
  const glob = new Bun.Glob("**/*.ts");
  const changedFiles = [];
  for (const entry of glob.scanSync({ cwd: options.targetDir })) {
    const absPath = join(options.targetDir, entry);
    const content = readFileSync(absPath, "utf-8");
    if (content.includes("@outfitter/cli/render")) {
      const updated = content.replaceAll("@outfitter/cli/render", "@outfitter/tui/render");
      if (!options.dryRun) writeFileSync(absPath, updated);
      changedFiles.push(entry);
    }
  }
  return { changedFiles, skippedFiles: [], errors: [] };
}`
    );

    // Create a target file
    writeFileSync(
      join(targetDir, "app.ts"),
      `import { renderTable } from "@outfitter/cli/render";\n`
    );

    // Discover codemods
    const codemods = discoverCodemods(
      migrationsDir,
      codemodsDir,
      "cli",
      "0.3.0",
      "0.4.0"
    );

    expect(codemods).toHaveLength(1);

    const firstCodemod = codemods[0];
    expect(firstCodemod).toBeDefined();

    // Run the discovered codemod
    const result = await runCodemod(
      firstCodemod?.absolutePath ?? "",
      join(tempDir, "target"),
      false
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toHaveLength(1);
    }

    // Verify the file was transformed
    const updated = readFileSync(join(targetDir, "app.ts"), "utf-8");
    expect(updated).toContain("@outfitter/tui/render");
  });
});
