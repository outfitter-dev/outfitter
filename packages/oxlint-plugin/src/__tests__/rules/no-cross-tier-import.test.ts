import { describe, expect, test } from "bun:test";
import { noCrossTierImportRule } from "../../rules/no-cross-tier-import.js";
import {
  createImportDeclarationNode,
  createRequireCallNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

function extractImportSources(sourceText: string): string[] {
  return Array.from(sourceText.matchAll(/from\s+"([^"]+)"/gu)).map(
    (match) => match[1]
  );
}

describe("no-cross-tier-import", () => {
  test("reports illegal tier boundary imports", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/contracts/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/logging")],
      rule: noCrossTierImportRule,
      sourceText: readFixture("invalid/no-cross-tier-import.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noCrossTierImport");
    expect(reports[0]?.data?.sourceTier).toBe("foundation");
    expect(reports[0]?.data?.targetTier).toBe("runtime");
  });

  test("reports runtime to tooling violations", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/tooling")],
      rule: noCrossTierImportRule,
      sourceText: readFixture("invalid/no-cross-tier-import.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.sourceTier).toBe("runtime");
    expect(reports[0]?.data?.targetTier).toBe("tooling");
  });

  test("reports tooling to runtime violations", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/tooling/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/cli")],
      rule: noCrossTierImportRule,
      sourceText: readFixture("invalid/no-cross-tier-import.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.sourceTier).toBe("tooling");
    expect(reports[0]?.data?.targetTier).toBe("runtime");
  });

  test("allows @outfitter/testing exception for runtime imports", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/testing/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/cli")],
      rule: noCrossTierImportRule,
      sourceText: readFixture("valid/no-cross-tier-import.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("reports require() violations", () => {
    const reports = runRuleForEvent({
      event: "CallExpression",
      filename: "packages/logging/src/index.ts",
      nodes: [createRequireCallNode("@outfitter/tooling")],
      rule: noCrossTierImportRule,
      sourceText: readFixture("invalid/no-cross-tier-import.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("noCrossTierImport");
  });

  test("keeps valid fixture imports clean", () => {
    const validSource = readFixture("valid/no-cross-tier-import.ts");
    const importNodes = extractImportSources(validSource).map((importSource) =>
      createImportDeclarationNode(importSource)
    );

    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: importNodes,
      rule: noCrossTierImportRule,
      sourceText: validSource,
    });

    expect(reports).toHaveLength(0);
  });

  test("supports custom tier config and custom exception list", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/testing/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/contracts")],
      options: [
        {
          tiers: {
            foundation: ["@outfitter/testing"],
            runtime: ["@outfitter/contracts"],
            tooling: [],
          },
          toolingRuntimeExceptions: [],
        },
      ],
      rule: noCrossTierImportRule,
      sourceText: 'import { Result } from "@outfitter/contracts";',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.sourceTier).toBe("foundation");
    expect(reports[0]?.data?.targetTier).toBe("runtime");
  });

  test("reports foundation to tooling violations", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/contracts/src/index.ts",
      nodes: [createImportDeclarationNode("outfitter")],
      rule: noCrossTierImportRule,
      sourceText: 'import { scaffold } from "outfitter";',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.sourceTier).toBe("foundation");
    expect(reports[0]?.data?.targetTier).toBe("tooling");
    expect(reports[0]?.data?.sourcePackage).toBe("@outfitter/contracts");
    expect(reports[0]?.data?.targetPackage).toBe("outfitter");
  });

  test("resolves apps/outfitter path as the outfitter tooling package", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: [createImportDeclarationNode("@outfitter/logging")],
      rule: noCrossTierImportRule,
      sourceText: 'import { getLogger } from "@outfitter/logging";',
    });

    // apps/outfitter resolves to "outfitter" which is in tooling tier;
    // @outfitter/logging is runtime -- tooling→runtime is a violation
    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.sourceTier).toBe("tooling");
    expect(reports[0]?.data?.targetTier).toBe("runtime");
    expect(reports[0]?.data?.sourcePackage).toBe("outfitter");
  });

  test("resolves sub-path imports to their base package", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/contracts/src/index.ts",
      nodes: [createImportDeclarationNode("@outfitter/cli/query")],
      rule: noCrossTierImportRule,
      sourceText: 'import { outputModePreset } from "@outfitter/cli/query";',
    });

    // @outfitter/cli/query -> @outfitter/cli (runtime tier)
    // source is contracts (foundation) -> runtime is a violation
    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.sourceTier).toBe("foundation");
    expect(reports[0]?.data?.targetTier).toBe("runtime");
    expect(reports[0]?.data?.targetPackage).toBe("@outfitter/cli");
  });

  test("ignores unknown packages that are not in any tier", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "packages/logging/src/index.ts",
      nodes: [createImportDeclarationNode("lodash")],
      rule: noCrossTierImportRule,
      sourceText: 'import _ from "lodash";',
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores files outside packages and apps directories", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "scripts/build.ts",
      nodes: [createImportDeclarationNode("@outfitter/logging")],
      rule: noCrossTierImportRule,
      sourceText: 'import { getLogger } from "@outfitter/logging";',
    });

    expect(reports).toHaveLength(0);
  });
});
