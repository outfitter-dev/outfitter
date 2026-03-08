import { describe, expect, test } from "bun:test";

import {
  checkChangesetRequired,
  findIgnoredPackageReferences,
  getChangedChangesetFiles,
  getChangedPackagePaths,
  getReleasableChangedPackages,
  parseChangesetFrontmatterPackageNames,
  parseIgnoredPackagesFromChangesetConfig,
  resolveGitDiffRange,
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

  test("ignores test-only package files under src", () => {
    const files = [
      "packages/tooling/src/__tests__/check-exports.test.ts",
      "packages/tooling/src/check-exports.test.ts",
      "packages/tooling/src/check-exports.spec.ts",
      "packages/tooling/src/__snapshots__/check-exports.test.ts.snap",
    ];

    expect(getChangedPackagePaths(files)).toEqual([]);
  });

  test("still counts package changes when runtime files change alongside tests", () => {
    const files = [
      "packages/tooling/src/__tests__/check-exports.test.ts",
      "packages/tooling/src/cli/check-changeset.ts",
    ];

    expect(getChangedPackagePaths(files)).toEqual(["tooling"]);
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
  test("returns ok when all releasable packages are covered by changesets", () => {
    const result = checkChangesetRequired(
      ["cli", "contracts"],
      ["happy-turtle.md"],
      ["@outfitter/cli", "@outfitter/contracts"]
    );
    expect(result).toEqual({ ok: true, missingFor: [] });
  });

  test("returns ok when multiple changeset files cover the releasable packages", () => {
    const result = checkChangesetRequired(
      ["cli"],
      ["happy-turtle.md", "brave-fox.md"],
      ["@outfitter/cli"]
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

  test("fails when only some changed packages are covered", () => {
    const result = checkChangesetRequired(
      ["cli", "contracts"],
      ["happy-turtle.md"],
      ["@outfitter/cli"]
    );
    expect(result).toEqual({
      ok: false,
      missingFor: ["contracts"],
    });
  });

  test("fails when changeset files do not mention any changed package", () => {
    const result = checkChangesetRequired(
      ["tooling"],
      ["happy-turtle.md"],
      ["@outfitter/cli"]
    );
    expect(result).toEqual({
      ok: false,
      missingFor: ["tooling"],
    });
  });

  test("accepts prefiltered releasable packages from the runner", () => {
    const result = checkChangesetRequired(
      ["tooling"],
      ["happy-turtle.md"],
      ["@outfitter/tooling"]
    );
    expect(result).toEqual({ ok: true, missingFor: [] });
  });
});

describe("getReleasableChangedPackages", () => {
  test("filters ignored packages after normalizing them to workspace names", () => {
    expect(
      getReleasableChangedPackages(
        ["cli", "agents", "schema"],
        ["@outfitter/agents"]
      )
    ).toEqual(["cli", "schema"]);
  });

  test("returns an empty array when no packages changed", () => {
    expect(getReleasableChangedPackages([], ["@outfitter/agents"])).toEqual([]);
  });

  test("returns an empty array when every changed package is ignored", () => {
    expect(
      getReleasableChangedPackages(
        ["agents", "legacy"],
        ["@outfitter/agents", "@outfitter/legacy"]
      )
    ).toEqual([]);
  });

  test("returns all changed packages unchanged when nothing is ignored", () => {
    expect(getReleasableChangedPackages(["cli", "schema"], [])).toEqual([
      "cli",
      "schema",
    ]);
  });

  test("accepts already-normalized workspace package names", () => {
    expect(
      getReleasableChangedPackages(
        ["@outfitter/cli", "schema"],
        ["@outfitter/schema"]
      )
    ).toEqual(["@outfitter/cli"]);
  });

  test("normalizes ignored package names before filtering", () => {
    expect(
      getReleasableChangedPackages(["agents", "schema"], ["agents"])
    ).toEqual(["schema"]);
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

describe("resolveGitDiffRange", () => {
  test("uses the current pull request base/head SHAs from the GitHub event payload", () => {
    const result = resolveGitDiffRange({
      eventName: "pull_request",
      eventPath: "/tmp/github-event.json",
      readEventFile: () =>
        JSON.stringify({
          pull_request: {
            base: {
              ref: "main",
              sha: "1111111111111111111111111111111111111111",
            },
            head: {
              ref: "os-492-make-check-changeset-pr-base-aware-and-ignore-test-only",
              sha: "2222222222222222222222222222222222222222",
            },
          },
        }),
    });

    expect(result).toEqual({
      base: "1111111111111111111111111111111111111111",
      head: "2222222222222222222222222222222222222222",
      label:
        "main (1111111111111111111111111111111111111111)...os-492-make-check-changeset-pr-base-aware-and-ignore-test-only (2222222222222222222222222222222222222222)",
      source: "pull_request",
    });
  });

  test("falls back to origin/main...HEAD when the event is not a pull request", () => {
    expect(
      resolveGitDiffRange({
        eventName: "push",
        eventPath: "/tmp/github-event.json",
        readEventFile: () => "",
      })
    ).toEqual({
      base: "origin/main",
      head: "HEAD",
      label: "origin/main...HEAD",
      source: "default",
    });
  });

  test("falls back to origin/main...HEAD when the pull request payload is missing SHAs", () => {
    expect(
      resolveGitDiffRange({
        eventName: "pull_request",
        eventPath: "/tmp/github-event.json",
        readEventFile: () =>
          JSON.stringify({
            pull_request: {
              base: { ref: "main" },
              head: { ref: "feature" },
            },
          }),
      })
    ).toEqual({
      base: "origin/main",
      head: "HEAD",
      label: "origin/main...HEAD",
      source: "default",
    });
  });
});
