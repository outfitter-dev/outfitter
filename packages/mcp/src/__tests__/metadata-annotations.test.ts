/**
 * Tests for mapping readOnly/idempotent metadata to MCP tool annotations.
 *
 * Covers:
 * - readOnly maps to readOnlyHint in MCP ToolAnnotations (VAL-SAFE-005)
 * - idempotent maps to idempotentHint in MCP ToolAnnotations (VAL-SAFE-005)
 * - Both together map correctly
 * - When not set, annotations are not added
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";

import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import { buildMcpTools } from "../actions.js";

describe("Metadata to MCP tool annotations mapping (VAL-SAFE-005)", () => {
  it("readOnly maps to readOnlyHint annotation", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "list-items",
        description: "List all items",
        surfaces: ["mcp"],
        input: z.object({}),
        handler: async () => Result.ok({ items: [] }),
        mcp: { readOnly: true },
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    expect(tools[0].annotations).toBeDefined();
    expect(tools[0].annotations!.readOnlyHint).toBe(true);
  });

  it("idempotent maps to idempotentHint annotation", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "set-value",
        description: "Set a value",
        surfaces: ["mcp"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
        mcp: { idempotent: true },
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    expect(tools[0].annotations).toBeDefined();
    expect(tools[0].annotations!.idempotentHint).toBe(true);
  });

  it("both readOnly and idempotent map to both hints", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "get-status",
        description: "Get system status",
        surfaces: ["mcp"],
        input: z.object({}),
        handler: async () => Result.ok({ status: "ok" }),
        mcp: { readOnly: true, idempotent: true },
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    expect(tools[0].annotations).toBeDefined();
    expect(tools[0].annotations!.readOnlyHint).toBe(true);
    expect(tools[0].annotations!.idempotentHint).toBe(true);
  });

  it("when neither readOnly nor idempotent is set, no annotations are added", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "plain-action",
        description: "A plain action",
        surfaces: ["mcp"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    // No annotations should be present
    expect(tools[0].annotations).toBeUndefined();
  });

  it("readOnly=false does not add annotations", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "mutating-action",
        description: "A mutating action",
        surfaces: ["mcp"],
        input: z.object({}),
        handler: async () => Result.ok({ ok: true }),
        mcp: { readOnly: false },
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    // false values should not produce annotations (same as absent)
    expect(tools[0].annotations).toBeUndefined();
  });

  it("metadata annotations compose with existing MCP spec fields", () => {
    const registry = createActionRegistry().add(
      defineAction({
        id: "search",
        description: "Search items",
        surfaces: ["mcp"],
        input: z.object({ query: z.string() }),
        handler: async () => Result.ok({ results: [] }),
        mcp: {
          tool: "search-items",
          description: "Search for items by query",
          readOnly: true,
          idempotent: true,
        },
      })
    );

    const tools = buildMcpTools(registry);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("search-items");
    expect(tools[0].description).toBe("Search for items by query");
    expect(tools[0].annotations).toBeDefined();
    expect(tools[0].annotations!.readOnlyHint).toBe(true);
    expect(tools[0].annotations!.idempotentHint).toBe(true);
  });
});
