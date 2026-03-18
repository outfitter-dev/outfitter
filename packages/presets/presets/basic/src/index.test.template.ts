import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { greet } from "./index.js";

describe("greet", () => {
  const ctx = createContext({ cwd: process.cwd(), env: process.env });

  test("returns greeting for valid input", async () => {
    const result = await greet({ name: "World" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, World!");
  });

  test("returns validation error for empty name", async () => {
    const result = await greet({ name: "" }, ctx);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("ValidationError");
    }
  });
});
