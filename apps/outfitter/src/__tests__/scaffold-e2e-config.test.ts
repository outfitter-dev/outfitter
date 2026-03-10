import { describe, expect, test } from "bun:test";

import {
  getScaffoldE2ESuiteTimeoutBudgetMs,
  resolveScaffoldE2EProfile,
} from "../scaffold-e2e/config.js";

describe("scaffold e2e profiles", () => {
  test("default profile covers every preset with the priority presets first", () => {
    expect(resolveScaffoldE2EProfile("default")).toEqual({
      id: "default",
      presets: ["cli", "library", "full-stack", "minimal", "mcp", "daemon"],
      commandTimeoutMs: 240_000,
    });
  });

  test("ci profile keeps the smoke timeout budget within the workflow job budget", () => {
    const profile = resolveScaffoldE2EProfile("ci");

    expect(profile).toEqual({
      id: "ci",
      presets: ["cli", "library", "full-stack"],
      commandTimeoutMs: 120_000,
    });
    expect(getScaffoldE2ESuiteTimeoutBudgetMs(profile)).toBe(1_080_000);
  });
});
