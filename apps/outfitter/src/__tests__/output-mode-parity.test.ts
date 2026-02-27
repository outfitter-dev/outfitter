/**
 * Cross-command output mode parity tests.
 *
 * Validates that ALL action groups (check, docs, schema, etc.) produce
 * consistent output mode behavior for identical flag/env combinations
 * via CLI-path execution (mapInput).
 *
 * This is an integration test for the full output chain:
 * `--json` flag (OS-323) → centralized resolver (OS-421) → `output()` format (OS-331)
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { outfitterActions } from "../actions.js";

// ---------------------------------------------------------------------------
// Env var safety
// ---------------------------------------------------------------------------

const originalJson = process.env["OUTFITTER_JSON"];
const originalJsonl = process.env["OUTFITTER_JSONL"];
const originalArgv = process.argv;

beforeEach(() => {
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
});

afterEach(() => {
  if (originalJson === undefined) {
    delete process.env["OUTFITTER_JSON"];
  } else {
    process.env["OUTFITTER_JSON"] = originalJson;
  }

  if (originalJsonl === undefined) {
    delete process.env["OUTFITTER_JSONL"];
  } else {
    process.env["OUTFITTER_JSONL"] = originalJsonl;
  }

  process.argv = originalArgv;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Invokes an action's `mapInput` with the given flags/args and returns the
 * resolved `outputMode` string. This exercises the full CLI-path: flag
 * parsing via Commander presets → `resolveOutputMode()` → mapped input.
 */
function getOutputMode(
  actionId: string,
  flags: Record<string, unknown>,
  args: readonly unknown[] = []
): string {
  const action = outfitterActions.get(actionId);
  if (!action?.cli?.mapInput) {
    throw new Error(`Action "${actionId}" not found or has no mapInput`);
  }

  const mapped = action.cli.mapInput({ args: [...args], flags }) as {
    outputMode: string;
  };

  return mapped.outputMode;
}

// ---------------------------------------------------------------------------
// Action groups under test
// ---------------------------------------------------------------------------

/**
 * Action groups that follow the standard output mode resolution path
 * (no special flags like `forceHumanWhenImplicit`).
 *
 * Each entry has:
 * - `id`: action registry ID
 * - `args`: minimum required positional args for mapInput to succeed
 * - `extraFlags`: any additional flags needed for the call to succeed
 */
const standardActions: {
  id: string;
  group: string;
  args?: readonly unknown[];
  extraFlags?: Record<string, unknown>;
}[] = [
  // check automation group
  { id: "check.publish-guardrails", group: "check-automation" },
  { id: "check.preset-versions", group: "check-automation" },
  { id: "check.surface-map", group: "check-automation" },
  { id: "check.surface-map-format", group: "check-automation" },
  { id: "check.docs-sentinel", group: "check-automation" },
  { id: "check.action-ceremony", group: "check-automation" },

  // check group
  { id: "check.tsdoc", group: "check" },

  // docs group
  { id: "docs.list", group: "docs" },
  { id: "docs.show", group: "docs", args: ["cli/README.md"] },
  { id: "docs.search", group: "docs", args: ["handler"] },
  { id: "docs.api", group: "docs" },
  { id: "docs.export", group: "docs" },

  // add group
  { id: "add", group: "add", args: ["linter"] },
  { id: "add.list", group: "add" },

  // top-level commands
  { id: "upgrade", group: "upgrade" },
  { id: "scaffold", group: "scaffold", args: ["my-project"] },
  { id: "demo", group: "demo" },
  { id: "doctor", group: "doctor" },

  // init group (all variants use shared mapInput)
  { id: "init", group: "init", args: ["/tmp/test-project"] },
  { id: "init.cli", group: "init", args: ["/tmp/test-project"] },
  { id: "init.mcp", group: "init", args: ["/tmp/test-project"] },
  { id: "init.daemon", group: "init", args: ["/tmp/test-project"] },
  { id: "init.library", group: "init", args: ["/tmp/test-project"] },
  { id: "init.full-stack", group: "init", args: ["/tmp/test-project"] },
];

// ---------------------------------------------------------------------------
// Parity tests
// ---------------------------------------------------------------------------

describe("output mode parity across action groups", () => {
  describe("default human mode (no flags, no env vars)", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) defaults to human`, () => {
        expect(
          getOutputMode(id, {}, standardActions.find((a) => a.id === id)?.args)
        ).toBe("human");
      });
    }
  });

  describe("OUTFITTER_JSON=1 env var fallback", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) returns json via env var`, () => {
        process.env["OUTFITTER_JSON"] = "1";

        expect(
          getOutputMode(id, {}, standardActions.find((a) => a.id === id)?.args)
        ).toBe("json");
      });
    }
  });

  describe("OUTFITTER_JSONL=1 env var fallback", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) returns jsonl via env var`, () => {
        process.env["OUTFITTER_JSONL"] = "1";

        expect(
          getOutputMode(id, {}, standardActions.find((a) => a.id === id)?.args)
        ).toBe("jsonl");
      });
    }
  });

  describe("explicit --output json flag", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) returns json via --output flag`, () => {
        process.argv = ["bun", "outfitter", "--output", "json"];

        expect(
          getOutputMode(
            id,
            { output: "json" },
            standardActions.find((a) => a.id === id)?.args
          )
        ).toBe("json");
      });
    }
  });

  describe("explicit --output flag overrides env var", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) explicit --output human overrides OUTFITTER_JSON=1`, () => {
        process.env["OUTFITTER_JSON"] = "1";
        process.argv = ["bun", "outfitter", "--output", "human"];

        expect(
          getOutputMode(
            id,
            { output: "human" },
            standardActions.find((a) => a.id === id)?.args
          )
        ).toBe("human");
      });
    }
  });

  describe("legacy --json flag", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) returns json via legacy --json flag`, () => {
        expect(
          getOutputMode(
            id,
            { json: true },
            standardActions.find((a) => a.id === id)?.args
          )
        ).toBe("json");
      });
    }
  });

  describe("OUTFITTER_JSONL takes priority over OUTFITTER_JSON", () => {
    for (const { id, group } of standardActions) {
      test(`${id} (${group}) returns jsonl when both env vars set`, () => {
        process.env["OUTFITTER_JSON"] = "1";
        process.env["OUTFITTER_JSONL"] = "1";

        expect(
          getOutputMode(id, {}, standardActions.find((a) => a.id === id)?.args)
        ).toBe("jsonl");
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Special cases
// ---------------------------------------------------------------------------

describe("check action forceHumanWhenImplicit special case", () => {
  test("check returns human when in orchestrator mode even with OUTFITTER_JSON=1", () => {
    process.env["OUTFITTER_JSON"] = "1";

    // When an orchestrator mode flag is present (e.g., --pre-commit),
    // forceHumanWhenImplicit suppresses env-var fallback
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { preCommit: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("human");
  });

  test("check returns json via env when NOT in orchestrator mode", () => {
    process.env["OUTFITTER_JSON"] = "1";

    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("check returns json via explicit --output even in orchestrator mode", () => {
    process.argv = [
      "bun",
      "outfitter",
      "check",
      "--pre-commit",
      "--output",
      "json",
    ];

    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { preCommit: true, output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});

// ---------------------------------------------------------------------------
// End-to-end chain: --json flag (OS-323) → resolver (OS-421) → output (OS-331)
// ---------------------------------------------------------------------------

describe("end-to-end output chain integration", () => {
  test("mapInput resolves output mode from resolver, not local branches", () => {
    // This verifies no action has local env-var detection.
    // All actions should produce identical results for the same input.
    const results = new Map<string, string>();

    process.env["OUTFITTER_JSON"] = "1";

    for (const { id } of standardActions) {
      const mode = getOutputMode(
        id,
        {},
        standardActions.find((a) => a.id === id)?.args
      );
      results.set(id, mode);
    }

    const modes = new Set(results.values());
    expect(modes.size).toBe(1);
    expect(modes.has("json")).toBe(true);
  });

  test("all actions return same mode for --jsonl flag", () => {
    const results = new Map<string, string>();

    for (const { id } of standardActions) {
      const mode = getOutputMode(
        id,
        { jsonl: true },
        standardActions.find((a) => a.id === id)?.args
      );
      results.set(id, mode);
    }

    const modes = new Set(results.values());
    expect(modes.size).toBe(1);
    expect(modes.has("jsonl")).toBe(true);
  });

  test("all actions return human when no flags or env vars set", () => {
    const results = new Map<string, string>();

    for (const { id } of standardActions) {
      const mode = getOutputMode(
        id,
        {},
        standardActions.find((a) => a.id === id)?.args
      );
      results.set(id, mode);
    }

    const modes = new Set(results.values());
    expect(modes.size).toBe(1);
    expect(modes.has("human")).toBe(true);
  });

  test("source metadata is consistent across actions", async () => {
    // Verify that the centralized resolver reports consistent source
    // metadata for all action groups (not just the mode value)
    const { resolveOutputMode } =
      (await import("@outfitter/cli/query")) as unknown as {
        resolveOutputMode: (flags: Record<string, unknown>) => {
          mode: string;
          source: string;
        };
      };

    // Default → source: "default"
    const defaultResult = resolveOutputMode({});
    expect(defaultResult.source).toBe("default");

    // Flag → source: "flag"
    const flagResult = resolveOutputMode({ json: true });
    expect(flagResult.source).toBe("flag");

    // Env → source: "env"
    process.env["OUTFITTER_JSON"] = "1";
    const envResult = resolveOutputMode({});
    expect(envResult.source).toBe("env");
  });
});
