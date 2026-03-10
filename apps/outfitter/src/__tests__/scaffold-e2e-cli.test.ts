import { describe, expect, test } from "bun:test";

import { parseScaffoldE2EArgs } from "../scaffold-e2e/cli.js";

describe("scaffold e2e cli args", () => {
  test("uses the ci profile when requested", () => {
    expect(parseScaffoldE2EArgs(["--ci"])).toMatchObject({
      clean: false,
      keep: false,
      profile: "ci",
      presets: undefined,
    });
  });

  test("rejects preset filters during full cleanup", () => {
    expect(() => parseScaffoldE2EArgs(["--clean", "--preset", "cli"])).toThrow(
      "--clean cannot be combined with --preset"
    );
  });
});
