import { describe, expect, test } from "bun:test";

import {
  findShardCoverageViolations,
  findTestablePackages,
  parseShardFilters,
} from "./check-shard-coverage";

describe("parseShardFilters", () => {
  test("extracts shard names and package lists from CI workflow YAML", () => {
    const yaml = `
  test-foundation:
    env:
      OUTFITTER_CI_TEST_SHARD: foundation
      OUTFITTER_CI_TEST_FILTER: "@outfitter/contracts,@outfitter/types"

  test-runtime:
    env:
      OUTFITTER_CI_TEST_SHARD: runtime
      OUTFITTER_CI_TEST_FILTER: "@outfitter/cli,@outfitter/mcp"
`;
    const result = parseShardFilters(yaml);
    expect(result).toEqual(
      new Map([
        ["foundation", ["@outfitter/contracts", "@outfitter/types"]],
        ["runtime", ["@outfitter/cli", "@outfitter/mcp"]],
      ])
    );
  });

  test("pairs correctly when FILTER appears before SHARD", () => {
    const yaml = `
  test-reversed:
    env:
      OUTFITTER_CI_TEST_FILTER: "@outfitter/cli,@outfitter/mcp"
      OUTFITTER_CI_TEST_SHARD: reversed
`;
    const result = parseShardFilters(yaml);
    expect(result).toEqual(
      new Map([["reversed", ["@outfitter/cli", "@outfitter/mcp"]]])
    );
  });

  test("handles quoted filter values", () => {
    const yaml = `
  test-tooling:
    env:
      OUTFITTER_CI_TEST_SHARD: tooling
      OUTFITTER_CI_TEST_FILTER: "outfitter,outfitter-cli-demo"
`;
    const result = parseShardFilters(yaml);
    expect(result).toEqual(
      new Map([["tooling", ["outfitter", "outfitter-cli-demo"]]])
    );
  });
});

describe("findShardCoverageViolations", () => {
  test("returns no violations when all testable packages are covered exactly once", () => {
    const shards = new Map([
      ["foundation", ["@outfitter/contracts", "@outfitter/types"]],
      ["runtime", ["@outfitter/cli"]],
    ]);
    const testablePackages = [
      "@outfitter/contracts",
      "@outfitter/types",
      "@outfitter/cli",
    ];

    const violations = findShardCoverageViolations(shards, testablePackages);
    expect(violations).toEqual({ missing: [], duplicated: [] });
  });

  test("detects packages missing from all shards", () => {
    const shards = new Map([["foundation", ["@outfitter/contracts"]]]);
    const testablePackages = ["@outfitter/contracts", "@outfitter/types"];

    const violations = findShardCoverageViolations(shards, testablePackages);
    expect(violations.missing).toEqual(["@outfitter/types"]);
    expect(violations.duplicated).toEqual([]);
  });

  test("detects packages appearing in multiple shards", () => {
    const shards = new Map([
      ["foundation", ["@outfitter/contracts", "@outfitter/types"]],
      ["runtime", ["@outfitter/types", "@outfitter/cli"]],
    ]);
    const testablePackages = [
      "@outfitter/contracts",
      "@outfitter/types",
      "@outfitter/cli",
    ];

    const violations = findShardCoverageViolations(shards, testablePackages);
    expect(violations.missing).toEqual([]);
    expect(violations.duplicated).toEqual([
      { package: "@outfitter/types", shards: ["foundation", "runtime"] },
    ]);
  });

  test("detects both missing and duplicated simultaneously", () => {
    const shards = new Map([
      ["a", ["pkg-1", "pkg-2"]],
      ["b", ["pkg-2"]],
    ]);
    const testablePackages = ["pkg-1", "pkg-2", "pkg-3"];

    const violations = findShardCoverageViolations(shards, testablePackages);
    expect(violations.missing).toEqual(["pkg-3"]);
    expect(violations.duplicated).toEqual([
      { package: "pkg-2", shards: ["a", "b"] },
    ]);
  });

  test("ignores shard entries that are not in testable packages", () => {
    const shards = new Map([
      ["foundation", ["@outfitter/contracts", "unknown-pkg"]],
    ]);
    const testablePackages = ["@outfitter/contracts"];

    const violations = findShardCoverageViolations(shards, testablePackages);
    expect(violations).toEqual({ missing: [], duplicated: [] });
  });
});

describe("findTestablePackages", () => {
  test("discovers testable packages from the repo root", () => {
    const root = import.meta.dir.replace(/\/scripts$/, "");
    const result = findTestablePackages(root);

    // Should find packages with test scripts
    expect(result).toContain("@outfitter/contracts");
    expect(result).toContain("@outfitter/cli");
    expect(result).toContain("outfitter");

    // Should NOT include packages without test scripts (plugins)
    expect(result).not.toContain("@outfitter-agents/kit");
    expect(result).not.toContain("@outfitter-agents/outfitter");
    expect(result).not.toContain("@outfitter-agents/team");

    // Should be sorted
    const sorted = [...result].toSorted();
    expect(result).toEqual(sorted);
  });
});
