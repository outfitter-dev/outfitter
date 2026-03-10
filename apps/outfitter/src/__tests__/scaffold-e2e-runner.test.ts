import { describe, expect, test } from "bun:test";

import {
  DEFAULT_SCAFFOLD_E2E_PRESETS,
  resolveScaffoldE2EPresets,
} from "../scaffold-e2e/runner.js";

describe("scaffold e2e runner preset resolution", () => {
  test("defaults to CLI, library, and full-stack first", () => {
    expect(DEFAULT_SCAFFOLD_E2E_PRESETS).toEqual([
      "cli",
      "library",
      "full-stack",
      "minimal",
      "mcp",
      "daemon",
    ]);
  });

  test("supports repeated and comma-separated preset arguments", () => {
    expect(
      resolveScaffoldE2EPresets(["cli,library", "full-stack", "cli"])
    ).toEqual(["cli", "library", "full-stack"]);
  });

  test("rejects unknown presets", () => {
    expect(() => resolveScaffoldE2EPresets(["cli", "unknown"])).toThrow(
      "Unknown scaffold E2E preset(s): unknown"
    );
  });
});
