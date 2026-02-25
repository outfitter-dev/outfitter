import { describe, expect, test } from "bun:test";
import { noThrowInHandlerRule } from "../../rules/no-throw-in-handler.js";
import {
  countPattern,
  createThrowStatementNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

describe("no-throw-in-handler", () => {
  test("reports throw statements in packages source files", () => {
    const invalidSource = readFixture("invalid/no-throw-in-handler.ts");
    const throwCount = countPattern(invalidSource, /\bthrow\b/gu);
    const throwNodes = Array.from({ length: throwCount }, () =>
      createThrowStatementNode()
    );

    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/contracts/src/handler.ts",
      nodes: throwNodes,
      rule: noThrowInHandlerRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(throwCount);
    for (const report of reports) {
      expect(report.messageId).toBe("noThrowInHandler");
    }
  });

  test("reports throw new Error pattern", () => {
    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/cli/src/command.ts",
      nodes: [createThrowStatementNode()],
      rule: noThrowInHandlerRule,
      sourceText: 'throw new Error("boom");',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noThrowInHandler");
  });

  test("reports throw with string literal", () => {
    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/cli/src/command.ts",
      nodes: [createThrowStatementNode()],
      rule: noThrowInHandlerRule,
      sourceText: 'throw "something went wrong";',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noThrowInHandler");
  });

  test("reports throw with variable reference", () => {
    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/cli/src/command.ts",
      nodes: [createThrowStatementNode()],
      rule: noThrowInHandlerRule,
      sourceText:
        'const err = new RangeError("out of range");\nthrow err;',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noThrowInHandler");
  });

  test("reports multiple throw statements in one pass", () => {
    const nodes = [
      createThrowStatementNode(),
      createThrowStatementNode(),
      createThrowStatementNode(),
    ];

    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/config/src/loader.ts",
      nodes,
      rule: noThrowInHandlerRule,
      sourceText: "throw 1;\nthrow 2;\nthrow 3;",
    });

    expect(reports).toHaveLength(3);
  });

  test("ignores apps and package test files", () => {
    const invalidSource = readFixture("invalid/no-throw-in-handler.ts");
    const throwNodes = [createThrowStatementNode()];

    const appReports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "apps/outfitter/src/cli.ts",
      nodes: throwNodes,
      rule: noThrowInHandlerRule,
      sourceText: invalidSource,
    });

    const testReports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/contracts/src/__tests__/handler.test.ts",
      nodes: throwNodes,
      rule: noThrowInHandlerRule,
      sourceText: invalidSource,
    });

    expect(appReports).toHaveLength(0);
    expect(testReports).toHaveLength(0);
  });

  test("excludes .test.ts files by extension pattern", () => {
    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/contracts/src/handler.test.ts",
      nodes: [createThrowStatementNode()],
      rule: noThrowInHandlerRule,
      sourceText: 'throw new Error("test assertion");',
    });

    expect(reports).toHaveLength(0);
  });

  test("normalizes Windows-style path separators", () => {
    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages\\contracts\\src\\handler.ts",
      nodes: [createThrowStatementNode()],
      rule: noThrowInHandlerRule,
      sourceText: 'throw new Error("boom");',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noThrowInHandler");
  });

  test("keeps valid fixture clean", () => {
    const validSource = readFixture("valid/no-throw-in-handler.ts");

    const reports = runRuleForEvent({
      event: "ThrowStatement",
      filename: "packages/contracts/src/handler.ts",
      nodes: [],
      rule: noThrowInHandlerRule,
      sourceText: validSource,
    });

    expect(reports).toHaveLength(0);
  });
});
