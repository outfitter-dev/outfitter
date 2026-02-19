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

  test("check.tsdoc action has --output flag from outputModePreset", () => {
    const action = outfitterActions.get("check.tsdoc");
    const outputOption = action?.cli?.options?.find((o) =>
      o.flags.includes("--output")
    );
    expect(outputOption).toBeDefined();
    expect(outputOption?.flags).toContain("-o");
  });

  test("check.tsdoc action has --jq flag from jqPreset", () => {
    const action = outfitterActions.get("check.tsdoc");
    const jqOption = action?.cli?.options?.find((o) =>
      o.flags.includes("--jq")
    );
    expect(jqOption).toBeDefined();
  });

  test("check.tsdoc action has --summary flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const summaryOption = action?.cli?.options?.find((o) =>
      o.flags.includes("--summary")
    );
    expect(summaryOption).toBeDefined();
    expect(summaryOption?.defaultValue).toBe(false);
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
      jq: string | undefined;
      summary: boolean;
    };

    expect(mapped.strict).toBe(false);
    expect(mapped.minCoverage).toBe(0);
    expect(typeof mapped.cwd).toBe("string");
    expect(mapped.outputMode).toBe("human");
    expect(mapped.jq).toBeUndefined();
    expect(mapped.summary).toBe(false);
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

  test("maps --output json flag to outputMode", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("maps --output jsonl flag to outputMode", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "jsonl" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("jsonl");
  });

  test("falls back to legacy --json flag when --output is omitted", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { json: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("falls back to OUTFITTER_JSON when --output is omitted", () => {
    const previous = process.env["OUTFITTER_JSON"];
    process.env["OUTFITTER_JSON"] = "1";

    try {
      const action = outfitterActions.get("check.tsdoc");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: {},
      }) as { outputMode: string };

      expect(mapped.outputMode).toBe("json");
    } finally {
      if (previous === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = previous;
      }
    }
  });

  test("explicit --output beats legacy --json fallback", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "human", json: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("human");
  });

  test("maps --jq flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { jq: ".summary.percentage" },
    }) as { jq: string | undefined };

    expect(mapped.jq).toBe(".summary.percentage");
  });

  test("maps --summary flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { summary: true },
    }) as { summary: boolean };

    expect(mapped.summary).toBe(true);
  });

  test("invalid --output mode falls back to human", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "xml" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("human");
  });
});
