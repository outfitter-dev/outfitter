import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { greet, lookup } from "./commands/hello.js";
import { program } from "./index.js";

describe("program", () => {
  test("registers the hello command", () => {
    expect(program.program.name()).toBe("{{binName}}");

    const registered = program.program.commands.some(
      (cmd) => cmd.name() === "hello"
    );
    expect(registered).toBe(true);
  });

  test("registers the lookup command", () => {
    const registered = program.program.commands.some(
      (cmd) => cmd.name() === "lookup"
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

describe("lookup", () => {
  const ctx = createContext({ cwd: process.cwd(), env: process.env });

  test("returns item for valid ID", async () => {
    const result = await lookup({ id: "abc" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.name).toBe("Item abc");
    expect(result.value.found).toBe(true);
  });

  test("returns NotFoundError for unknown ID", async () => {
    const result = await lookup({ id: "unknown" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("NotFoundError");
    expect(result.error.message).toContain("unknown");
  });
});
