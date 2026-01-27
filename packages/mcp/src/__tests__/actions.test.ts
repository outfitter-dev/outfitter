import { describe, expect, it } from "bun:test";
import {
  createActionRegistry,
  createContext,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import { buildMcpTools } from "../actions.js";

describe("buildMcpTools", () => {
  it("builds tools from registry actions", async () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "greet",
        description: "Greet someone",
        surfaces: ["mcp"],
        input: z.object({ name: z.string() }),
        handler: async (input) =>
          Result.ok({ greeting: `Hello, ${input.name}` }),
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("greet");

    const ctx = createContext({ env: {} });
    const result = await tools[0].handler({ name: "Ada" }, ctx);
    expect(result.isOk()).toBe(true);
  });

  it("skips actions without MCP surface", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "cli-only",
        surfaces: ["cli"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(0);
  });
});
