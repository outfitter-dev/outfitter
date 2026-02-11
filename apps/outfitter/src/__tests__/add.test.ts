import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { listBlocks, runAdd } from "../commands/add.js";
import type { Manifest } from "../manifest.js";

describe("runAdd", () => {
  const testDir = join(import.meta.dirname, ".test-add-output");

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
    // Create a minimal package.json
    writeFileSync(join(testDir, "package.json"), "{}");
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test("adds claude block files", async () => {
    const result = await runAdd({
      block: "claude",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.created).toContain(".claude/settings.json");
      expect(result.value.created).toContain(
        ".claude/hooks/format-code-on-stop.sh"
      );
    }

    // Verify files exist
    expect(existsSync(join(testDir, ".claude/settings.json"))).toBe(true);
    expect(
      existsSync(join(testDir, ".claude/hooks/format-code-on-stop.sh"))
    ).toBe(true);
  });

  test("adds biome block with devDependencies", async () => {
    const result = await runAdd({
      block: "biome",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.created).toContain("biome.json");
      expect(result.value.devDependencies.ultracite).toBe("^7.1.1");
    }

    // Verify package.json was updated
    const pkgContent = readFileSync(join(testDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgContent);
    expect(pkg.devDependencies?.ultracite).toBe("^7.1.1");
  });

  test("adds scaffolding block (composite)", async () => {
    const result = await runAdd({
      block: "scaffolding",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should include files from all extended blocks
      expect(result.value.created.length).toBeGreaterThanOrEqual(4);
      expect(result.value.devDependencies.ultracite).toBe("^7.1.1");
      expect(result.value.devDependencies.lefthook).toBe("^2.0.16");
      expect(result.value.devDependencies["@outfitter/tooling"]).toBe("^0.2.1");
    }
  });

  test("skips existing files without --force", async () => {
    // Create an existing file
    mkdirSync(join(testDir, ".claude"), { recursive: true });
    writeFileSync(join(testDir, ".claude/settings.json"), "existing");

    const result = await runAdd({
      block: "claude",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.skipped).toContain(".claude/settings.json");
    }

    // Verify existing file was not overwritten
    const content = readFileSync(
      join(testDir, ".claude/settings.json"),
      "utf-8"
    );
    expect(content).toBe("existing");
  });

  test("overwrites existing files with --force", async () => {
    // Create an existing file
    mkdirSync(join(testDir, ".claude"), { recursive: true });
    writeFileSync(join(testDir, ".claude/settings.json"), "existing");

    const result = await runAdd({
      block: "claude",
      force: true,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.overwritten).toContain(".claude/settings.json");
    }

    // Verify file was overwritten
    const content = readFileSync(
      join(testDir, ".claude/settings.json"),
      "utf-8"
    );
    expect(content).not.toBe("existing");
  });

  test("dry run does not create files", async () => {
    const result = await runAdd({
      block: "claude",
      force: false,
      dryRun: true,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.created.length).toBeGreaterThan(0);
    }

    // Verify no files were created
    expect(existsSync(join(testDir, ".claude/settings.json"))).toBe(false);
  });

  test("sets executable permission on shell scripts", async () => {
    const result = await runAdd({
      block: "bootstrap",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);

    // Verify executable permission
    const stats = statSync(join(testDir, "scripts/bootstrap.sh"));
    // biome-ignore lint/suspicious/noBitwiseOperators: checking file mode bits
    const isExecutable = (stats.mode & 0o100) !== 0;
    expect(isExecutable).toBe(true);
  });

  test("returns error for unknown block", async () => {
    const result = await runAdd({
      block: "nonexistent",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("not found");
    }
  });

  // ===========================================================================
  // Manifest stamping
  // ===========================================================================

  test("stamps manifest after successful add", async () => {
    const result = await runAdd({
      block: "biome",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    expect(result.isOk()).toBe(true);

    // Verify manifest was created
    const manifestPath = join(testDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["biome"]).toBeDefined();
    expect(manifest.blocks["biome"]?.installedFrom).toMatch(/^\d+\.\d+\.\d+/);
    expect(manifest.blocks["biome"]?.installedAt).toBeDefined();
  });

  test("manifest records correct installedFrom version", async () => {
    await runAdd({
      block: "claude",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    const manifestPath = join(testDir, ".outfitter/manifest.json");
    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;

    // The installedFrom should match @outfitter/tooling package.json version
    const toolingPkgPath = require.resolve("@outfitter/tooling/package.json");
    const toolingPkg = JSON.parse(readFileSync(toolingPkgPath, "utf-8")) as {
      version: string;
    };
    expect(manifest.blocks["claude"]?.installedFrom).toBe(toolingPkg.version);
  });

  test("dry run does not stamp manifest", async () => {
    await runAdd({
      block: "biome",
      force: false,
      dryRun: true,
      cwd: testDir,
    });

    expect(existsSync(join(testDir, ".outfitter/manifest.json"))).toBe(false);
  });

  test("add succeeds even when manifest directory is read-only", async () => {
    // Create a read-only .outfitter directory to prevent manifest writes
    const outfitterDir = join(testDir, ".outfitter");
    mkdirSync(outfitterDir, { recursive: true });
    // Write an invalid file to block the manifest write
    writeFileSync(join(outfitterDir, "manifest.json"), "not valid json {{{");
    chmodSync(join(outfitterDir, "manifest.json"), 0o444);

    const result = await runAdd({
      block: "biome",
      force: false,
      dryRun: false,
      cwd: testDir,
    });

    // The add command should still succeed — stamping is best-effort
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.created).toContain("biome.json");
    }

    // Clean up: restore write permission for afterEach cleanup
    chmodSync(join(outfitterDir, "manifest.json"), 0o644);
  });
});

describe("listBlocks", () => {
  test("returns available blocks", () => {
    const result = listBlocks();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("claude");
      expect(result.value).toContain("biome");
      expect(result.value).toContain("lefthook");
      expect(result.value).toContain("bootstrap");
      expect(result.value).toContain("scaffolding");
    }
  });
});
