import { describe, expect, test } from "bun:test";

import { Command } from "commander";

import { applyDemoRootFlags, resolveDemoRootFlags } from "../cli-root-flags.js";

describe("demo root flag presets", () => {
  test("registers standard option definitions on the root command", () => {
    const command = applyDemoRootFlags(new Command("outfitter-demo"));
    expect(command.options.map((option) => option.flags)).toEqual([
      "-l, --list",
      "-a, --animate",
      "--jsonl",
    ]);
  });

  test("resolves booleans with defaults", () => {
    expect(resolveDemoRootFlags({})).toEqual({
      list: false,
      animate: false,
      jsonl: false,
    });

    expect(
      resolveDemoRootFlags({ list: true, animate: true, jsonl: true })
    ).toEqual({
      list: true,
      animate: true,
      jsonl: true,
    });
  });
});
