import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { greet } from "./commands/hello.js";
import { program } from "./index.js";

describe("program", () => {
  test("registers the hello command", () => {
    expect(program.program.name()).toBe("{{binName}}");

    const registered = program.program.commands.some(
      (cmd) => cmd.name() === "hello"
    );
    expect(registered).toBe(true);
  });
});

describe("greet", () => {
  test("returns greeting for valid input", async () => {
    const ctx = createContext({ cwd: process.cwd(), env: process.env });
    const result = await greet({ name: "Outfitter" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, Outfitter!");
  });

  test("returns validation error for empty name", async () => {
    const ctx = createContext({ cwd: process.cwd(), env: process.env });
    const result = await greet({ name: "" }, ctx);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("ValidationError");
    }
  });
});
