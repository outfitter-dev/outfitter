import { describe, expect, test } from "bun:test";
import { noProcessEnvInPackagesRule } from "../../rules/no-process-env-in-packages.js";
import {
  countPattern,
  createMemberExpressionNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

describe("no-process-env-in-packages", () => {
  test("reports process.env usage in packages source files", () => {
    const invalidSource = readFixture(
      "invalid/no-process-env-in-packages.ts"
    );
    const envCount = countPattern(
      invalidSource,
      /\bprocess\s*\.\s*env\b/gu
    );
    const envReads = Array.from({ length: envCount }, () =>
      createMemberExpressionNode("process", "env")
    );

    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename: "packages/config/src/environment.ts",
      nodes: envReads,
      rule: noProcessEnvInPackagesRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(envCount);
    for (const report of reports) {
      expect(report.messageId).toBe("noProcessEnvInPackages");
    }
  });

  test("does not report process.cwd access", () => {
    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename: "packages/file-ops/src/workspace.ts",
      nodes: [createMemberExpressionNode("process", "cwd")],
      rule: noProcessEnvInPackagesRule,
      sourceText: "const dir = process.cwd();",
    });

    expect(reports).toHaveLength(0);
  });

  test("does not report process.kill access", () => {
    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename: "packages/daemon/src/platform.ts",
      nodes: [createMemberExpressionNode("process", "kill")],
      rule: noProcessEnvInPackagesRule,
      sourceText: 'process.kill(pid, "SIGTERM");',
    });

    expect(reports).toHaveLength(0);
  });

  test("reports multiple process.env accesses in one pass", () => {
    const nodes = [
      createMemberExpressionNode("process", "env"),
      createMemberExpressionNode("process", "env"),
      createMemberExpressionNode("process", "env"),
    ];

    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename: "packages/config/src/loader.ts",
      nodes,
      rule: noProcessEnvInPackagesRule,
      sourceText:
        'process.env["A"];\nprocess.env["B"];\nprocess.env["C"];',
    });

    expect(reports).toHaveLength(3);
  });

  test("excludes test files from reporting", () => {
    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename:
        "packages/config/src/__tests__/environment.test.ts",
      nodes: [createMemberExpressionNode("process", "env")],
      rule: noProcessEnvInPackagesRule,
      sourceText: 'process.env["NODE_ENV"] = "test";',
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-package source files", () => {
    const invalidSource = readFixture(
      "invalid/no-process-env-in-packages.ts"
    );
    const envRead = [createMemberExpressionNode("process", "env")];

    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename: "apps/outfitter/src/cli.ts",
      nodes: envRead,
      rule: noProcessEnvInPackagesRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(0);
  });

  test("keeps valid fixture clean", () => {
    const validSource = readFixture(
      "valid/no-process-env-in-packages.ts"
    );

    const reports = runRuleForEvent({
      event: "MemberExpression",
      filename: "packages/config/src/environment.ts",
      nodes: [],
      rule: noProcessEnvInPackagesRule,
      sourceText: validSource,
    });

    expect(reports).toHaveLength(0);
  });
});
