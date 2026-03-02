/**
 * Tests for output mode resolution parity across legacy and new flag styles.
 *
 * Validates that `resolveOutputMode()` correctly handles both legacy
 * `--json`/`--jsonl` boolean flags and new `--output` flag style,
 * plus env var fallback.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { resolveOutputMode } from "@outfitter/cli/query";

const originalJson = process.env["OUTFITTER_JSON"];
const originalJsonl = process.env["OUTFITTER_JSONL"];

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
});

describe("resolveOutputMode", () => {
  test("returns json when --json flag is set", () => {
    expect(resolveOutputMode({ json: true }).mode).toBe("json");
  });

  test("returns jsonl when --jsonl flag is set", () => {
    expect(resolveOutputMode({ jsonl: true }).mode).toBe("jsonl");
  });

  test("returns json when OUTFITTER_JSON=1 env var is set", () => {
    process.env["OUTFITTER_JSON"] = "1";
    expect(resolveOutputMode({}).mode).toBe("json");
  });

  test("returns jsonl when OUTFITTER_JSONL=1 env var is set", () => {
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveOutputMode({}).mode).toBe("jsonl");
  });

  test("returns human when no flag or env var is set", () => {
    expect(resolveOutputMode({}).mode).toBe("human");
  });

  test("flag takes priority over env var", () => {
    process.env["OUTFITTER_JSON"] = "1";
    expect(resolveOutputMode({ jsonl: true }).mode).toBe("jsonl");
  });

  test("json flag takes priority over OUTFITTER_JSONL env var", () => {
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveOutputMode({ json: true }).mode).toBe("json");
  });

  test("OUTFITTER_JSONL env takes priority over OUTFITTER_JSON env", () => {
    process.env["OUTFITTER_JSON"] = "1";
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveOutputMode({}).mode).toBe("jsonl");
  });

  test("does NOT set any env vars as side effect", () => {
    resolveOutputMode({ json: true });
    expect(process.env["OUTFITTER_JSON"]).toBeUndefined();

    resolveOutputMode({ jsonl: true });
    expect(process.env["OUTFITTER_JSONL"]).toBeUndefined();
  });

  test("returns source metadata", () => {
    expect(resolveOutputMode({ json: true }).source).toBe("flag");
    expect(resolveOutputMode({}).source).toBe("default");

    process.env["OUTFITTER_JSON"] = "1";
    expect(resolveOutputMode({}).source).toBe("env");
  });
});
