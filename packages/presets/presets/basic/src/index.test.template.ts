import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { findGreeting, greet } from "./index.js";

describe("public API surface", () => {
  test("exports greet handler", () => {
    expect(typeof greet).toBe("function");
  });

  test("exports findGreeting handler", () => {
    expect(typeof findGreeting).toBe("function");
  });
});

describe("greet", () => {
  const ctx = createContext({ cwd: process.cwd(), env: process.env });

  test("returns Result with isOk/isErr contract", async () => {
    const result = await greet({ name: "World" }, ctx);

    expect(typeof result.isOk).toBe("function");
    expect(typeof result.isErr).toBe("function");
    expect(result.isOk()).toBe(true);
  });

  test("success result has value property", async () => {
    const result = await greet({ name: "World" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, World!");
  });

  test("error result has error property with name", async () => {
    const result = await greet({ name: "" }, ctx);

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe("ValidationError");
    expect(typeof result.error.message).toBe("string");
  });
});

describe("findGreeting", () => {
  const ctx = createContext({ cwd: process.cwd(), env: process.env });

  test("returns greeting for valid ID", async () => {
    const result = await findGreeting({ id: "abc" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toContain("abc");
  });

  test("returns NotFoundError for unknown ID", async () => {
    const result = await findGreeting({ id: "unknown" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("NotFoundError");
    expect(result.error.message).toContain("unknown");
  });
});
