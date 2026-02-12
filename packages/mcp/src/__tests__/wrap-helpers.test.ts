/**
 * Tests for wrapToolResult and wrapToolError exports.
 */
import { describe, expect, it } from "bun:test";
import { wrapToolError, wrapToolResult } from "../index.js";

describe("wrapToolResult()", () => {
  it("wraps a plain string into a text content block", () => {
    const result = wrapToolResult("hello");
    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
    expect(result.isError).toBeUndefined();
  });

  it("wraps a plain object with structuredContent", () => {
    const data = { id: "123", name: "test" };
    const result = wrapToolResult(data);
    expect(result.content[0]?.type).toBe("text");
    expect(result.structuredContent).toEqual(data);
    expect(result.isError).toBeUndefined();
  });

  it("passes through an existing McpToolResponse unchanged", () => {
    const existing = {
      content: [{ type: "text" as const, text: "already wrapped" }],
    };
    const result = wrapToolResult(existing);
    expect(result).toBe(existing);
  });

  it("wraps an array as JSON text without structuredContent", () => {
    const result = wrapToolResult([1, 2, 3]);
    expect(result.content[0]?.type).toBe("text");
    expect(result.structuredContent).toBeUndefined();
  });
});

describe("wrapToolError()", () => {
  it("wraps an Error into an isError response", () => {
    const error = new Error("something broke");
    const result = wrapToolError(error);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");
    const parsed = JSON.parse(result.content[0]?.text ?? "");
    expect(parsed.message).toBe("something broke");
  });

  it("wraps a tagged error preserving _tag", () => {
    const error = { _tag: "NotFoundError", message: "not found", code: 2001 };
    const result = wrapToolError(error);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "");
    expect(parsed._tag).toBe("NotFoundError");
    expect(parsed.message).toBe("not found");
  });

  it("wraps a string error", () => {
    const result = wrapToolError("string error");
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]?.text ?? "");
    expect(parsed._tag).toBe("McpError");
    expect(parsed.message).toBe("string error");
  });
});
