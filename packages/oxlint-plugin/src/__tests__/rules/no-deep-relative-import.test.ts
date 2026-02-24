import { describe, expect, test } from "bun:test";
import { noDeepRelativeImportRule } from "../../rules/no-deep-relative-import.js";
import {
  createImportDeclarationNode,
  createRequireCallNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

describe("no-deep-relative-import", () => {
  const invalidSourceText = readFixture("invalid/no-deep-relative-import.ts");
  const validSourceText = readFixture("valid/no-deep-relative-import.ts");

  test("reports deep relative import paths by default", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("../../../shared/value")],
      rule: noDeepRelativeImportRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noDeepRelativeImport");
  });

  test("reports deep require() paths by default", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/index.ts",
      nodes: [createRequireCallNode("../../../../shared/deep")],
      rule: noDeepRelativeImportRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noDeepRelativeImport");
  });

  test("includes importSource and maxParentSegments in report data", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("../../../shared/value")],
      rule: noDeepRelativeImportRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.data).toEqual({
      importSource: "../../../shared/value",
      maxParentSegments: 2,
    });
  });

  test("allows imports exactly at the default boundary of 2 parent segments", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("../../shared/value")],
      rule: noDeepRelativeImportRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("allows shallow relative imports", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("../../shared/value")],
      rule: noDeepRelativeImportRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores ./ relative imports with no parent segments", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("./local.js")],
      rule: noDeepRelativeImportRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-relative (bare package) imports", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/contracts")],
      rule: noDeepRelativeImportRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("reports single ../ when maxParentSegments is 0", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("../sibling.js")],
      options: [{ maxParentSegments: 0 }],
      rule: noDeepRelativeImportRule,
      sourceText: validSourceText,
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noDeepRelativeImport");
    expect(reports[0]?.data).toEqual({
      importSource: "../sibling.js",
      maxParentSegments: 0,
    });
  });

  test("supports configurable depth threshold", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("../../../shared/value")],
      options: [{ maxParentSegments: 4 }],
      rule: noDeepRelativeImportRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores non-package source files", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/index.ts",
      nodes: [createImportDeclarationNode("../../../shared/value")],
      rule: noDeepRelativeImportRule,
      sourceText: invalidSourceText,
    });

    expect(reports).toHaveLength(0);
  });
});
