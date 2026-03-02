/**
 * Tests for output mode type narrowing helpers.
 *
 * `resolveStructuredOutputMode` is a pure type-narrowing helper.
 * Full output mode resolution (with env vars) is tested via
 * `resolveOutputMode()` in packages/cli.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { resolveStructuredOutputMode } from "../output-mode.js";

describe("resolveStructuredOutputMode", () => {
  test("returns json for json mode", () => {
    expect(resolveStructuredOutputMode("json")).toBe("json");
  });

  test("returns jsonl for jsonl mode", () => {
    expect(resolveStructuredOutputMode("jsonl")).toBe("jsonl");
  });

  test("returns undefined for human mode", () => {
    expect(resolveStructuredOutputMode("human")).toBeUndefined();
  });

  test("returns undefined when mode is undefined", () => {
    expect(resolveStructuredOutputMode()).toBeUndefined();
  });
});
