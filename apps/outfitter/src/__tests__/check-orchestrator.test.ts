import { describe, expect, test } from "bun:test";

import {
  buildCheckOrchestratorPlan,
  parseTreePaths,
} from "../commands/check-orchestrator.js";

describe("buildCheckOrchestratorPlan", () => {
  test("all mode includes core checks and excludes tests", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "all",
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("typecheck");
    expect(stepIds).toContain("lint-and-format");
    expect(stepIds).toContain("schema-diff");
    expect(stepIds).not.toContain("tests");
  });

  test("ci mode includes tests", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "ci",
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("tests");
    expect(stepIds.at(-1)).toBe("tests");
  });

  test("pre-push mode runs hook verify and schema drift", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-push",
    });

    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({
      id: "pre-push-verify",
      command: ["bun", "run", "packages/tooling/src/cli/index.ts", "pre-push"],
    });
    expect(plan[1]).toMatchObject({
      id: "schema-drift",
      command: ["bun", "run", "apps/outfitter/src/cli.ts", "schema", "diff"],
    });
  });

  test("pre-commit mode passes all staged files to ultracite but only TS files to typecheck", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
      stagedFiles: ["apps/outfitter/src/cli.ts", "README.md"],
    });

    expect(plan[0]).toMatchObject({
      id: "ultracite-fix",
      command: [
        "bun",
        "x",
        "ultracite",
        "fix",
        "README.md",
        "apps/outfitter/src/cli.ts",
      ],
    });
    expect(plan[1]).toMatchObject({
      id: "typecheck",
      command: [
        "./scripts/pre-commit-typecheck.sh",
        "apps/outfitter/src/cli.ts",
      ],
    });
  });

  test("pre-commit mode skips typecheck when only non-TS files staged", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
      stagedFiles: ["README.md", "docs/guide.md"],
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("ultracite-fix");
    expect(stepIds).not.toContain("typecheck");
    expect(stepIds).toContain("exports");
  });

  test("pre-commit mode includes typecheck fallback when no staged files", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("typecheck");
    expect(plan.find((s) => s.id === "typecheck")).toMatchObject({
      command: ["bun", "run", "typecheck", "--", "--only"],
    });
  });

  test("pre-commit mode syncs agent scaffolding when .claude files change", () => {
    const plan = buildCheckOrchestratorPlan({
      cwd: process.cwd(),
      mode: "pre-commit",
      stagedFiles: [".claude/settings.json"],
    });
    const stepIds = plan.map((step) => step.id);

    expect(stepIds).toContain("sync-agent-scaffolding");
  });
});

describe("parseTreePaths", () => {
  test("parses standard porcelain status lines", () => {
    const output = " M src/index.ts\n?? new-file.ts\nA  added.ts\n";
    expect(parseTreePaths(output)).toEqual([
      "added.ts",
      "new-file.ts",
      "src/index.ts",
    ]);
  });

  test("handles rename entries", () => {
    const output = "R  old-name.ts -> new-name.ts\n";
    expect(parseTreePaths(output)).toEqual(["new-name.ts"]);
  });

  test("skips empty lines", () => {
    const output = " M file.ts\n\n";
    expect(parseTreePaths(output)).toEqual(["file.ts"]);
  });

  test("preserves paths that start with spaces after porcelain prefix", () => {
    // Regression: trim() before slice(3) corrupted paths
    const output = " M file.txt\nMM another.ts\n";
    expect(parseTreePaths(output)).toEqual(["another.ts", "file.txt"]);
  });
});
