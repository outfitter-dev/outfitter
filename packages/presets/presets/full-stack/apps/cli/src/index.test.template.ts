import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";
import { createGreeting, greetAction } from "{{packageName}}-core";

describe("cli surface", () => {
  test("greet action has CLI surface config", () => {
    expect(greetAction.cli).toBeDefined();
    expect(greetAction.cli?.command).toBe("greet [name]");
  });

  test("greet action mapInput resolves args and flags", () => {
    const input = greetAction.cli?.mapInput?.({
      args: ["World"],
      flags: { excited: true },
    });

    expect(input).toEqual({ name: "World", excited: true });
  });

  test("greet action mapInput defaults name", () => {
    const input = greetAction.cli?.mapInput?.({
      args: [],
      flags: {},
    });

    expect(input).toEqual({ name: "World", excited: false });
  });
});

describe("core handler", () => {
  test("returns greeting for valid input", async () => {
    const result = await createGreeting(
      { name: "CLI", excited: true },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, CLI!");
  });

  test("validates empty name", async () => {
    const result = await createGreeting(
      { name: "", excited: false },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe("ValidationError");
  });
});
