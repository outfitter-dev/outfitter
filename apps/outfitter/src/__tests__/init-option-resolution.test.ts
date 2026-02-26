import { describe, expect, test } from "bun:test";

import { resolvePresetFromFlags } from "../commands/init-option-resolution.js";

describe("resolvePresetFromFlags", () => {
  test("accepts a known preset that is available", () => {
    const result = resolvePresetFromFlags("minimal", ["minimal", "cli", "mcp"]);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("minimal");
    }
  });

  test("rejects a known preset when it is not in available presets", () => {
    const result = resolvePresetFromFlags("cli", ["minimal", "mcp"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toContain("Unknown preset 'cli'");
      expect(result.error).toContain("Available presets: minimal, mcp");
    }
  });

  test("does not list unknown dynamic IDs in available preset errors", () => {
    const result = resolvePresetFromFlags("new-target", [
      "minimal",
      "new-target",
    ]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toContain("Unknown preset 'new-target'");
      expect(result.error).toContain("Available presets: minimal");
      expect(result.error).not.toContain("minimal, new-target");
    }
  });
});
