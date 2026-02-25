import { describe, expect, test } from "bun:test";
import { noConsoleInPackagesRule } from "../../rules/no-console-in-packages.js";
import {
  countPattern,
  createCallExpressionNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

describe("no-console-in-packages", () => {
  test("reports console calls in packages source files", () => {
    const invalidSource = readFixture("invalid/no-console-in-packages.ts");
    const consoleCount = countPattern(invalidSource, /\bconsole\s*\./gu);
    const consoleCalls = Array.from({ length: consoleCount }, () =>
      createCallExpressionNode("console", "log")
    );

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/logger.ts",
      nodes: consoleCalls,
      rule: noConsoleInPackagesRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(consoleCount);
    for (const report of reports) {
      expect(report.messageId).toBe("noConsoleInPackages");
    }
  });

  test("reports console.warn calls", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/config/src/loader.ts",
      nodes: [createCallExpressionNode("console", "warn")],
      rule: noConsoleInPackagesRule,
      sourceText: 'console.warn("deprecation notice");',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noConsoleInPackages");
  });

  test("reports console.error calls", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/config/src/loader.ts",
      nodes: [createCallExpressionNode("console", "error")],
      rule: noConsoleInPackagesRule,
      sourceText: 'console.error("fatal failure");',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noConsoleInPackages");
  });

  test("reports console.info calls", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/config/src/loader.ts",
      nodes: [createCallExpressionNode("console", "info")],
      rule: noConsoleInPackagesRule,
      sourceText: 'console.info("starting up");',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noConsoleInPackages");
  });

  test("ignores non-console member calls", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/logger.ts",
      nodes: [createCallExpressionNode("logger", "info")],
      rule: noConsoleInPackagesRule,
      sourceText: 'logger.info("ok");',
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-member-expression call expressions", () => {
    // A plain function call like `doSomething()` has no member expression callee
    const plainCallNode = {
      type: "CallExpression",
      callee: {
        type: "Identifier",
        name: "doSomething",
      },
    };

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/logger.ts",
      nodes: [plainCallNode],
      rule: noConsoleInPackagesRule,
      sourceText: "doSomething();",
    });

    expect(reports).toHaveLength(0);
  });

  test("reports multiple console calls in one pass", () => {
    const nodes = [
      createCallExpressionNode("console", "log"),
      createCallExpressionNode("console", "warn"),
      createCallExpressionNode("console", "error"),
    ];

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/logger.ts",
      nodes,
      rule: noConsoleInPackagesRule,
      sourceText:
        'console.log("a");\nconsole.warn("b");\nconsole.error("c");',
    });

    expect(reports).toHaveLength(3);
  });

  test("ignores apps and package test files", () => {
    const invalidSource = readFixture("invalid/no-console-in-packages.ts");
    const consoleCall = [createCallExpressionNode("console", "log")];

    const appReports = runRuleForEvent({
      event: "CallExpression",
      filename: "apps/outfitter/src/cli.ts",
      nodes: consoleCall,
      rule: noConsoleInPackagesRule,
      sourceText: invalidSource,
    });

    const testReports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/__tests__/logger.test.ts",
      nodes: consoleCall,
      rule: noConsoleInPackagesRule,
      sourceText: invalidSource,
    });

    expect(appReports).toHaveLength(0);
    expect(testReports).toHaveLength(0);
  });

  test("keeps valid fixture clean", () => {
    const validSource = readFixture("valid/no-console-in-packages.ts");

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/logger.ts",
      nodes: [],
      rule: noConsoleInPackagesRule,
      sourceText: validSource,
    });

    expect(reports).toHaveLength(0);
  });
});
