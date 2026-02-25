import { describe, expect, test } from "bun:test";
import { useErrorTaxonomyRule } from "../../rules/use-error-taxonomy.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

function createClassDeclarationNode(superClassName: string): unknown {
  return {
    type: "ClassDeclaration",
    id: {
      type: "Identifier",
      name: "CustomError",
    },
    superClass: {
      type: "Identifier",
      name: superClassName,
    },
  };
}

function createClassExpressionNode(superClassName: string): unknown {
  return {
    type: "ClassExpression",
    superClass: {
      type: "Identifier",
      name: superClassName,
    },
  };
}

describe("use-error-taxonomy", () => {
  test("reports classes that extend Error in package source", () => {
    const reports = runRuleForEvent({
      event: "ClassDeclaration",
      filename: "packages/logging/src/errors.ts",
      nodes: [createClassDeclarationNode("Error")],
      rule: useErrorTaxonomyRule,
      sourceText: readFixture("invalid/use-error-taxonomy.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("useErrorTaxonomy");
  });

  test("allows contracts package to define Error hierarchy", () => {
    const reports = runRuleForEvent({
      event: "ClassDeclaration",
      filename: "packages/contracts/src/errors.ts",
      nodes: [createClassDeclarationNode("Error")],
      rule: useErrorTaxonomyRule,
      sourceText: readFixture("invalid/use-error-taxonomy.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("allows classes extending non-Error base types", () => {
    const reports = runRuleForEvent({
      event: "ClassDeclaration",
      filename: "packages/logging/src/errors.ts",
      nodes: [createClassDeclarationNode("ValidationError")],
      rule: useErrorTaxonomyRule,
      sourceText: readFixture("valid/use-error-taxonomy.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("reports ClassExpression extending Error in package source", () => {
    const reports = runRuleForEvent({
      event: "ClassExpression",
      filename: "packages/logging/src/errors.ts",
      nodes: [createClassExpressionNode("Error")],
      rule: useErrorTaxonomyRule,
      sourceText: 'const MyError = class extends Error {};',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("useErrorTaxonomy");
  });

  test("ignores files in apps directory", () => {
    const reports = runRuleForEvent({
      event: "ClassDeclaration",
      filename: "apps/outfitter/src/errors.ts",
      nodes: [createClassDeclarationNode("Error")],
      rule: useErrorTaxonomyRule,
      sourceText: readFixture("invalid/use-error-taxonomy.ts"),
    });

    // isPackageSourceFile returns false for apps/ paths
    expect(reports).toHaveLength(0);
  });

  test("allows extending TypeError and other named error subclasses", () => {
    const namedErrors = ["TypeError", "RangeError", "SyntaxError"];

    for (const errorName of namedErrors) {
      const reports = runRuleForEvent({
        event: "ClassDeclaration",
        filename: "packages/logging/src/errors.ts",
        nodes: [createClassDeclarationNode(errorName)],
        rule: useErrorTaxonomyRule,
        sourceText: `export class CustomError extends ${errorName} {}`,
      });

      // Only the exact name "Error" triggers the rule, not subclasses like TypeError
      expect(reports).toHaveLength(0);
    }
  });

  test("excludes test files from reporting", () => {
    const reports = runRuleForEvent({
      event: "ClassDeclaration",
      filename: "packages/logging/src/__tests__/errors.test.ts",
      nodes: [createClassDeclarationNode("Error")],
      rule: useErrorTaxonomyRule,
      sourceText: readFixture("invalid/use-error-taxonomy.ts"),
    });

    // isPackageSourceFile filters out __tests__/ paths and .test.ts files
    expect(reports).toHaveLength(0);
  });
});
