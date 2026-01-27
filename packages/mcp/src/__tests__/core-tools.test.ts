/**
 * @outfitter/mcp - Core tools tests
 */

import { describe, expect, it } from "bun:test";
import { Result } from "@outfitter/contracts";
import { z } from "zod";
import {
  createMcpServer,
  defineConfigTool,
  defineDocsTool,
  defineQueryTool,
  defineTool,
} from "../index.js";

describe("core tool metadata", () => {
  it("marks core tools as non-deferred", () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(defineDocsTool());
    server.registerTool(defineConfigTool());
    server.registerTool(defineQueryTool());

    const tools = server.getTools();
    expect(tools.every((tool) => tool.defer_loading === false)).toBe(true);
  });

  it("defaults domain tools to deferred", () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(
      defineTool({
        name: "hello",
        description: "Say hello",
        inputSchema: z.object({ name: z.string().optional() }),
        handler: async (input) =>
          Result.ok({
            content: [{ type: "text", text: `Hello ${input.name ?? "world"}` }],
          }),
      })
    );

    const tools = server.getTools();
    expect(tools[0]?.defer_loading).toBe(true);
  });
});

describe("docs tool", () => {
  it("returns requested section when provided", async () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(
      defineDocsTool({
        docs: {
          overview: "Docs overview",
          tools: [{ name: "query", summary: "Search things" }],
        },
      })
    );

    const result = await server.invokeTool("docs", { section: "overview" });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().overview).toBe("Docs overview");
    expect(result.unwrap().tools).toBeUndefined();
  });
});

describe("config tool", () => {
  it("reads, writes, and lists config values", async () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(defineConfigTool({ initial: { mode: "dev" } }));

    const list = await server.invokeTool("config", { action: "list" });
    expect(list.isOk()).toBe(true);
    expect(list.unwrap().config?.mode).toBe("dev");

    const set = await server.invokeTool("config", {
      action: "set",
      key: "mode",
      value: "prod",
    });
    expect(set.isOk()).toBe(true);

    const get = await server.invokeTool("config", {
      action: "get",
      key: "mode",
    });
    expect(get.isOk()).toBe(true);
    expect(get.unwrap().value).toBe("prod");
    expect(get.unwrap().found).toBe(true);
  });

  it("returns validation error when key is missing", async () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(defineConfigTool());

    const result = await server.invokeTool("config", { action: "get" });
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe(-32_602);
  });
});

describe("query tool", () => {
  it("returns empty results by default", async () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(defineQueryTool());

    const result = await server.invokeTool("query", { q: "hello" });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().results).toEqual([]);
    expect(result.unwrap()._meta?.note).toBe("No query handler configured.");
  });

  it("accepts query alias", async () => {
    const server = createMcpServer({ name: "test", version: "0.0.0" });
    server.registerTool(defineQueryTool());

    const result = await server.invokeTool("query", { query: "hello" });
    expect(result.isOk()).toBe(true);
  });
});
