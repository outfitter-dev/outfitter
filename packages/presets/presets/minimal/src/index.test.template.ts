import { describe, expect, test } from "bun:test";

import { find, greet } from "./index.js";

describe("public API surface", () => {
  test("exports greet function", () => {
    expect(typeof greet).toBe("function");
  });

  test("exports find function", () => {
    expect(typeof find).toBe("function");
  });
});

describe("greet", () => {
  test("returns Result with isOk/isErr contract", () => {
    const result = greet("World");

    expect(typeof result.isOk).toBe("function");
    expect(typeof result.isErr).toBe("function");
    expect(result.isOk()).toBe(true);
  });

  test("success result has value with message", () => {
    const result = greet("World");

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, World!");
  });

  test("error result has ValidationError", () => {
    const result = greet("");

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
    expect(result.error.message).toBe("name: name is required");
  });
});

describe("find", () => {
  test("returns greeting for valid ID", () => {
    const result = find("abc");

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toContain("abc");
  });

  test("returns NotFoundError for unknown ID", () => {
    const result = find("unknown");

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("NotFoundError");
    expect(result.error.message).toContain("unknown");
  });
});
