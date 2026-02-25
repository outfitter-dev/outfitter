import { describe, expect, test } from "bun:test";
import { noProcessExitInPackagesRule } from "../../rules/no-process-exit-in-packages.js";
import {
  countPattern,
  createCallExpressionNode,
  createMemberExpressionNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

describe("no-process-exit-in-packages", () => {
  test("reports process.exit in packages source files", () => {
    const invalidSource = readFixture(
      "invalid/no-process-exit-in-packages.ts"
    );
    const exitCount = countPattern(
      invalidSource,
      /\bprocess\s*\.\s*exit\s*\(/gu
    );
    const exitCalls = Array.from({ length: exitCount }, () =>
      createCallExpressionNode("process", "exit")
    );

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/daemon/src/platform.ts",
      nodes: exitCalls,
      rule: noProcessExitInPackagesRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(exitCount);
    for (const report of reports) {
      expect(report.messageId).toBe("noProcessExitInPackages");
    }
  });

  test("does not report process.cwd() calls", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/file-ops/src/workspace.ts",
      nodes: [createCallExpressionNode("process", "cwd")],
      rule: noProcessExitInPackagesRule,
      sourceText: "const dir = process.cwd();",
    });

    expect(reports).toHaveLength(0);
  });

  test("does not report process.exit member access without call", () => {
    // The rule uses invokesMemberCall which checks for CallExpression;
    // a bare MemberExpression node passed as CallExpression won't match
    const memberNode = createMemberExpressionNode("process", "exit");

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/daemon/src/platform.ts",
      nodes: [memberNode],
      rule: noProcessExitInPackagesRule,
      sourceText: "const exitFn = process.exit;",
    });

    expect(reports).toHaveLength(0);
  });

  test("reports multiple exit calls in one pass", () => {
    const nodes = [
      createCallExpressionNode("process", "exit"),
      createCallExpressionNode("process", "exit"),
    ];

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/daemon/src/lifecycle.ts",
      nodes,
      rule: noProcessExitInPackagesRule,
      sourceText: "process.exit(0);\nprocess.exit(1);",
    });

    expect(reports).toHaveLength(2);
  });

  test("ignores non-process member calls", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/daemon/src/platform.ts",
      nodes: [createCallExpressionNode("app", "exit")],
      rule: noProcessExitInPackagesRule,
      sourceText: "app.exit();",
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-package source files", () => {
    const invalidSource = readFixture(
      "invalid/no-process-exit-in-packages.ts"
    );
    const exitCall = [createCallExpressionNode("process", "exit")];

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "apps/outfitter/src/cli.ts",
      nodes: exitCall,
      rule: noProcessExitInPackagesRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(0);
  });

  test("keeps valid fixture clean", () => {
    const validSource = readFixture(
      "valid/no-process-exit-in-packages.ts"
    );

    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/daemon/src/platform.ts",
      nodes: [],
      rule: noProcessExitInPackagesRule,
      sourceText: validSource,
    });

    expect(reports).toHaveLength(0);
  });
});
