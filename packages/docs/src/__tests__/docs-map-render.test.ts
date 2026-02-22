import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  renderLlmsFullFromMap,
  renderLlmsIndexFromMap,
} from "../core/docs-map-render.js";
import type { DocsMap } from "../core/docs-map-schema.js";

// =============================================================================
// Fixtures
// =============================================================================

function makeDocsMap(
  entries: DocsMap["entries"],
  overrides?: Partial<Omit<DocsMap, "entries">>
): DocsMap {
  return {
    generatedAt: "2026-02-21T12:00:00.000Z",
    generator: "@outfitter/docs@0.1.2",
    entries,
    ...overrides,
  };
}

// =============================================================================
// renderLlmsIndexFromMap
// =============================================================================

describe("renderLlmsIndexFromMap", () => {
  it("renders an index from a docs map with multiple packages", () => {
    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI Package",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
      {
        id: "cli/docs/usage.md",
        kind: "guide",
        title: "Usage Guide",
        sourcePath: "packages/cli/docs/usage.md",
        outputPath: "docs/packages/cli/usage.md",
        package: "@outfitter/cli",
        tags: [],
      },
      {
        id: "config/README.md",
        kind: "readme",
        title: "Config Package",
        sourcePath: "packages/config/README.md",
        outputPath: "docs/packages/config/README.md",
        package: "@outfitter/config",
        tags: [],
      },
    ]);

    const result = renderLlmsIndexFromMap(docsMap);

    expect(result).toBe(
      [
        "# llms.txt",
        "",
        "Outfitter package docs index for LLM retrieval.",
        "",
        "## @outfitter/cli",
        "- docs/packages/cli/README.md \u2014 CLI Package",
        "- docs/packages/cli/usage.md \u2014 Usage Guide",
        "",
        "## @outfitter/config",
        "- docs/packages/config/README.md \u2014 Config Package",
        "",
      ].join("\n")
    );
  });

  it("skips entries without a package field", () => {
    const docsMap = makeDocsMap([
      {
        id: "architecture",
        kind: "architecture",
        title: "Architecture",
        sourcePath: "docs/ARCHITECTURE.md",
        outputPath: "docs/ARCHITECTURE.md",
        tags: ["overview"],
      },
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI Package",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = renderLlmsIndexFromMap(docsMap);

    // Should only contain @outfitter/cli, not the architecture entry
    expect(result).toContain("## @outfitter/cli");
    expect(result).not.toContain("Architecture");
    expect(result).not.toContain("ARCHITECTURE");
  });

  it("sorts packages alphabetically", () => {
    const docsMap = makeDocsMap([
      {
        id: "tui/README.md",
        kind: "readme",
        title: "TUI Package",
        sourcePath: "packages/tui/README.md",
        outputPath: "docs/packages/tui/README.md",
        package: "@outfitter/tui",
        tags: [],
      },
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI Package",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
      {
        id: "config/README.md",
        kind: "readme",
        title: "Config Package",
        sourcePath: "packages/config/README.md",
        outputPath: "docs/packages/config/README.md",
        package: "@outfitter/config",
        tags: [],
      },
    ]);

    const result = renderLlmsIndexFromMap(docsMap);
    const packageHeaders = result
      .split("\n")
      .filter((line) => line.startsWith("## "));

    expect(packageHeaders).toEqual([
      "## @outfitter/cli",
      "## @outfitter/config",
      "## @outfitter/tui",
    ]);
  });

  it("sorts entries within a package by output path", () => {
    const docsMap = makeDocsMap([
      {
        id: "cli/docs/usage.md",
        kind: "guide",
        title: "Usage Guide",
        sourcePath: "packages/cli/docs/usage.md",
        outputPath: "docs/packages/cli/usage.md",
        package: "@outfitter/cli",
        tags: [],
      },
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI Package",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = renderLlmsIndexFromMap(docsMap);
    const entryLines = result
      .split("\n")
      .filter((line) => line.startsWith("- "));

    // README.md sorts before usage.md
    expect(entryLines[0]).toContain("README.md");
    expect(entryLines[1]).toContain("usage.md");
  });

  it("renders entries without a title as path only", () => {
    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = renderLlmsIndexFromMap(docsMap);

    expect(result).toContain("- docs/packages/cli/README.md\n");
    expect(result).not.toContain("\u2014");
  });

  it("returns a minimal index for an empty docs map", () => {
    const docsMap = makeDocsMap([]);
    const result = renderLlmsIndexFromMap(docsMap);

    expect(result).toBe(
      [
        "# llms.txt",
        "",
        "Outfitter package docs index for LLM retrieval.",
        "",
      ].join("\n")
    );
  });
});

// =============================================================================
// renderLlmsFullFromMap
// =============================================================================

describe("renderLlmsFullFromMap", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  async function setupWorkspace(
    files: Record<string, string>
  ): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), "outfitter-llms-full-test-"));
    workspaceRoots.add(tmpDir);

    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(tmpDir, relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }
    return tmpDir;
  }

  it("renders full corpus from a docs map with file content", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/cli/README.md": "# CLI\n\nThe CLI package.\n",
      "docs/packages/config/README.md": "# Config\n\nThe config package.\n",
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
      {
        id: "config/README.md",
        kind: "readme",
        title: "Config",
        sourcePath: "packages/config/README.md",
        outputPath: "docs/packages/config/README.md",
        package: "@outfitter/config",
        tags: [],
      },
    ]);

    const result = await renderLlmsFullFromMap(docsMap, workspaceRoot);

    expect(result).toBe(
      [
        "# llms-full.txt",
        "",
        "Outfitter package docs corpus for LLM retrieval.",
        "",
        "---",
        "path: docs/packages/cli/README.md",
        "package: @outfitter/cli",
        "title: CLI",
        "---",
        "",
        "# CLI",
        "",
        "The CLI package.",
        "",
        "---",
        "path: docs/packages/config/README.md",
        "package: @outfitter/config",
        "title: Config",
        "---",
        "",
        "# Config",
        "",
        "The config package.",
        "",
      ].join("\n")
    );
  });

  it("skips entries without a package field", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/ARCHITECTURE.md": "# Architecture\n",
      "docs/packages/cli/README.md": "# CLI\n",
    });

    const docsMap = makeDocsMap([
      {
        id: "architecture",
        kind: "architecture",
        title: "Architecture",
        sourcePath: "docs/ARCHITECTURE.md",
        outputPath: "docs/ARCHITECTURE.md",
        tags: [],
      },
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = await renderLlmsFullFromMap(docsMap, workspaceRoot);

    expect(result).toContain("package: @outfitter/cli");
    expect(result).not.toContain("package: undefined");
    expect(result).not.toContain("path: docs/ARCHITECTURE.md");
  });

  it("skips entries whose output file does not exist on disk", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/cli/README.md": "# CLI\n",
      // config README intentionally not created
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
      {
        id: "config/README.md",
        kind: "readme",
        title: "Config",
        sourcePath: "packages/config/README.md",
        outputPath: "docs/packages/config/README.md",
        package: "@outfitter/config",
        tags: [],
      },
    ]);

    const result = await renderLlmsFullFromMap(docsMap, workspaceRoot);

    expect(result).toContain("package: @outfitter/cli");
    expect(result).not.toContain("package: @outfitter/config");
  });

  it("omits title frontmatter when title is empty", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/cli/README.md": "# CLI\n",
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = await renderLlmsFullFromMap(docsMap, workspaceRoot);

    expect(result).not.toContain("title:");
  });

  it("strips trailing whitespace from file content", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/cli/README.md": "# CLI   \n\nSome text   \n",
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = await renderLlmsFullFromMap(docsMap, workspaceRoot);

    // No trailing spaces on content lines
    expect(result).toContain("# CLI\n");
    expect(result).toContain("Some text\n");
    expect(result).not.toContain("   ");
  });

  it("sorts entries by output path", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/tui/README.md": "# TUI\n",
      "docs/packages/cli/README.md": "# CLI\n",
    });

    const docsMap = makeDocsMap([
      {
        id: "tui/README.md",
        kind: "readme",
        title: "TUI",
        sourcePath: "packages/tui/README.md",
        outputPath: "docs/packages/tui/README.md",
        package: "@outfitter/tui",
        tags: [],
      },
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    const result = await renderLlmsFullFromMap(docsMap, workspaceRoot);

    const cliIndex = result.indexOf("package: @outfitter/cli");
    const tuiIndex = result.indexOf("package: @outfitter/tui");
    expect(cliIndex).toBeLessThan(tuiIndex);
  });

  it("throws when docs-map outputPath escapes workspace root", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/cli/README.md": "# CLI\n",
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/README.md",
        kind: "readme",
        title: "CLI",
        sourcePath: "packages/cli/README.md",
        outputPath: "../../secret.md",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    await expect(renderLlmsFullFromMap(docsMap, workspaceRoot)).rejects.toThrow(
      "outside workspace root"
    );
  });

  it("propagates non-ENOENT read errors", async () => {
    const workspaceRoot = await setupWorkspace({
      "docs/packages/cli/README.md": "# CLI\n",
    });

    await mkdir(join(workspaceRoot, "docs", "packages", "cli", "directory"), {
      recursive: true,
    });

    const docsMap = makeDocsMap([
      {
        id: "cli/directory",
        kind: "readme",
        title: "CLI Dir",
        sourcePath: "packages/cli/docs/directory.md",
        outputPath: "docs/packages/cli/directory",
        package: "@outfitter/cli",
        tags: [],
      },
    ]);

    await expect(
      renderLlmsFullFromMap(docsMap, workspaceRoot)
    ).rejects.toThrow();
  });
});
