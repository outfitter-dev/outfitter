import { describe, expect, test } from "bun:test";
import { preferBunApiRule } from "../../rules/prefer-bun-api.js";
import {
  createImportDeclarationNode,
  readFixture,
  runRuleForEvent,
} from "../rule-test-helpers.js";

function extractImportSources(sourceText: string): string[] {
  return Array.from(sourceText.matchAll(/from\s+"([^"]+)"/gu)).map(
    (match) => match[1]
  );
}

describe("prefer-bun-api", () => {
  test("reports mapped imports with Bun alternatives", () => {
    const invalidSource = readFixture("invalid/prefer-bun-api.ts");
    const importSources = extractImportSources(invalidSource);
    const importNodes = importSources.map((importSource) =>
      createImportDeclarationNode(importSource)
    );

    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: importNodes,
      rule: preferBunApiRule,
      sourceText: invalidSource,
    });

    expect(reports).toHaveLength(importSources.length);
    expect(reports.every((report) => report.messageId === "preferBunApi")).toBe(
      true
    );
    expect(
      reports.find((report) => report.data?.importName === "node:crypto")?.data
        ?.bunAlternative
    ).toBe("Bun.hash(), Bun.CryptoHasher");
  });

  test("keeps Bun-native fixture clean", () => {
    const validSource = readFixture("valid/prefer-bun-api.ts");
    const importSources = extractImportSources(validSource);
    const importNodes = importSources.map((importSource) =>
      createImportDeclarationNode(importSource)
    );

    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: importNodes,
      rule: preferBunApiRule,
      sourceText: validSource,
    });

    expect(reports).toHaveLength(0);
  });

  test("supports custom mapping extensions", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: [createImportDeclarationNode("left-pad")],
      options: [{ mappings: { "left-pad": "Bun.stringWidth()" } }],
      rule: preferBunApiRule,
      sourceText: 'import leftPad from "left-pad";',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("preferBunApi");
    expect(reports[0]?.data?.bunAlternative).toBe("Bun.stringWidth()");
  });

  test("supports custom mapping overrides", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: [createImportDeclarationNode("crypto")],
      options: [{ mappings: { crypto: "Bun.CryptoHasher" } }],
      rule: preferBunApiRule,
      sourceText: 'import { createHash } from "crypto";',
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.bunAlternative).toBe("Bun.CryptoHasher");
  });

  test("ignores non-mapped imports", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: [createImportDeclarationNode("lodash")],
      rule: preferBunApiRule,
      sourceText: 'import _ from "lodash";',
    });

    expect(reports).toHaveLength(0);
  });

  test("filters empty string mapping values from custom mappings", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: [createImportDeclarationNode("left-pad")],
      options: [{ mappings: { "left-pad": "" } }],
      rule: preferBunApiRule,
      sourceText: 'import leftPad from "left-pad";',
    });

    expect(reports).toHaveLength(0);
  });

  test("verifies all default mappings individually", () => {
    const defaultMappings: Record<string, string> = {
      "better-sqlite3": "bun:sqlite",
      crypto: "Bun.hash(), Bun.CryptoHasher",
      glob: "Bun.Glob",
      "node:crypto": "Bun.hash(), Bun.CryptoHasher",
      semver: "Bun.semver",
      uuid: "Bun.randomUUIDv7()",
    };

    for (const [importName, expectedAlternative] of Object.entries(
      defaultMappings
    )) {
      const reports = runRuleForEvent({
        event: "ImportDeclaration",
        filename: "apps/outfitter/src/commands/check.ts",
        nodes: [createImportDeclarationNode(importName)],
        rule: preferBunApiRule,
        sourceText: `import x from "${importName}";`,
      });

      expect(reports).toHaveLength(1);
      expect(reports[0]?.data?.importName).toBe(importName);
      expect(reports[0]?.data?.bunAlternative).toBe(expectedAlternative);
    }
  });

  test("does not report bun:sqlite import (Bun-native is ok)", () => {
    const reports = runRuleForEvent({
      event: "ImportDeclaration",
      filename: "apps/outfitter/src/commands/check.ts",
      nodes: [createImportDeclarationNode("bun:sqlite")],
      rule: preferBunApiRule,
      sourceText: 'import { Database } from "bun:sqlite";',
    });

    expect(reports).toHaveLength(0);
  });
});
