import { describe, expect, test } from "bun:test";

import {
  canonicalizeJson,
  checkSurfaceMapFormat,
} from "../commands/check-surface-map-format.js";

describe("checkSurfaceMapFormat", () => {
  test("passes for oxfmt-canonical JSON with trailing newline", () => {
    const canonical = '{\n  "a": 1,\n  "b": [1, 2]\n}\n';

    const result = checkSurfaceMapFormat(canonical, "/tmp/surface.json");

    expect(result.ok).toBe(true);
  });

  test("fails for multiline-array formatting drift", () => {
    const nonCanonical = '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}\n';

    const result = checkSurfaceMapFormat(nonCanonical, "/tmp/surface.json");

    expect(result.ok).toBe(false);
    expect(result.expected).toBe(
      canonicalizeJson(nonCanonical, "/tmp/surface.json")
    );
  });
});
