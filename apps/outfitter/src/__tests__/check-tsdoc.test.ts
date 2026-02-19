/**
 * Tests for check-tsdoc action registration and command wrapper.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { outfitterActions } from "../actions.js";
import { buildCheckTsdocArgs } from "../commands/check-tsdoc.js";

// ---------------------------------------------------------------------------
// Action registration
// ---------------------------------------------------------------------------

describe("check-tsdoc action registration", () => {
  test("check.tsdoc action is registered in the action registry", () => {
    const action = outfitterActions.get("check.tsdoc");
    expect(action).toBeDefined();
  });

  test("check.tsdoc action belongs to the check group", () => {
    const action = outfitterActions.get("check.tsdoc");
    expect(action?.cli?.group).toBe("check");
  });

  test("check.tsdoc action uses tsdoc subcommand", () => {
    const action = outfitterActions.get("check.tsdoc");
    expect(action?.cli?.command).toBe("tsdoc");
  });

  test("check.tsdoc action is CLI-only", () => {
    const action = outfitterActions.get("check.tsdoc");
    expect(action?.surfaces).toEqual(["cli"]);
  });

  test("existing check action is preserved with group structure", () => {
    const action = outfitterActions.get("check");
    expect(action).toBeDefined();
    expect(action?.cli?.group).toBe("check");
  });
});

// ---------------------------------------------------------------------------
// Input mapping
// ---------------------------------------------------------------------------

describe("check-tsdoc mapInput", () => {
  test("maps default flags", () => {
    const action = outfitterActions.get("check.tsdoc");
    expect(action?.cli?.mapInput).toBeDefined();

    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as {
      strict: boolean;
      minCoverage: number;
      cwd: string;
      outputMode: string;
    };

    expect(mapped.strict).toBe(false);
    expect(mapped.minCoverage).toBe(0);
    expect(typeof mapped.cwd).toBe("string");
    expect(mapped.outputMode).toBe("human");
  });

  test("maps --strict flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { strict: true },
    }) as { strict: boolean };

    expect(mapped.strict).toBe(true);
  });

  test("maps --min-coverage flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { minCoverage: "80" },
    }) as { minCoverage: number };

    expect(mapped.minCoverage).toBe(80);
  });

  test("maps --json flag to outputMode", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { json: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});

// ---------------------------------------------------------------------------
// Args builder
// ---------------------------------------------------------------------------

describe("buildCheckTsdocArgs", () => {
  test("returns base args with no options", () => {
    const args = buildCheckTsdocArgs({
      strict: false,
      minCoverage: 0,
      cwd: "/tmp/test",
      outputMode: "human",
    });

    expect(args).toEqual(["check-tsdoc"]);
  });

  test("adds --strict flag when enabled", () => {
    const args = buildCheckTsdocArgs({
      strict: true,
      minCoverage: 0,
      cwd: "/tmp/test",
      outputMode: "human",
    });

    expect(args).toContain("--strict");
  });

  test("adds --min-coverage flag when above zero", () => {
    const args = buildCheckTsdocArgs({
      strict: false,
      minCoverage: 80,
      cwd: "/tmp/test",
      outputMode: "human",
    });

    expect(args).toContain("--min-coverage");
    expect(args).toContain("80");
  });

  test("adds --json flag for json output mode", () => {
    const args = buildCheckTsdocArgs({
      strict: false,
      minCoverage: 0,
      cwd: "/tmp/test",
      outputMode: "json",
    });

    expect(args).toContain("--json");
  });

  test("does not add --json for human output mode", () => {
    const args = buildCheckTsdocArgs({
      strict: false,
      minCoverage: 0,
      cwd: "/tmp/test",
      outputMode: "human",
    });

    expect(args).not.toContain("--json");
  });

  test("combines all flags correctly", () => {
    const args = buildCheckTsdocArgs({
      strict: true,
      minCoverage: 75,
      cwd: "/tmp/test",
      outputMode: "json",
    });

    expect(args).toEqual([
      "check-tsdoc",
      "--strict",
      "--min-coverage",
      "75",
      "--json",
    ]);
  });
});
