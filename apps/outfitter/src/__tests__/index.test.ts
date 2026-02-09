/**
 * Outfitter CLI public API smoke tests.
 *
 * Ensures exports load without executing the CLI entrypoint.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import {
  CREATE_PRESET_IDS,
  InitError,
  initCommand,
  planCreateProject,
} from "../index.js";

describe("outfitter public API", () => {
  test("exports initCommand", () => {
    expect(typeof initCommand).toBe("function");
  });

  test("exports InitError", () => {
    const err = new InitError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("InitError");
  });

  test("exports create presets", () => {
    expect(CREATE_PRESET_IDS).toEqual(["basic", "cli", "daemon", "mcp"]);
  });

  test("exports planCreateProject", () => {
    const result = planCreateProject({
      name: "smoke-app",
      targetDir: "/tmp/smoke-app",
      preset: "basic",
      year: "2026",
    });

    expect(result.isOk()).toBe(true);
  });
});
