import { afterEach, describe, expect, test } from "bun:test";

import { outfitterActions } from "../actions.js";

const CHECK_AUTOMATION_ACTIONS = [
  {
    id: "check.publish-guardrails",
    command: "publish-guardrails",
  },
  {
    id: "check.preset-versions",
    command: "preset-versions",
  },
  {
    id: "check.surface-map",
    command: "surface-map",
  },
  {
    id: "check.surface-map-format",
    command: "surface-map-format",
  },
  {
    id: "check.docs-sentinel",
    command: "docs-sentinel",
  },
] as const;

describe("check automation action registration", () => {
  for (const entry of CHECK_AUTOMATION_ACTIONS) {
    test(`${entry.id} is registered under check group`, () => {
      const action = outfitterActions.get(entry.id);

      expect(action).toBeDefined();
      expect(action?.cli?.group).toBe("check");
      expect(action?.cli?.command).toBe(entry.command);
      expect(action?.surfaces).toEqual(["cli"]);
    });
  }
});

describe("check automation mapInput", () => {
  const previousJson = process.env["OUTFITTER_JSON"];
  const previousJsonl = process.env["OUTFITTER_JSONL"];

  afterEach(() => {
    if (previousJson === undefined) {
      delete process.env["OUTFITTER_JSON"];
    } else {
      process.env["OUTFITTER_JSON"] = previousJson;
    }

    if (previousJsonl === undefined) {
      delete process.env["OUTFITTER_JSONL"];
    } else {
      process.env["OUTFITTER_JSONL"] = previousJsonl;
    }
  });

  test("explicit --output json maps to outputMode json", () => {
    const action = outfitterActions.get("check.publish-guardrails");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("OUTFITTER_JSON=1 falls back to outputMode json", () => {
    process.env["OUTFITTER_JSON"] = "1";
    delete process.env["OUTFITTER_JSONL"];

    const action = outfitterActions.get("check.surface-map");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});
