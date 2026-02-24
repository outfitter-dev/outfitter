import { describe, expect, test } from "bun:test";
import { maxFileLinesRule } from "../../rules/max-file-lines.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

describe("max-file-lines", () => {
  test("warns and errors at configured thresholds", () => {
    const warnFixture = readFixture("invalid/max-file-lines-warn.ts");
    const errorFixture = readFixture("invalid/max-file-lines-error.ts");

    const warnReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 3, error: 5 }],
      rule: maxFileLinesRule,
      sourceText: warnFixture,
    });

    const errorReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 3, error: 5 }],
      rule: maxFileLinesRule,
      sourceText: errorFixture,
    });

    expect(warnReports).toHaveLength(1);
    expect(warnReports[0]?.messageId).toBe("fileTooLongWarn");

    expect(errorReports).toHaveLength(1);
    expect(errorReports[0]?.messageId).toBe("fileTooLongError");
  });

  test("uses default thresholds of 200 warn and 400 error", () => {
    // 201 lines should trigger warn with default thresholds
    const lines201 = Array.from({ length: 201 }, (_, i) => `// line ${i + 1}`).join("\n");

    const warnReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [],
      rule: maxFileLinesRule,
      sourceText: lines201,
    });

    expect(warnReports).toHaveLength(1);
    expect(warnReports[0]?.messageId).toBe("fileTooLongWarn");

    // 200 lines should be fine
    const lines200 = Array.from({ length: 200 }, (_, i) => `// line ${i + 1}`).join("\n");

    const okReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [],
      rule: maxFileLinesRule,
      sourceText: lines200,
    });

    expect(okReports).toHaveLength(0);
  });

  test("includes lineCount, warnLimit, and errorLimit in report data", () => {
    const warnReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 3, error: 10 }],
      rule: maxFileLinesRule,
      sourceText: "a\nb\nc\nd\ne",
    });

    expect(warnReports).toHaveLength(1);
    expect(warnReports[0]?.messageId).toBe("fileTooLongWarn");
    expect(warnReports[0]?.data).toEqual({
      lineCount: 5,
      warnLimit: 3,
    });

    const errorReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 2, error: 3 }],
      rule: maxFileLinesRule,
      sourceText: "a\nb\nc\nd\ne",
    });

    expect(errorReports).toHaveLength(1);
    expect(errorReports[0]?.messageId).toBe("fileTooLongError");
    expect(errorReports[0]?.data).toEqual({
      lineCount: 5,
      errorLimit: 3,
    });
  });

  test("error takes precedence over warn when both thresholds exceeded", () => {
    // 6 lines exceeds both warn=3 and error=5
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 3, error: 5 }],
      rule: maxFileLinesRule,
      sourceText: "a\nb\nc\nd\ne\nf",
    });

    // Should only report error, not both
    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("fileTooLongError");
  });

  test("falls back to defaults when options are invalid", () => {
    // Non-object option
    const reportsNull = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [null],
      rule: maxFileLinesRule,
      sourceText: Array.from({ length: 201 }, () => "x").join("\n"),
    });

    expect(reportsNull).toHaveLength(1);
    expect(reportsNull[0]?.messageId).toBe("fileTooLongWarn");

    // Non-integer values fall back to defaults
    const reportsBadValues = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: "abc", error: -5 }],
      rule: maxFileLinesRule,
      sourceText: Array.from({ length: 201 }, () => "x").join("\n"),
    });

    expect(reportsBadValues).toHaveLength(1);
    expect(reportsBadValues[0]?.messageId).toBe("fileTooLongWarn");
  });

  test("normalizes error <= warn by setting error to warn + 1", () => {
    // When error <= warn, the rule sets error = warn + 1
    // With warn=5 and error=3, resolved to warn=5, error=6
    // 6 lines should trigger warn (6 > 5) but not error (6 = 6, not > 6)
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 5, error: 3 }],
      rule: maxFileLinesRule,
      sourceText: "a\nb\nc\nd\ne\nf",
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("fileTooLongWarn");

    // 7 lines should trigger error (7 > 6)
    const errorReports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 5, error: 3 }],
      rule: maxFileLinesRule,
      sourceText: "a\nb\nc\nd\ne\nf\ng",
    });

    expect(errorReports).toHaveLength(1);
    expect(errorReports[0]?.messageId).toBe("fileTooLongError");
  });

  test("does not report on empty files", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/empty.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 1, error: 2 }],
      rule: maxFileLinesRule,
      sourceText: "",
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-package source files", () => {
    const errorFixture = readFixture("invalid/max-file-lines-error.ts");

    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/cli.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 3, error: 5 }],
      rule: maxFileLinesRule,
      sourceText: errorFixture,
    });

    expect(reports).toHaveLength(0);
  });

  test("keeps valid fixture clean", () => {
    const validFixture = readFixture("valid/max-file-lines.ts");

    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/types/src/index.ts",
      nodes: [{ type: "Program" }],
      options: [{ warn: 4, error: 6 }],
      rule: maxFileLinesRule,
      sourceText: validFixture,
    });

    expect(reports).toHaveLength(0);
  });
});
