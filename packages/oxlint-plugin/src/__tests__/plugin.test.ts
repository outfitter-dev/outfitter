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
    expect(Object.keys(plugin.rules)).toEqual([
      "action-must-register",
      "handler-must-return-result",
      "max-file-lines",
      "no-console-in-packages",
      "no-cross-tier-import",
      "no-deep-relative-import",
      "no-nested-barrel",
      "no-process-env-in-packages",
      "no-process-exit-in-packages",
      "no-throw-in-handler",
      "prefer-bun-api",
      "snapshot-location",
      "test-file-naming",
      "use-error-taxonomy",
    ]);
  });

  test("provides a recommended flat-config scaffold", () => {
    const recommended = plugin.configs.recommended;

    expect(recommended).toBeDefined();
    expect(recommended.plugins.outfitter).toBe(plugin);
    expect(recommended.rules).toEqual({
      "outfitter/action-must-register": "warn",
      "outfitter/handler-must-return-result": "error",
      "outfitter/no-throw-in-handler": "error",
      "outfitter/no-console-in-packages": "error",
      "outfitter/no-cross-tier-import": "error",
      "outfitter/no-deep-relative-import": "warn",
      "outfitter/no-nested-barrel": "warn",
      "outfitter/no-process-exit-in-packages": "error",
      "outfitter/no-process-env-in-packages": "warn",
      "outfitter/max-file-lines": ["error", { warn: 200, error: 400 }],
      "outfitter/prefer-bun-api": "warn",
      "outfitter/snapshot-location": "warn",
      "outfitter/test-file-naming": "warn",
      "outfitter/use-error-taxonomy": "warn",
    });
  });
});
