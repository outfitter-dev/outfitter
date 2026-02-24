import { describe, expect, it } from "bun:test";

import { renderLlmsIndexFromMap } from "../core/docs-map-render.js";
import { makeDocsMap } from "./docs-map-render-test-helpers.js";

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
        "- docs/packages/cli/README.md — CLI Package",
        "- docs/packages/cli/usage.md — Usage Guide",
        "",
        "## @outfitter/config",
        "- docs/packages/config/README.md — Config Package",
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
    expect(result).not.toContain("—");
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
