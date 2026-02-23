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

  test("mapInput resolves --kind filter flag", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { kind: "guide" },
    }) as { kind: string | undefined };

    expect(mapped.kind).toBe("guide");
  });

  test("mapInput resolves --package filter flag", () => {
    const action = outfitterActions.get("docs.search");
    const mapped = action?.cli?.mapInput?.({
      args: ["handler"],
      flags: { package: "cli" },
    }) as { package: string | undefined };

    expect(mapped.package).toBe("cli");
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
