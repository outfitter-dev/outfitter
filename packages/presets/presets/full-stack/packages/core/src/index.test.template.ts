import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { createGreeting, findGreeting } from "./handlers.js";

describe("createGreeting", () => {
  test("returns greeting for valid input", async () => {
    const result = await createGreeting(
      { name: "Outfitter", excited: true },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }
    expect(result.value.message).toBe("Hello, Outfitter!");
  });

  test("returns validation error for invalid input", async () => {
    const result = await createGreeting(
      { name: "" },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("ValidationError");
    }
  });
});

describe("findGreeting", () => {
  test("returns greeting for valid ID", async () => {
    const result = await findGreeting(
      { id: "abc" },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toContain("abc");
  });

  test("returns NotFoundError for unknown ID", async () => {
    const result = await findGreeting(
      { id: "unknown" },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("NotFoundError");
    expect(result.error.message).toContain("unknown");
  });
});
