import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";
import { createMcpHarness } from "@outfitter/testing";
import { createGreeting } from "{{packageName}}-core";

import { server } from "./mcp.js";

describe("mcp surface", () => {
  test("registers the greet tool", () => {
    const harness = createMcpHarness(server);
    const tools = harness.listTools();
    const registered = tools.some((tool) => tool.name === "greet");

    expect(registered).toBe(true);
  });

  test("can call greet tool via harness", async () => {
    const harness = createMcpHarness(server);
    const result = await harness.callTool<{ message: string }>("greet", {
      name: "MCP",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, MCP.");
  });
});

describe("core handler", () => {
  test("returns greeting directly", async () => {
    const result = await createGreeting(
      { name: "Direct" },
      createContext({ cwd: process.cwd(), env: process.env })
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.message).toBe("Hello, Direct.");
  });
});
