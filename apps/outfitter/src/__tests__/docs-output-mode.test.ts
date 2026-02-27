/**
 * Tests verifying docs output mode resolution via the centralized resolver.
 *
 * These tests validate that the centralized `resolveOutputMode()` handles
 * the same scenarios that `resolveDocsOutputMode()` used to handle,
 * including Commander default detection and env var fallback.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { resolveOutputMode } from "@outfitter/cli/query";

describe("docs output mode via resolveOutputMode", () => {
  test("uses explicit --output when present", () => {
    const originalJson = process.env["OUTFITTER_JSON"];
    const originalArgv = process.argv;
    process.env["OUTFITTER_JSON"] = "1";
    process.argv = ["bun", "outfitter", "docs", "list", "--output", "json"];

    try {
      const { mode, source } = resolveOutputMode({ output: "json" });
      expect(mode).toBe("json");
      expect(source).toBe("flag");
    } finally {
      if (originalJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = originalJson;
      }

      process.argv = originalArgv;
    }
  });

  test("falls back to human for invalid explicit output", () => {
    const originalArgv = process.argv;
    process.argv = ["bun", "outfitter", "docs", "list", "--output", "nope"];

    try {
      const { mode } = resolveOutputMode({ output: "nope" });
      expect(mode).toBe("human");
    } finally {
      process.argv = originalArgv;
    }
  });

  test("uses OUTFITTER_JSONL when output is omitted", () => {
    const originalJsonl = process.env["OUTFITTER_JSONL"];
    const originalJson = process.env["OUTFITTER_JSON"];
    process.env["OUTFITTER_JSONL"] = "1";
    process.env["OUTFITTER_JSON"] = "1";

    try {
      const { mode, source } = resolveOutputMode({});
      expect(mode).toBe("jsonl");
      expect(source).toBe("env");
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
      const { mode, source } = resolveOutputMode({});
      expect(mode).toBe("json");
      expect(source).toBe("env");
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
      const { mode, source } = resolveOutputMode({});
      expect(mode).toBe("human");
      expect(source).toBe("default");
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
      const { mode, source } = resolveOutputMode({ output: "human" });
      expect(mode).toBe("json");
      expect(source).toBe("env");
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
      const { mode, source } = resolveOutputMode({ output: "human" });
      expect(mode).toBe("jsonl");
      expect(source).toBe("env");
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
    process.argv = ["bun", "outfitter", "docs", "list", "--output", "human"];

    try {
      const { mode, source } = resolveOutputMode({ output: "human" });
      expect(mode).toBe("human");
      expect(source).toBe("flag");
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
      const { mode, source } = resolveOutputMode({ output: "human" });
      expect(mode).toBe("human");
      expect(source).toBe("default");
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
