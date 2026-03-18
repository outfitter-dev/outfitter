import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { createGreeting } from "./handlers.js";
import * as barrel from "./index.js";
import { greetingInputSchema } from "./types.js";

describe("public API surface", () => {
  test("barrel exports createGreeting handler", () => {
    expect(typeof barrel.createGreeting).toBe("function");
  });

  test("barrel exports greetingInputSchema", () => {
    expect(barrel.greetingInputSchema).toBeDefined();
  });

  test("schema can validate input", () => {
    const result = greetingInputSchema.safeParse({ name: "test" });
    expect(result.success).toBe(true);
  });
});

describe("createGreeting", () => {
  const ctx = createContext({ cwd: process.cwd(), env: process.env });

  test("returns greeting for valid input", async () => {
    const result = await createGreeting(
      { name: "Outfitter", excited: true },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, Outfitter!");
  });

  test("returns validation error for empty name", async () => {
    const result = await createGreeting({ name: "" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
    expect(result.error.message).toContain("name");
  });

  test("returns validation error for missing input", async () => {
    const result = await createGreeting({}, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
  });
});
