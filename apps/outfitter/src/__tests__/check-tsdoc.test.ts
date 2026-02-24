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

  test("check.tsdoc action has --level flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const levelOption = action?.cli?.options?.find((o) =>
      o.flags.includes("--level")
    );
    expect(levelOption).toBeDefined();
  });

  test("check.tsdoc action has --package flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const pkgOption = action?.cli?.options?.find((o) =>
      o.flags.includes("--package")
    );
    expect(pkgOption).toBeDefined();
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
      level: string | undefined;
      packages: string[];
    };

    expect(mapped.strict).toBe(false);
    expect(mapped.minCoverage).toBe(0);
    expect(typeof mapped.cwd).toBe("string");
    expect(mapped.outputMode).toBe("human");
    expect(mapped.jq).toBeUndefined();
    expect(mapped.summary).toBe(false);
    expect(mapped.level).toBeUndefined();
    expect(mapped.packages).toEqual([]);
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

  test("--json flag is superseded by --output preset (Commander always populates --output default)", () => {
    const action = outfitterActions.get("check.tsdoc");
    // In real Commander usage, --output is always present with default "human".
    // Legacy --json flag is effectively dead — outputModePreset owns output mode.
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { json: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("human");
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

  test("maps --level flag", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { level: "undocumented" },
    }) as { level: string | undefined };

    expect(mapped.level).toBe("undocumented");
  });

  test("ignores invalid --level value", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { level: "invalid" },
    }) as { level: string | undefined };

    expect(mapped.level).toBeUndefined();
  });

  test("maps --package flag as string", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { package: "@outfitter/contracts" },
    }) as { packages: string[] };

    expect(mapped.packages).toEqual(["@outfitter/contracts"]);
  });

  test("maps --package flag as array (repeatable)", () => {
    const action = outfitterActions.get("check.tsdoc");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { package: ["@outfitter/cli", "@outfitter/contracts"] },
    }) as { packages: string[] };

    expect(mapped.packages).toEqual(["@outfitter/cli", "@outfitter/contracts"]);
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
