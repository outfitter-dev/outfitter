/**
 * Tests for docs output mode resolution helper.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { resolveDocsOutputMode } from "../actions/docs-output-mode.js";

describe("resolveDocsOutputMode", () => {
  test("uses explicit --output when present", () => {
    const originalJson = process.env["OUTFITTER_JSON"];
    process.env["OUTFITTER_JSON"] = "1";

    try {
      const mode = resolveDocsOutputMode({ output: "json" }, "json");
      expect(mode).toBe("json");
    } finally {
      if (originalJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = originalJson;
      }
    }
  });

  test("falls back to human for invalid explicit output", () => {
    const mode = resolveDocsOutputMode({ output: "nope" }, "human");

    expect(mode).toBe("human");
  });

  test("falls back to human for explicit non-structured preset mode", () => {
    const mode = resolveDocsOutputMode({ output: "table" }, "table");

    expect(mode).toBe("human");
  });

  test("uses OUTFITTER_JSONL when output is omitted", () => {
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    const originalJson = process.env["OUTFITTER_JSON"];
    process.env["OUTFITTER_JSONL"] = "1";
    process.env["OUTFITTER_JSON"] = "1";

    try {
      const mode = resolveDocsOutputMode({}, "human");
      expect(mode).toBe("jsonl");
    } finally {
      if (originalJsonl === undefined) {
        delete process.env["OUTFITTER_JSONL"];
      } else {
        process.env["OUTFITTER_JSONL"] = originalJsonl;
      }

      if (originalJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = originalJson;
      }
    }
  });

  test("uses OUTFITTER_JSON when OUTFITTER_JSONL is not set", () => {
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    const originalJson = process.env["OUTFITTER_JSON"];
    delete process.env["OUTFITTER_JSONL"];
    process.env["OUTFITTER_JSON"] = "1";

    try {
      const mode = resolveDocsOutputMode({}, "human");
      expect(mode).toBe("json");
    } finally {
      if (originalJsonl === undefined) {
        delete process.env["OUTFITTER_JSONL"];
      } else {
        process.env["OUTFITTER_JSONL"] = originalJsonl;
      }

      if (originalJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = originalJson;
      }
    }
  });

  test("defaults to human when no explicit output or env flags exist", () => {
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    const originalJson = process.env["OUTFITTER_JSON"];
    delete process.env["OUTFITTER_JSONL"];
    delete process.env["OUTFITTER_JSON"];

    try {
      const mode = resolveDocsOutputMode({}, "human");
      expect(mode).toBe("human");
    } finally {
      if (originalJsonl === undefined) {
        delete process.env["OUTFITTER_JSONL"];
      } else {
        process.env["OUTFITTER_JSONL"] = originalJsonl;
      }

      if (originalJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = originalJson;
      }
    }
  });

  test("OUTFITTER_JSON=1 works when Commander default sets output to 'human'", () => {
    const originalJson = process.env["OUTFITTER_JSON"];
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    process.env["OUTFITTER_JSON"] = "1";
    delete process.env["OUTFITTER_JSONL"];

    try {
      // Commander sets flags.output = "human" as default even when user
      // did not pass --output. The resolver must detect this is not explicit.
      const mode = resolveDocsOutputMode({ output: "human" }, "human");
      expect(mode).toBe("json");
    } finally {
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
    }
  });

  test("OUTFITTER_JSONL=1 works when Commander default sets output to 'human'", () => {
    const originalJson = process.env["OUTFITTER_JSON"];
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    process.env["OUTFITTER_JSONL"] = "1";
    delete process.env["OUTFITTER_JSON"];

    try {
      // Commander sets flags.output = "human" as default even when user
      // did not pass --output. The resolver must detect this is not explicit.
      const mode = resolveDocsOutputMode({ output: "human" }, "human");
      expect(mode).toBe("jsonl");
    } finally {
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
    }
  });

  test("explicit --output human overrides OUTFITTER_JSON=1 env var", () => {
    const originalJson = process.env["OUTFITTER_JSON"];
    const originalArgv = process.argv;
    process.env["OUTFITTER_JSON"] = "1";
    // Simulate user explicitly passing --output human on the command line
    process.argv = ["bun", "outfitter", "docs", "list", "--output", "human"];

    try {
      const mode = resolveDocsOutputMode({ output: "human" }, "human");
      expect(mode).toBe("human");
    } finally {
      if (originalJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = originalJson;
      }

      process.argv = originalArgv;
    }
  });

  test("defaults to human when Commander default and no env vars", () => {
    const originalJson = process.env["OUTFITTER_JSON"];
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    delete process.env["OUTFITTER_JSON"];
    delete process.env["OUTFITTER_JSONL"];

    try {
      // Commander default: flags.output = "human", presetOutputMode = "human"
      const mode = resolveDocsOutputMode({ output: "human" }, "human");
      expect(mode).toBe("human");
    } finally {
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
    }
  });
});
