import { describe, expect, test } from "bun:test";

import {
  parseScaffoldE2EArgs,
  resolveScaffoldE2EScriptPlan,
} from "../scaffold-e2e/cli.js";

describe("scaffold e2e cli args", () => {
  test("uses the ci profile when requested", () => {
    expect(parseScaffoldE2EArgs(["--ci"])).toMatchObject({
      clean: false,
      keep: false,
      profile: "ci",
      presets: undefined,
    });
  });

  test("uses ci profile presets when no explicit preset filter is provided", () => {
    const plan = resolveScaffoldE2EScriptPlan(parseScaffoldE2EArgs(["--ci"]));

    expect(plan.profile.id).toBe("ci");
    expect(plan.presets).toEqual(["cli", "library", "full-stack"]);
  });

  test("rejects preset filters during full cleanup", () => {
    expect(() => parseScaffoldE2EArgs(["--clean", "--preset", "cli"])).toThrow(
      "--clean cannot be combined with --preset"
    );
  });
});
