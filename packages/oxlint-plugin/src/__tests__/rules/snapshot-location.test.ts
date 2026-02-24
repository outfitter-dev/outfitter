import { describe, expect, test } from "bun:test";
import { snapshotLocationRule } from "../../rules/snapshot-location.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

describe("snapshot-location", () => {
  const invalidSourceText = readFixture("invalid/snapshot-location.ts");
  const validSourceText = readFixture("valid/snapshot-location.ts");

  test("reports .snap files outside __snapshots__ directories", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/contracts/src/__tests__/handler.snap",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("snapshotLocation");
  });

  test("reports .snap files at the repository root", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "handler.snap",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("snapshotLocation");
  });

  test("allows .snap files inside __snapshots__ directories", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/contracts/src/__tests__/__snapshots__/handler.snap",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("allows .snap files inside deeply nested __snapshots__ directories", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename:
        "packages/contracts/src/deep/nested/__tests__/__snapshots__/handler.snap",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-snapshot files", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/contracts/src/__tests__/handler.test.ts",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores .snapshot extension files", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/contracts/src/__tests__/handler.snapshot",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("normalizes Windows-style path separators for __snapshots__", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename:
        "packages\\contracts\\src\\__tests__\\__snapshots__\\handler.snap",
      nodes: [{ type: "Program" }],
      rule: snapshotLocationRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });
});
