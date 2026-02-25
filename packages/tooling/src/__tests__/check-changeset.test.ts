import { describe, expect, test } from "bun:test";

import {
  checkChangesetRequired,
  findIgnoredPackageReferences,
  getChangedChangesetFiles,
  getChangedPackagePaths,
  parseChangesetFrontmatterPackageNames,
  parseIgnoredPackagesFromChangesetConfig,
} from "../cli/check-changeset.js";

describe("getChangedPackagePaths", () => {
  test("extracts unique package names from packages/*/src/** paths", () => {
    const files = [
      "packages/cli/src/index.ts",
      "packages/cli/src/utils.ts",
      "packages/contracts/src/result.ts",
    ];
    expect(getChangedPackagePaths(files)).toEqual(["cli", "contracts"]);
  });

  test("ignores apps/ and root-level files", () => {
    const files = [
      "apps/outfitter/src/index.ts",
      "package.json",
      "README.md",
      ".changeset/some-change.md",
      "packages/cli/src/index.ts",
    ];
    expect(getChangedPackagePaths(files)).toEqual(["cli"]);
  });

  test("ignores packages/ files outside src/", () => {
    const files = [
      "packages/cli/package.json",
      "packages/cli/tsconfig.json",
      "packages/cli/README.md",
    ];
    expect(getChangedPackagePaths(files)).toEqual([]);
  });

  test("returns sorted unique names", () => {
    const files = [
      "packages/types/src/branded.ts",
      "packages/cli/src/index.ts",
      "packages/types/src/index.ts",
      "packages/cli/src/output.ts",
    ];
    expect(getChangedPackagePaths(files)).toEqual(["cli", "types"]);
  });

  test("returns empty array for no matching files", () => {
    const files = ["README.md", ".github/workflows/ci.yml"];
    expect(getChangedPackagePaths(files)).toEqual([]);
  });

  test("handles deeply nested src paths", () => {
    const files = ["packages/daemon/src/ipc/health/check.ts"];
    expect(getChangedPackagePaths(files)).toEqual(["daemon"]);
  });
});

describe("getChangedChangesetFiles", () => {
  test("extracts changeset files from diff paths", () => {
    const files = [
      "packages/cli/src/index.ts",
      ".changeset/happy-turtle.md",
      ".changeset/brave-fox.md",
    ];
    expect(getChangedChangesetFiles(files)).toEqual([
      "brave-fox.md",
      "happy-turtle.md",
    ]);
  });

  test("excludes README.md", () => {
    const files = [".changeset/README.md", ".changeset/happy-turtle.md"];
    expect(getChangedChangesetFiles(files)).toEqual(["happy-turtle.md"]);
  });

  test("ignores non-.changeset paths", () => {
    const files = [
      "packages/cli/src/index.ts",
      "apps/outfitter/src/main.ts",
      "README.md",
    ];
    expect(getChangedChangesetFiles(files)).toEqual([]);
  });

  test("ignores nested .changeset paths", () => {
    const files = [".changeset/nested/deep.md"];
    expect(getChangedChangesetFiles(files)).toEqual([]);
  });

  test("returns empty array for empty input", () => {
    expect(getChangedChangesetFiles([])).toEqual([]);
  });
});

describe("checkChangesetRequired", () => {
  test("returns ok when changeset files exist", () => {
    const result = checkChangesetRequired(
      ["cli", "contracts"],
      ["happy-turtle.md"]
    );
    expect(result).toEqual({ ok: true, missingFor: [] });
  });

  test("returns ok when multiple changeset files exist", () => {
    const result = checkChangesetRequired(
      ["cli"],
      ["happy-turtle.md", "brave-fox.md"]
    );
    expect(result).toEqual({ ok: true, missingFor: [] });
  });

  test("fails when packages changed but no changeset files", () => {
    const result = checkChangesetRequired(["cli", "contracts"], []);
    expect(result).toEqual({
      ok: false,
      missingFor: ["cli", "contracts"],
    });
  });

  test("returns ok when no packages changed", () => {
    const result = checkChangesetRequired([], []);
    expect(result).toEqual({ ok: true, missingFor: [] });
  });

  test("returns ok when no packages changed even with changesets", () => {
    const result = checkChangesetRequired([], ["happy-turtle.md"]);
    expect(result).toEqual({ ok: true, missingFor: [] });
  });
});

describe("parseIgnoredPackagesFromChangesetConfig", () => {
  test("extracts ignored package names from config json", () => {
    const config = JSON.stringify({
      ignore: ["@outfitter/agents", "@outfitter/legacy"],
    });

    expect(parseIgnoredPackagesFromChangesetConfig(config)).toEqual([
      "@outfitter/agents",
      "@outfitter/legacy",
    ]);
  });

  test("returns empty list when ignore is missing or invalid", () => {
    expect(parseIgnoredPackagesFromChangesetConfig("{}")).toEqual([]);
    expect(
      parseIgnoredPackagesFromChangesetConfig(
        JSON.stringify({ ignore: ["@outfitter/agents", 42] })
      )
    ).toEqual(["@outfitter/agents"]);
  });
});

describe("parseChangesetFrontmatterPackageNames", () => {
  test("extracts package names from changeset frontmatter", () => {
    const markdown = `---\n"@outfitter/tooling": patch\n'@outfitter/cli': minor\n---\n\nSummary`;

    expect(parseChangesetFrontmatterPackageNames(markdown)).toEqual([
      "@outfitter/cli",
      "@outfitter/tooling",
    ]);
  });

  test("extracts package names from CRLF frontmatter", () => {
    const markdown =
      "---\r\n\"@outfitter/tooling\": patch\r\n'@outfitter/cli': minor\r\n---\r\n\r\nSummary";

    expect(parseChangesetFrontmatterPackageNames(markdown)).toEqual([
      "@outfitter/cli",
      "@outfitter/tooling",
    ]);
  });

  test("returns empty array when frontmatter is absent", () => {
    expect(parseChangesetFrontmatterPackageNames("No frontmatter")).toEqual([]);
  });
});

describe("findIgnoredPackageReferences", () => {
  test("reports ignored packages referenced by changed changesets", () => {
    const references = findIgnoredPackageReferences({
      changesetFiles: ["alpha.md", "bravo.md"],
      ignoredPackages: ["@outfitter/agents"],
      readChangesetFile: (filename) =>
        filename === "alpha.md"
          ? '---\n"@outfitter/agents": patch\n"@outfitter/tooling": patch\n---'
          : '---\n"@outfitter/tooling": patch\n---',
    });

    expect(references).toEqual([
      { file: "alpha.md", packages: ["@outfitter/agents"] },
    ]);
  });

  test("returns empty list when no ignored package is referenced", () => {
    const references = findIgnoredPackageReferences({
      changesetFiles: ["alpha.md"],
      ignoredPackages: ["@outfitter/agents"],
      readChangesetFile: () => '---\n"@outfitter/tooling": patch\n---',
    });

    expect(references).toEqual([]);
  });

  test("skips files that return empty content (deleted files)", () => {
    const references = findIgnoredPackageReferences({
      changesetFiles: ["exists.md", "deleted.md"],
      ignoredPackages: ["@outfitter/agents"],
      readChangesetFile: (filename) =>
        filename === "exists.md" ? '---\n"@outfitter/agents": patch\n---' : "",
    });

    expect(references).toEqual([
      { file: "exists.md", packages: ["@outfitter/agents"] },
    ]);
  });
});
