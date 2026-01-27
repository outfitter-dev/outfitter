import { describe, expect, it } from "bun:test";
import { McpError } from "../types.js";

describe("McpError", () => {
  it("sets tag and category", () => {
    const error = new McpError({
      message: "Tool not found",
      code: -32_601,
    });

    expect(error._tag).toBe("McpError");
    expect(error.category).toBe("internal");
  });
});
