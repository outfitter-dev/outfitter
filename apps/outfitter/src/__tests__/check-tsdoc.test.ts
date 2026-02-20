/**
 * Tests for check-tsdoc action registration and command wrapper.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { outfitterActions } from "../actions.js";

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

  test("check.tsdoc action has an output schema", () => {
    const action = outfitterActions.get("check.tsdoc");
    expect(action?.output).toBeDefined();
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
