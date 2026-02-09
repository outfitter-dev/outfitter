/**
 * Tests for `outfitter update` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findMigrationDocsDir,
  readMigrationDocs,
  runUpdate,
} from "../commands/update.js";

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

// =============================================================================
// Migration Doc Discovery Tests
// =============================================================================

describe("findMigrationDocsDir", () => {
  test("finds docs relative to cwd", () => {
    // Create the migration docs directory structure in the temp dir
    const migrationsDir = join(tempDir, "plugins/kit/shared/migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, "README.md"), "# Migrations");

    const result = findMigrationDocsDir(tempDir);

    expect(result).toBe(migrationsDir);
  });

  test("walks up parent directories to find monorepo root", () => {
    // Create a "monorepo root" with migrations dir
    const monoRoot = join(tempDir, "monorepo");
    const migrationsDir = join(monoRoot, "plugins/kit/shared/migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, "README.md"), "# Migrations");

    // Create a nested child directory (simulating a package inside monorepo)
    const childDir = join(monoRoot, "packages/my-app/src");
    mkdirSync(childDir, { recursive: true });

    const result = findMigrationDocsDir(childDir);

    expect(result).toBe(migrationsDir);
  });

  test("does not find migrations via cwd or parent walk when none exist", () => {
    const isolatedDir = join(tempDir, "isolated/deep/path");
    mkdirSync(isolatedDir, { recursive: true });

    // Pass a non-existent binaryDir to disable phase 3 (binary-relative fallback)
    const result = findMigrationDocsDir(isolatedDir, join(tempDir, "no-binary"));

    expect(result).toBeNull();
  });
});

// =============================================================================
// Migration Doc Reading Tests
// =============================================================================

describe("readMigrationDocs", () => {
  test("returns all docs between fromVersion and toVersion", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    // Create docs for versions 0.2.0, 0.3.0, 0.4.0
    writeMigrationDoc(migrationsDir, "contracts", "0.2.0", "Changes for 0.2.0");
    writeMigrationDoc(migrationsDir, "contracts", "0.3.0", "Changes for 0.3.0");
    writeMigrationDoc(migrationsDir, "contracts", "0.4.0", "Changes for 0.4.0");

    // From 0.1.0 to 0.4.0 should include all three
    const docs = readMigrationDocs(
      migrationsDir,
      "contracts",
      "0.1.0",
      "0.4.0"
    );

    expect(docs).toHaveLength(3);
    expect(docs[0]).toContain("Changes for 0.2.0");
    expect(docs[1]).toContain("Changes for 0.3.0");
    expect(docs[2]).toContain("Changes for 0.4.0");
  });

  test("excludes docs at or below fromVersion", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeMigrationDoc(migrationsDir, "cli", "0.1.0", "Already installed");
    writeMigrationDoc(migrationsDir, "cli", "0.2.0", "New version");

    const docs = readMigrationDocs(migrationsDir, "cli", "0.1.0", "0.2.0");

    expect(docs).toHaveLength(1);
    expect(docs[0]).toContain("New version");
  });

  test("excludes docs above toVersion", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeMigrationDoc(migrationsDir, "config", "0.2.0", "In range");
    writeMigrationDoc(migrationsDir, "config", "0.5.0", "Future version");

    const docs = readMigrationDocs(migrationsDir, "config", "0.1.0", "0.3.0");

    expect(docs).toHaveLength(1);
    expect(docs[0]).toContain("In range");
  });

  test("returns docs sorted by version ascending", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    // Write in non-ascending order
    writeMigrationDoc(migrationsDir, "types", "0.4.0", "v0.4.0 changes");
    writeMigrationDoc(migrationsDir, "types", "0.2.0", "v0.2.0 changes");
    writeMigrationDoc(migrationsDir, "types", "0.3.0", "v0.3.0 changes");

    const docs = readMigrationDocs(migrationsDir, "types", "0.1.0", "0.5.0");

    expect(docs).toHaveLength(3);
    expect(docs[0]).toContain("v0.2.0 changes");
    expect(docs[1]).toContain("v0.3.0 changes");
    expect(docs[2]).toContain("v0.4.0 changes");
  });

  test("returns empty array when no docs match", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeMigrationDoc(migrationsDir, "other-pkg", "0.2.0", "Wrong package");

    const docs = readMigrationDocs(
      migrationsDir,
      "contracts",
      "0.1.0",
      "0.3.0"
    );

    expect(docs).toHaveLength(0);
  });

  test("strips frontmatter from doc content", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeMigrationDoc(migrationsDir, "logging", "0.2.0", "Clean content here");

    const docs = readMigrationDocs(migrationsDir, "logging", "0.1.0", "0.2.0");

    expect(docs).toHaveLength(1);
    expect(docs[0]).not.toContain("---");
    expect(docs[0]).toContain("Clean content here");
  });
});

// =============================================================================
// Migration Doc Test Helpers
// =============================================================================

function writeMigrationDoc(
  dir: string,
  shortName: string,
  version: string,
  body: string
): void {
  const filename = `outfitter-${shortName}-${version}.md`;
  const content = `---\npackage: "@outfitter/${shortName}"\nversion: ${version}\nbreaking: false\n---\n\n${body}\n`;
  writeFileSync(join(dir, filename), content);
}
