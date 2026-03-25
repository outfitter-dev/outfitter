import { describe, expect, test } from "bun:test";

import { normalizeGlobalJsonFlag } from "../cli.js";

describe("normalizeGlobalJsonFlag", () => {
  test("relocates --json from after subcommand to global position", () => {
    const argv = ["node", "outfitter", "check", "--json"];
    expect(normalizeGlobalJsonFlag(argv)).toEqual([
      "node",
      "outfitter",
      "--json",
      "check",
    ]);
  });

  test("returns unchanged argv when no --json present", () => {
    const argv = ["node", "outfitter", "check", "--verbose"];
    expect(normalizeGlobalJsonFlag(argv)).toEqual(argv);
  });

  test("does not relocate --json that appears after -- separator", () => {
    const argv = ["node", "outfitter", "check", "--", "--json"];
    expect(normalizeGlobalJsonFlag(argv)).toEqual([
      "node",
      "outfitter",
      "check",
      "--",
      "--json",
    ]);
  });

  test("relocates --json before -- but preserves --json after --", () => {
    const argv = ["node", "outfitter", "--json", "check", "--", "--json"];
    // The first --json (index 2) is within the search window (bound = 4, the
    // index of --), so it gets relocated. Because prefixLength = 2, it lands
    // back at index 2 — same position. The second --json after -- is outside
    // the search window and stays in place.
    expect(normalizeGlobalJsonFlag(argv)).toEqual([
      "node",
      "outfitter",
      "--json",
      "check",
      "--",
      "--json",
    ]);
  });

  test("handles -- as only argument after prefix", () => {
    const argv = ["node", "outfitter", "--"];
    expect(normalizeGlobalJsonFlag(argv)).toEqual(["node", "outfitter", "--"]);
  });

  test("handles multiple --json flags before --", () => {
    const argv = ["node", "outfitter", "check", "--json", "sub", "--json"];
    expect(normalizeGlobalJsonFlag(argv)).toEqual([
      "node",
      "outfitter",
      "--json",
      "--json",
      "check",
      "sub",
    ]);
  });

  test("does not relocate --json at index 0 or 1", () => {
    const argv = ["--json", "--json", "check"];
    expect(normalizeGlobalJsonFlag(argv)).toEqual([
      "--json",
      "--json",
      "check",
    ]);
  });
});
