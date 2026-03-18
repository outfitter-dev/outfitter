import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { createGreeting } from "./handlers.js";

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
    expect(result.error.message).toBe("name is required");
    expect(result.error.context).toEqual({
      fields: [{ path: "name", message: "name is required" }],
    });
  });

  test("returns validation error for missing input", async () => {
    const result = await createGreeting({}, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
    // Check error field rather than message text — Zod error messages
    // differ between v3 ("Required") and v4 ("Invalid input: ...").
    const fields = result.error.context?.["fields"] as
      | Array<{ path: string }>
      | undefined;
    expect(fields?.some((f) => f.path === "name")).toBe(true);
  });
});
