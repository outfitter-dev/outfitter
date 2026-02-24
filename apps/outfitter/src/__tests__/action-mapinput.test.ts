/**
 * Tests for action mapInput functions — flag presets, deprecated aliases,
 * and env var fallbacks.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { outfitterActions } from "../actions.js";

// ---------------------------------------------------------------------------
// check mapInput
// ---------------------------------------------------------------------------

describe("check mapInput", () => {
  test("--ci deprecated alias maps to outputMode json", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { ci: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("--output json maps to outputMode json", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("--output json takes precedence over --ci", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json", ci: true },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  describe("OUTFITTER_JSON env var", () => {
    let previous: string | undefined;

    beforeEach(() => {
      previous = process.env["OUTFITTER_JSON"];
    });

    afterEach(() => {
      if (previous === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = previous;
      }
    });

    test("OUTFITTER_JSON=1 maps to outputMode json when no flags", () => {
      process.env["OUTFITTER_JSON"] = "1";
      const action = outfitterActions.get("check");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: {},
      }) as { outputMode: string };

      expect(mapped.outputMode).toBe("json");
    });

    test("explicit --output human overrides OUTFITTER_JSON=1", () => {
      process.env["OUTFITTER_JSON"] = "1";
      const action = outfitterActions.get("check");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: { output: "human" },
      }) as { outputMode: string };

      expect(mapped.outputMode).toBe("human");
    });

    test("explicit --output human overrides OUTFITTER_JSONL=1", () => {
      const previousJsonl = process.env["OUTFITTER_JSONL"];
      process.env["OUTFITTER_JSONL"] = "1";
      try {
        const action = outfitterActions.get("check");
        const mapped = action?.cli?.mapInput?.({
          args: [],
          flags: { output: "human" },
        }) as { outputMode: string };

        expect(mapped.outputMode).toBe("human");
      } finally {
        if (previousJsonl === undefined) {
          delete process.env["OUTFITTER_JSONL"];
        } else {
          process.env["OUTFITTER_JSONL"] = previousJsonl;
        }
      }
    });
  });

  test("--cwd maps to resolved cwd", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });
});

// ---------------------------------------------------------------------------
// doctor mapInput
// ---------------------------------------------------------------------------

describe("doctor mapInput", () => {
  test("--cwd maps to resolved cwd", () => {
    const action = outfitterActions.get("doctor");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("defaults cwd to process.cwd() when --cwd omitted", () => {
    const action = outfitterActions.get("doctor");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });
});

// ---------------------------------------------------------------------------
// add mapInput
// ---------------------------------------------------------------------------

describe("add mapInput", () => {
  test("--cwd maps to resolved cwd", () => {
    const action = outfitterActions.get("add");
    const mapped = action?.cli?.mapInput?.({
      args: ["biome"],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string; block: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
    expect(mapped.block).toBe("biome");
  });

  test("defaults cwd to process.cwd() when --cwd omitted", () => {
    const action = outfitterActions.get("add");
    const mapped = action?.cli?.mapInput?.({
      args: ["biome"],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });
});

// ---------------------------------------------------------------------------
// check.tsdoc mapInput
// ---------------------------------------------------------------------------

describe("check.tsdoc mapInput", () => {
  test("explicit --output human overrides OUTFITTER_JSON=1", () => {
    const previousJson = process.env["OUTFITTER_JSON"];
    process.env["OUTFITTER_JSON"] = "1";

    try {
      const action = outfitterActions.get("check.tsdoc");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: { output: "human" },
      }) as { outputMode: string };

      expect(mapped.outputMode).toBe("human");
    } finally {
      if (previousJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = previousJson;
      }
    }
  });

  test("explicit --output human overrides OUTFITTER_JSONL=1", () => {
    const previousJsonl = process.env["OUTFITTER_JSONL"];
    process.env["OUTFITTER_JSONL"] = "1";

    try {
      const action = outfitterActions.get("check.tsdoc");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: { output: "human" },
      }) as { outputMode: string };

      expect(mapped.outputMode).toBe("human");
    } finally {
      if (previousJsonl === undefined) {
        delete process.env["OUTFITTER_JSONL"];
      } else {
        process.env["OUTFITTER_JSONL"] = previousJsonl;
      }
    }
  });
});
