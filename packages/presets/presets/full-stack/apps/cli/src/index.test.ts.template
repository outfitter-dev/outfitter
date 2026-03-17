import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";
import { createGreeting } from "{{packageName}}-core";

describe("cli surface", () => {
  test("greet handler returns structured result", async () => {
    const result = await createGreeting(
      { name: "CLI", excited: true },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }
    expect(result.value.message).toBe("Hello, CLI!");
  });

  test("greet handler validates empty name", async () => {
    const result = await createGreeting(
      { name: "", excited: false },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }
    expect(result.error.name).toBe("ValidationError");
  });
});
