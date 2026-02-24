import { afterEach, describe, expect, it } from "bun:test";

import { renderLlmsFullFromMap } from "../core/docs-map-render.js";
import {
  makeDocsMap,
  setupTrackedRenderWorkspace,
} from "./docs-map-render-test-helpers.js";
import { cleanupTempRoots } from "./docs-map-test-helpers.js";

describe("renderLlmsFullFromMap", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    await cleanupTempRoots(workspaceRoots);
  });

  it("renders full corpus from a docs map with file content", async () => {
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
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
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
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
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
      "docs/packages/cli/README.md": "# CLI\n",
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
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
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
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
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

    expect(result).toContain("# CLI\n");
    expect(result).toContain("Some text\n");
    expect(result).not.toContain("   ");
  });

  it("sorts entries by output path", async () => {
    const workspaceRoot = await setupTrackedRenderWorkspace(workspaceRoots, {
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
});
