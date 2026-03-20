/**
 * Tests for `docs.index` action — registration and mapInput.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { outfitterActions } from "../actions.js";

describe("docs.index action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.index");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.index");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
    expect(action?.surfaces).toContain("mcp");
  });

  test("has CLI group 'docs' and command 'index'", () => {
    const action = outfitterActions.get("docs.index");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("index");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.index");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.index");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.index");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});
