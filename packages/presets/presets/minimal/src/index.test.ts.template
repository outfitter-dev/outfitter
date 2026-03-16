import { describe, expect, test } from "bun:test";

import { greet } from "./index.js";

describe("greet", () => {
  test("returns greeting for valid name", () => {
    const result = greet("World");

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, World!");
  });

  test("returns validation error for empty name", () => {
    const result = greet("");

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
    expect(result.error.message).toBe("name: name is required");
  });
});
