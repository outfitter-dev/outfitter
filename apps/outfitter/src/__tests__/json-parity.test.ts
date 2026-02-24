import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { resolveOutputModeFromContext } from "../output-mode.js";

// Capture original env state to restore after each test
const originalJson = process.env["OUTFITTER_JSON"];
const originalJsonl = process.env["OUTFITTER_JSONL"];

beforeEach(() => {
  // Clear env vars before each test for isolation
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
});

afterEach(() => {
  // Restore original env state
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

describe("resolveOutputModeFromContext", () => {
  test("returns json when --json flag is set", () => {
    expect(resolveOutputModeFromContext({ json: true })).toBe("json");
  });

  test("returns jsonl when --jsonl flag is set", () => {
    expect(resolveOutputModeFromContext({ jsonl: true })).toBe("jsonl");
  });

  test("returns json when OUTFITTER_JSON=1 env var is set", () => {
    process.env["OUTFITTER_JSON"] = "1";
    expect(resolveOutputModeFromContext({})).toBe("json");
  });

  test("returns jsonl when OUTFITTER_JSONL=1 env var is set", () => {
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveOutputModeFromContext({})).toBe("jsonl");
  });

  test("returns human when no flag or env var is set", () => {
    expect(resolveOutputModeFromContext({})).toBe("human");
  });

  test("flag takes priority over env var", () => {
    process.env["OUTFITTER_JSON"] = "1";
    // Even with JSON env set, explicit jsonl flag wins
    expect(resolveOutputModeFromContext({ jsonl: true })).toBe("jsonl");
  });

  test("json flag takes priority over OUTFITTER_JSONL env var", () => {
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveOutputModeFromContext({ json: true })).toBe("json");
  });

  test("OUTFITTER_JSONL env takes priority over OUTFITTER_JSON env", () => {
    process.env["OUTFITTER_JSON"] = "1";
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveOutputModeFromContext({})).toBe("jsonl");
  });

  test("does NOT set any env vars as side effect", () => {
    resolveOutputModeFromContext({ json: true });
    expect(process.env["OUTFITTER_JSON"]).toBeUndefined();

    resolveOutputModeFromContext({ jsonl: true });
    expect(process.env["OUTFITTER_JSONL"]).toBeUndefined();
  });
});
