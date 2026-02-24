import { describe, expect, test } from "bun:test";
import { actionMustRegisterRule } from "../../rules/action-must-register.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

describe("action-must-register", () => {
  test("reports actions defined with defineAction() but missing from registry imports", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/actions/orphan.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registrySourceText:
            'import { notOrphanAction } from "./actions/orphan.js";',
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: readFixture("invalid/action-must-register.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("actionMustRegister");
    expect(reports[0]?.data?.actionName).toBe("orphanAction");
  });

  test("allows actions that are imported in the central registry", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/actions/registered.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registrySourceText:
            'import { registeredAction } from "./actions/registered.js";',
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: readFixture("valid/action-must-register.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores files outside apps/outfitter/src/actions", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "packages/logging/src/handler.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registrySourceText:
            'import { orphanAction } from "./actions/orphan.js";',
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: readFixture("invalid/action-must-register.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("reports only unregistered actions when file has multiple defineAction exports", () => {
    const multiActionSource = [
      'import { defineAction } from "./define-action.js";',
      "",
      "export const alphaAction = defineAction({",
      '  id: "alpha.action",',
      "  handler: async () => ({ isOk: () => true, value: undefined }),",
      "});",
      "",
      "export const betaAction = defineAction({",
      '  id: "beta.action",',
      "  handler: async () => ({ isOk: () => true, value: undefined }),",
      "});",
      "",
      "export const gammaAction = defineAction({",
      '  id: "gamma.action",',
      "  handler: async () => ({ isOk: () => true, value: undefined }),",
      "});",
    ].join("\n");

    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/actions/multi.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registrySourceText:
            'import { alphaAction, gammaAction } from "./actions/multi.js";',
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: multiActionSource,
    });

    // Only betaAction is missing from the registry
    expect(reports).toHaveLength(1);
    expect(reports[0]?.data?.actionName).toBe("betaAction");
  });

  test("resolves aliased imports (import { x as y }) by original name", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/actions/registered.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registrySourceText:
            'import { registeredAction as myAction } from "./actions/registered.js";',
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: readFixture("valid/action-must-register.ts"),
    });

    // "registeredAction as myAction" — the rule splits on "as" and uses "registeredAction"
    expect(reports).toHaveLength(0);
  });

  test("ignores files in nested directories under actions", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/actions/nested/deep.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registrySourceText:
            'import { orphanAction } from "./actions/nested/deep.js";',
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: readFixture("invalid/action-must-register.ts"),
    });

    // Files with "/" in the module portion are excluded — only direct children
    expect(reports).toHaveLength(0);
  });

  test("produces no reports when registrySourceText is undefined and file cannot be read", () => {
    const reports = runRuleForEvent({
      event: "Program",
      filename: "apps/outfitter/src/actions/orphan.ts",
      nodes: [{ type: "Program" }],
      options: [
        {
          registryFilePath: "/nonexistent/path/to/actions.ts",
        },
      ],
      rule: actionMustRegisterRule,
      sourceText: readFixture("invalid/action-must-register.ts"),
    });

    // No registry source text resolved -> no reports
    expect(reports).toHaveLength(0);
  });
});
