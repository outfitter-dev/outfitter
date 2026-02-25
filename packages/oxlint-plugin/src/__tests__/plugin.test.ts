import { describe, expect, test } from "bun:test";

import packageMetadata from "../../package.json";
import plugin, { rules } from "../index.js";

describe("oxlint plugin scaffold", () => {
  test("exports plugin metadata", () => {
    expect(plugin.meta.name).toBe("@outfitter/oxlint-plugin");
    expect(plugin.meta.version).toBe(packageMetadata.version);
  });

  test("exports a rule registry", () => {
    expect(plugin.rules).toBe(rules);
    expect(Object.keys(plugin.rules)).toHaveLength(0);
  });

  test("provides a recommended flat-config scaffold", () => {
    const recommended = plugin.configs.recommended;

    expect(recommended).toBeDefined();
    expect(recommended.plugins.outfitter).toBe(plugin);
    expect(recommended.rules).toEqual({});
  });
});
