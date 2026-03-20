/**
 * Tests for `docs.search` action -- registration, mapInput, and handler.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { outfitterActions } from "../actions.js";

describe("docs.search action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.search");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.search");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
    expect(action?.surfaces).toContain("mcp");
  });

  test("has CLI group 'docs' and command 'search <query>'", () => {
    const action = outfitterActions.get("docs.search");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("search <query>");
  });

  test("mapInput resolves positional query argument", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: {},
    }) as { query: string };

    expect(mapped.query).toBe("handler");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves --limit flag as number", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { limit: "5" },
    }) as { limit: number | undefined };

    expect(mapped.limit).toBe(5);
  });

  test("mapInput omits limit when flag not provided", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: {},
    }) as { limit?: number };

    expect(mapped.limit).toBeUndefined();
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("mapInput resolves --jq expression", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { output: "json", jq: ".matches[0]" },
    }) as { jq: string | undefined };

    expect(mapped.jq).toBe(".matches[0]");
  });
});
