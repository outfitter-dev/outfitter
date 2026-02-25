import { describe, expect, test } from "bun:test";
import { noNestedBarrelRule } from "../../rules/no-nested-barrel.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

describe("no-nested-barrel", () => {
  test("reports nested index.ts barrels inside package source", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/internal/index.ts",
      nodes: [{ type: "Program" }],
      rule: noNestedBarrelRule,
      sourceText: readFixture("invalid/no-nested-barrel.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noNestedBarrel");
  });

  test("allows top-level package src/index.ts barrels", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/index.ts",
      nodes: [{ type: "Program" }],
      rule: noNestedBarrelRule,
      sourceText: readFixture("valid/no-nested-barrel.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-index source files", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/internal/logger.ts",
      nodes: [{ type: "Program" }],
      rule: noNestedBarrelRule,
      sourceText: readFixture("valid/no-nested-barrel.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("reports deeply nested barrels", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/cli/src/a/b/index.ts",
      nodes: [{ type: "Program" }],
      rule: noNestedBarrelRule,
      sourceText: readFixture("invalid/no-nested-barrel.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noNestedBarrel");
  });

  test("ignores files outside packages directory", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/internal/index.ts",
      nodes: [{ type: "Program" }],
      rule: noNestedBarrelRule,
      sourceText: readFixture("invalid/no-nested-barrel.ts"),
    });

    // Only /packages/*/src/ paths are checked
    expect(reports).toHaveLength(0);
  });

  test("only flags index.ts extension, not index.tsx or index.js", () => {
    const otherExtensions = [
      "packages/cli/src/internal/index.tsx",
      "packages/cli/src/internal/index.js",
      "packages/cli/src/internal/index.mts",
    ];

    for (const filename of otherExtensions) {
      const reports = runRuleForEvent({
        event: "Program",
        filename,
        nodes: [{ type: "Program" }],
        rule: noNestedBarrelRule,
        sourceText: readFixture("invalid/no-nested-barrel.ts"),
      });

      // Rule checks for /index.ts suffix only
      expect(reports).toHaveLength(0);
    }
  });

  test("normalizes Windows-style backslash paths", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages\\logging\\src\\internal\\index.ts",
      nodes: [{ type: "Program" }],
      rule: noNestedBarrelRule,
      sourceText: readFixture("invalid/no-nested-barrel.ts"),
    });

    // normalizeFilePath converts backslashes to forward slashes
    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noNestedBarrel");
  });
});
