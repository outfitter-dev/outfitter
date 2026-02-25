import { describe, expect, test } from "bun:test";

import { testFileNamingRule } from "../../rules/test-file-naming.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

describe("test-file-naming", () => {
  const sourceText = readFixture("invalid/test-file-naming.ts");
  const validSourceText = readFixture("valid/test-file-naming.ts");

  test("reports .spec.ts filenames", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/__tests__/logger.spec.ts",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("testFileNaming");
  });

  test("reports .spec.tsx filenames", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/tui/src/__tests__/component.spec.tsx",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("testFileNaming");
  });

  test("reports .spec.js filenames", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/cli/src/__tests__/utils.spec.js",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("testFileNaming");
  });

  test("reports .spec.mts filenames", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/config/src/__tests__/loader.spec.mts",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("testFileNaming");
  });

  test("allows .test.ts filenames", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/__tests__/logger.test.ts",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("allows .test.tsx filenames", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/tui/src/__tests__/component.test.tsx",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-spec and non-test files", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/logger.ts",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("normalizes Windows-style path separators", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages\\logging\\src\\__tests__\\logger.spec.ts",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("testFileNaming");
  });

  test("does not report when filename is undefined", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "",
      nodes: [{ type: "Program" }],
      rule: testFileNamingRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });
});
