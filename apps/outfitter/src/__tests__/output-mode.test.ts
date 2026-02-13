import { afterEach, describe, expect, test } from "bun:test";
import { resolveStructuredOutputMode } from "../output-mode.js";

const originalJson = process.env["OUTFITTER_JSON"];
const originalJsonl = process.env["OUTFITTER_JSONL"];

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

describe("resolveStructuredOutputMode", () => {
  test("prefers explicit json mode", () => {
    process.env["OUTFITTER_JSON"] = "0";
    expect(resolveStructuredOutputMode("json")).toBe("json");
  });

  test("respects explicit non-structured mode over env", () => {
    process.env["OUTFITTER_JSON"] = "1";
    expect(resolveStructuredOutputMode("human")).toBeUndefined();
  });

  test("uses OUTFITTER_JSONL env var before OUTFITTER_JSON", () => {
    process.env["OUTFITTER_JSON"] = "1";
    process.env["OUTFITTER_JSONL"] = "1";
    expect(resolveStructuredOutputMode()).toBe("jsonl");
  });

  test("uses OUTFITTER_JSON env var when set", () => {
    process.env["OUTFITTER_JSON"] = "1";
    delete process.env["OUTFITTER_JSONL"];
    expect(resolveStructuredOutputMode()).toBe("json");
  });
});
