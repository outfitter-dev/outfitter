import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  generatePackageListSection,
  replaceSentinelSection,
} from "../core/sentinel-generator.js";

// =============================================================================
// Fixtures
// =============================================================================

const fixtureRoots = new Set<string>();

afterEach(async () => {
  for (const fixtureRoot of fixtureRoots) {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
  fixtureRoots.clear();
});

async function setupWorkspace(files: Record<string, string>): Promise<string> {
  const tmpDir = join(
    import.meta.dir,
    "__fixtures__",
    `sentinel-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(tmpDir, relativePath);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }
  fixtureRoots.add(tmpDir);
  return tmpDir;
}

function makePackageJson(input: {
  name: string;
  description: string;
  private?: boolean;
}): string {
  return JSON.stringify({
    name: input.name,
    description: input.description,
    ...(input.private ? { private: true } : {}),
  });
}

// =============================================================================
// replaceSentinelSection
// =============================================================================

describe("replaceSentinelSection", () => {
  it("replaces content between sentinel markers", () => {
    const content = [
      "# Title",
      "",
      "<!-- BEGIN:GENERATED:PACKAGE_LIST -->",
      "old content here",
      "<!-- END:GENERATED:PACKAGE_LIST -->",
      "",
      "## Footer",
    ].join("\n");

    const result = replaceSentinelSection(
      content,
      "PACKAGE_LIST",
      "new content here"
    );

    expect(result).toBe(
      [
        "# Title",
        "",
        "<!-- BEGIN:GENERATED:PACKAGE_LIST -->",
        "new content here",
        "<!-- END:GENERATED:PACKAGE_LIST -->",
        "",
        "## Footer",
      ].join("\n")
    );
  });

  it("preserves content outside sentinel markers", () => {
    const content = [
      "Before content",
      "<!-- BEGIN:GENERATED:TEST -->",
      "old",
      "<!-- END:GENERATED:TEST -->",
      "After content",
    ].join("\n");

    const result = replaceSentinelSection(content, "TEST", "new");

    expect(result).toContain("Before content");
    expect(result).toContain("After content");
    expect(result).not.toContain("old");
    expect(result).toContain("new");
  });

  it("handles multiline replacement content", () => {
    const content = [
      "<!-- BEGIN:GENERATED:TABLE -->",
      "placeholder",
      "<!-- END:GENERATED:TABLE -->",
    ].join("\n");

    const newContent = [
      "| Name | Description |",
      "|------|-------------|",
      "| foo | A package |",
    ].join("\n");

    const result = replaceSentinelSection(content, "TABLE", newContent);

    expect(result).toContain("| Name | Description |");
    expect(result).toContain("| foo | A package |");
    expect(result).not.toContain("placeholder");
  });

  it("returns content unchanged when sentinel markers are not found", () => {
    const content = "# Title\n\nSome content\n";

    const result = replaceSentinelSection(
      content,
      "MISSING_SECTION",
      "new content"
    );

    expect(result).toBe(content);
  });

  it("replaces multiline content between sentinels", () => {
    const content = [
      "<!-- BEGIN:GENERATED:ITEMS -->",
      "line 1",
      "line 2",
      "line 3",
      "<!-- END:GENERATED:ITEMS -->",
    ].join("\n");

    const result = replaceSentinelSection(content, "ITEMS", "single line");

    expect(result).toBe(
      [
        "<!-- BEGIN:GENERATED:ITEMS -->",
        "single line",
        "<!-- END:GENERATED:ITEMS -->",
      ].join("\n")
    );
  });

  it("handles multiple different sentinel sections independently", () => {
    const content = [
      "<!-- BEGIN:GENERATED:SECTION_A -->",
      "old A",
      "<!-- END:GENERATED:SECTION_A -->",
      "middle",
      "<!-- BEGIN:GENERATED:SECTION_B -->",
      "old B",
      "<!-- END:GENERATED:SECTION_B -->",
    ].join("\n");

    const result = replaceSentinelSection(content, "SECTION_A", "new A");

    expect(result).toContain("new A");
    expect(result).toContain("old B");
    expect(result).toContain("middle");
  });
});

// =============================================================================
// generatePackageListSection
// =============================================================================

describe("generatePackageListSection", () => {
  it("generates a markdown table from workspace packages", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/cli/package.json": makePackageJson({
        name: "@outfitter/cli",
        description: "CLI framework",
      }),
      "packages/config/package.json": makePackageJson({
        name: "@outfitter/config",
        description: "XDG-compliant configuration",
      }),
    });

    const result = await generatePackageListSection(workspaceRoot);

    expect(result).toContain("| Package | Description |");
    expect(result).toContain("|---------|-------------|");
    expect(result).toContain(
      "| [`@outfitter/cli`](../packages/cli/) | CLI framework |"
    );
    expect(result).toContain(
      "| [`@outfitter/config`](../packages/config/) | XDG-compliant configuration |"
    );
  });

  it("excludes private packages", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/cli/package.json": makePackageJson({
        name: "@outfitter/cli",
        description: "CLI framework",
      }),
      "packages/internal/package.json": makePackageJson({
        name: "@outfitter/internal",
        description: "Internal package",
        private: true,
      }),
    });

    const result = await generatePackageListSection(workspaceRoot);

    expect(result).toContain("@outfitter/cli");
    expect(result).not.toContain("@outfitter/internal");
  });

  it("sorts packages alphabetically by name", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/tui/package.json": makePackageJson({
        name: "@outfitter/tui",
        description: "Terminal UI",
      }),
      "packages/cli/package.json": makePackageJson({
        name: "@outfitter/cli",
        description: "CLI framework",
      }),
      "packages/config/package.json": makePackageJson({
        name: "@outfitter/config",
        description: "Configuration",
      }),
    });

    const result = await generatePackageListSection(workspaceRoot);
    const rows = result.split("\n").filter((line) => line.startsWith("| [`"));

    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("@outfitter/cli");
    expect(rows[1]).toContain("@outfitter/config");
    expect(rows[2]).toContain("@outfitter/tui");
  });

  it("skips directories without package.json", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/cli/package.json": makePackageJson({
        name: "@outfitter/cli",
        description: "CLI framework",
      }),
      "packages/empty/.gitkeep": "",
    });

    const result = await generatePackageListSection(workspaceRoot);

    expect(result).toContain("@outfitter/cli");
    expect(result).not.toContain("empty");
  });

  it("returns an empty table when no publishable packages exist", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/internal/package.json": makePackageJson({
        name: "@outfitter/internal",
        description: "Internal only",
        private: true,
      }),
    });

    const result = await generatePackageListSection(workspaceRoot);

    expect(result).toContain("| Package | Description |");
    expect(result).toContain("|---------|-------------|");
    // Only header rows, no data rows
    const rows = result.split("\n").filter((line) => line.startsWith("| [`"));
    expect(rows).toHaveLength(0);
  });

  it("uses directory name for link when package has scoped name", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/file-ops/package.json": makePackageJson({
        name: "@outfitter/file-ops",
        description: "File operations",
      }),
    });

    const result = await generatePackageListSection(workspaceRoot);

    expect(result).toContain("../packages/file-ops/");
  });

  it("handles packages with missing description gracefully", async () => {
    const workspaceRoot = await setupWorkspace({
      "packages/cli/package.json": JSON.stringify({
        name: "@outfitter/cli",
      }),
    });

    const result = await generatePackageListSection(workspaceRoot);

    expect(result).toContain("@outfitter/cli");
    // Should have an empty description cell but not crash
    expect(result).toContain("| [`@outfitter/cli`](../packages/cli/) |");
  });
});
